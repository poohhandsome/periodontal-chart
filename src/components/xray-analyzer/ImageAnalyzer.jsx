// src/components/.../ImageAnalyzer.jsx
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as ort from 'onnxruntime-web';
import { ProcessingStep, PrognosisLevel } from '../../xray-types';
import { UploadIcon, CloseIcon, RedoIcon, MagicWandIcon, RotateIcon, TrashIcon } from './Icons';import { slotConfigurations } from '../../xray-config';
import AIPreAnalyzeModal from './AIPreAnalyzeModal';

// ---------- ORT & Models ----------
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
ort.env.logLevel = 'warning';
const KP8_MODEL = '/best.onnx';        // 8-keypoint model
const KP2_MODEL = '/tooth-axis.onnx';  // 2-keypoint axis model
// --- 8-KP index map (your training order)

// ---------- Constants ----------
const paAnnotationLabels = ['Crown Tip', 'CEJ', 'Bone Level', 'Root Apex', 'Physiologic Bone Level'];
const bwAnnotationLabels = ['Tooth Axis Point', 'CEJ', 'Bone Level'];
const pointColors = ['#00FFFF', '#FF00FF', '#FFFF00', '#00FF00', '#FFA500'];
const PIXELS_PER_MM = 12;
const KP8_IDX = {
  crownM: 0,  // tipM
  cejM:   1,
  boneM:  2,
  apexM:  3,
  cejD:   4,
  boneD:  5,
  apexD:  6,
  crownD: 7,  // tipD
};
// ---------- Letterbox helpers ----------
const makeLetterboxToCanvas = (iw, ih, cw, ch) => {
  const ratio = Math.min(cw / iw, ch / ih);
  const newW = iw * ratio;
  const newH = ih * ratio;
  const ox = (cw - newW) / 2;
  const oy = (ch - newH) / 2;
  return {
    ratio, ox, oy, newW, newH, // These are needed by the new draw function
    toCanvas: (p) => ({ x: ox + p.x * ratio, y: oy + p.y * ratio })
  };
};

// Build 1×3×640×640 tensor (letterboxed) and return mapping back to original image pixels
const buildNCHW3x640Float = (img) => {
  const W = 640, H = 640;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;

  const can = document.createElement('canvas');
  can.width = W; can.height = H;
  const ctx = can.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const ratio = Math.min(W / iw, H / ih);
  const newW = iw * ratio, newH = ih * ratio;
  const ox = (W - newW) / 2, oy = (H - newH) / 2;

  ctx.drawImage(img, ox, oy, newW, newH);

  const { data } = ctx.getImageData(0, 0, W, H);
  const plane = W * H;
  const arr = new Float32Array(3 * plane);
  for (let i = 0, p = 0; i < plane; i++, p += 4) {
    arr[i] = data[p] / 255;
    arr[i + plane] = data[p + 1] / 255;
    arr[i + 2 * plane] = data[p + 2] / 255;
  }
  return { tensor: new ort.Tensor('float32', arr, [1, 3, H, W]), letterbox: { ratio, ox, oy, iw, ih } };
};
function logMapping(where, imgW, imgH, cw, ch, ratio, ox, oy, det) {
  console.log(`--- ${where} ---`, {
    imageDimensions: { width: imgW, height: imgH },
    canvasDimensions: { width: cw, height: ch },
    letterbox: { ratio, ox, oy },
    firstDetection: det && {
      id: det.id,
      axis: det.axis,
      aiPoints: det.aiPoints,
      status: det.status,
    },
  });
}

// Optional: draw a small cross to visually confirm a mapped point
function debugCross(ctx, p, size = 6) {
  if (!p) return;
  ctx.save();
  ctx.strokeStyle = 'magenta';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x - size, p.y); ctx.lineTo(p.x + size, p.y);
  ctx.moveTo(p.x, p.y - size); ctx.lineTo(p.x, p.y + size);
  ctx.stroke();
  ctx.restore();
}
// ---------- Geometry helpers ----------
const projectPointOnLine = (p, a, b) => {
  const atob = { x: b.x - a.x, y: b.y - a.y };
  const atop = { x: p.x - a.x, y: p.y - a.y };
  const len = atob.x * atob.x + atob.y * atob.y;
  if (len === 0) return a;
  const dot = atop.x * atob.x + atop.y * atob.y;
  const t = Math.max(0, Math.min(1, dot / len));
  return { x: a.x + atob.x * t, y: a.y + atob.y * t };
};

const nonMaxSuppression = (boxes, scores, iouThreshold) => {
  const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const keep = [];
  const suppressed = Array(scores.length).fill(false);
  for (const i of order) {
    if (suppressed[i]) continue;
    keep.push(i);
    for (const j of order) {
      if (i === j || suppressed[j]) continue;
      const [x1, y1, x2, y2] = boxes[i];
      const [X1, Y1, X2, Y2] = boxes[j];
      const ix1 = Math.max(x1, X1), iy1 = Math.max(y1, Y1);
      const ix2 = Math.min(x2, X2), iy2 = Math.min(y2, Y2);
      const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
      const a1 = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
      const a2 = Math.max(0, X2 - X1) * Math.max(0, Y2 - Y1);
      const denom = a1 + a2 - inter;
      const iou = denom <= 0 ? 0 : inter / denom;
      if (iou > iouThreshold) suppressed[j] = true;
    }
  }
  return keep;
};

// ---------- CRITICAL: EXACTLY match ONNX page parsing ----------
// We assume YOLOv8/YOLOv11 pose export with layout [1, P, N] and XYWH.
// P = 4 (box) + 1 (conf) + 3*K (keypoints). N is large (~8400).
const extractDetections = (results, session, numKeypoints, letterbox) => {
  const outName = session.outputNames?.[0];
  const t = outName ? results[outName] : null;
  if (!t || t.dims.length !== 3) return [];

  const P = t.dims[1];
  const N = t.dims[2];

  // Accessor for [1, P, N]
  const get = (k, i) => t.data[k * N + i];

  const { ratio, ox, oy } = letterbox;
  const unmap = (x, y) => ({ x: (x - ox) / ratio, y: (y - oy) / ratio });

  const confTh = 0.45;   // tighter than 0.30 to curb noisy anchors
  const iouTh  = 0.50;

  const boxes = [];
  const scores = [];
  const kps = [];

  for (let i = 0; i < N; i++) {
    const score = get(4, i);
    if (!(score >= confTh)) continue;

    // XYWH (center-size) -> corners
    const cx = get(0, i), cy = get(1, i), w = get(2, i), h = get(3, i);
    const x1 = cx - w / 2, y1 = cy - h / 2, x2 = cx + w / 2, y2 = cy + h / 2;

    // Map from 640-letterbox back to original image pixels
    const p11 = unmap(x1, y1);
    const p22 = unmap(x2, y2);

    // Drop degenerate boxes after unmapping
    if ((p22.x - p11.x) < 1 || (p22.y - p11.y) < 1) continue;

    boxes.push([p11.x, p11.y, p22.x, p22.y]);
    scores.push(score);

    const pts = [];
    let nonZero = 0;
    for (let j = 0; j < numKeypoints; j++) {
      const x = get(5 + j * 3, i);
      const y = get(6 + j * 3, i);
      const u = unmap(x, y);
      if (u.x !== 0 || u.y !== 0) nonZero++;
      pts.push({ x: u.x, y: u.y });
    }
    // Require at least a couple of keypoints to be non-zero
    if (nonZero < Math.min(2, numKeypoints)) {
      boxes.pop(); scores.pop(); // discard this anchor
      continue;
    }
    kps.push(pts);
  }

  const keep = nonMaxSuppression(boxes, scores, iouTh);
  return keep.map(idx => ({ box: boxes[idx], points: kps[idx], score: scores[idx] }));
};

// ---------- Map image-pixel coordinates → canvas pixels ----------
const toCanvasMapper = (img, canvas) => {
  const cw = canvas.width, ch = canvas.height;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  return (p) => ({ x: (p.x * cw) / iw, y: (p.y * ch) / ih });
};
// ---- Hit-testing helpers for AI detections (canvas space) ----
const dist2 = (p, q) => {
  const dx = p.x - q.x, dy = p.y - q.y;
  return dx*dx + dy*dy;
};
const clamp01 = (t) => Math.max(0, Math.min(1, t));
const distPointToSeg2 = (p, a, b) => {
  const abx = b.x - a.x, aby = b.y - a.y;
  const apx = p.x - a.x, apy = p.y - a.y;
  const denom = abx*abx + aby*aby || 1e-6;
  const t = clamp01((apx*abx + apy*aby) / denom);
  const x = a.x + abx*t, y = a.y + aby*t;
  const dx = p.x - x, dy = p.y - y;
  return dx*dx + dy*dy;
};
const HIT_R2 = 14 * 14; // ~14 px radius

// Returns closest detection id under pointer, else null.
const hitTestDetectionAtPoint = (pt, dets) => {
  let best = { id: null, d2: Infinity };
  for (const det of dets) {
    const { aiPoints, axis } = det;
    // test 4 landmarks
    const cand = [aiPoints.crownTip, aiPoints.cej, aiPoints.boneLevel, aiPoints.rootApex];
    for (const c of cand) {
      const d2 = dist2(pt, c);
      if (d2 < best.d2) best = { id: det.id, d2 };
    }
    // test axis segment
    const d2seg = distPointToSeg2(pt, axis[0], axis[1]);
    if (d2seg < best.d2) best = { id: det.id, d2: d2seg };
  }
  return best.d2 <= HIT_R2 ? best.id : null;
};
// ---------- Pairing helpers ----------
const iou = (a, b) => {
  const [x1,y1,x2,y2] = a, [X1,Y1,X2,Y2] = b;
  const ix1 = Math.max(x1, X1), iy1 = Math.max(y1, Y1);
  const ix2 = Math.min(x2, X2), iy2 = Math.min(y2, Y2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const a1 = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const a2 = Math.max(0, X2 - X1) * Math.max(0, Y2 - Y1);
  const denom = a1 + a2 - inter;
  return denom <= 0 ? 0 : inter / denom;
};

const pairDetectionsByIoU = (axisDets, kp8Dets) => {
  if (!axisDets.length || !kp8Dets.length) return [];
  const cands = [];
  for (let ai = 0; ai < axisDets.length; ai++) {
    for (let ki = 0; ki < kp8Dets.length; ki++) {
      cands.push({ ai, ki, iou: iou(axisDets[ai].box, kp8Dets[ki].box) });
    }
  }
  cands.sort((a,b) => b.iou - a.iou);
  const usedA = new Set(), usedK = new Set(), pairs = [];
  for (const c of cands) {
    if (usedA.has(c.ai) || usedK.has(c.ki)) continue;
    if (c.iou < 0.05) continue; // avoid pairing across teeth
    usedA.add(c.ai); usedK.add(c.ki);
    pairs.push({ axis: axisDets[c.ai], kp8: kp8Dets[c.ki] });
  }
  // Fallback: left-to-right if nothing paired
  if (!pairs.length) {
    const cx = (b) => (b[0] + b[2]) / 2;
    const A = axisDets.slice().sort((u,v) => cx(u.box) - cx(v.box));
    const K = kp8Dets.slice().sort((u,v) => cx(u.box) - cx(v.box));
    const n = Math.min(A.length, K.length);
    for (let i=0;i<n;i++) pairs.push({ axis: A[i], kp8: K[i] });
  }
  return pairs;
};
// Fuse 2-KP axis detections with 8-KP landmarks and emit two side-specific detections (M & D),
// all in CANVAS coordinates via the provided toCanvas mapper.
const fuseDetections = (axisDets, kp8Dets, toCanvas) => {
  const pairs = pairDetectionsByIoU(axisDets, kp8Dets);
  const d = (P, Q) => Math.hypot(P.x - Q.x, P.y - Q.y);

  return pairs.flatMap(({ axis, kp8 }) => {
    // Axis endpoints (canvas space)
    const A1 = toCanvas(axis.points[0]);
    const A2 = toCanvas(axis.points[1]);

    // 8-KP landmarks (canvas space)
    const K = kp8.points;
    const crownM = toCanvas(K[KP8_IDX.crownM]);
    const cejM   = toCanvas(K[KP8_IDX.cejM]);
    const boneM  = toCanvas(K[KP8_IDX.boneM]);
    const apexM  = toCanvas(K[KP8_IDX.apexM]);

    const crownD = toCanvas(K[KP8_IDX.crownD]);
    const cejD   = toCanvas(K[KP8_IDX.cejD]);
    const boneD  = toCanvas(K[KP8_IDX.boneD]);
    const apexD  = toCanvas(K[KP8_IDX.apexD]);

    // Orient the axis per side, using that side's crown tip (nearest end = crown)
    let crownAxisM = A1, apexAxisM = A2;
    if (d(A1, crownM) > d(A2, crownM)) { crownAxisM = A2; apexAxisM = A1; }

    let crownAxisD = A1, apexAxisD = A2;
    if (d(A1, crownD) > d(A2, crownD)) { crownAxisD = A2; apexAxisD = A1; }

    return [
      {
        id: makeId(),
        axis: [crownAxisM, apexAxisM],
        aiPoints: { crownTip: crownM, cej: cejM, boneLevel: boneM, rootApex: apexM },
        status: 'pending',
      },
      {
        id: makeId(),
        axis: [crownAxisD, apexAxisD],
        aiPoints: { crownTip: crownD, cej: cejD, boneLevel: boneD, rootApex: apexD },
        status: 'pending',
      },
    ];
  });
};

const projScalar = (P, A, B) => {
  const abx = B.x - A.x, aby = B.y - A.y;
  const apx = P.x - A.x, apy = P.y - A.y;
  const denom = (abx*abx + aby*aby) || 1e-6;
  return (apx*abx + apy*aby) / denom;
};
const pointAtT = (A, B, t) => ({ x: A.x + t*(B.x - A.x), y: A.y + t*(B.y - A.y) });
const makeId = () => Math.random().toString(36).slice(2, 9);

// ---------- Component ----------
const ImageAnalyzer = ({ onClose, onSave, slotId, isVertical, initialData }) => {
  


  const [extraTeeth, setExtraTeeth] = useState([]); // array of strings like '24'
  const [addingTooth, setAddingTooth] = useState(false);
  const [newTooth, setNewTooth] = useState('');
  const [preAnalyzedData, setPreAnalyzedData] = useState(null);
  const processedImageRef = useRef(null); // This will hold the loaded image element
  const [lockDetSelection, setLockDetSelection] = useState(false);
  const hydratedOnceRef = useRef(false);
  // App state
  const [activeDetId, setActiveDetId] = useState(null); // clicked detection
  const [hoverDetId, setHoverDetId]   = useState(null); // hovered detection
  const [step, setStep] = useState(() =>
    initialData?.processedImage ? ProcessingStep.ANNOTATE : ProcessingStep.UPLOAD
  );
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(initialData?.processedImage ?? null);
  const [keystonePoints, setKeystonePoints] = useState([
    { x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 },
  ]);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 500 });

  const [annotationSubStep, setAnnotationSubStep] = useState('SELECT');
  const [activeTooth, setActiveTooth] = useState(null);
  const [completedReports, setCompletedReports] = useState(initialData?.reports ?? []);
  const [toothAxisPoints, setToothAxisPoints] = useState([]);
  const [annotationPoints, setAnnotationPoints] = useState([]);
  const [mousePos, setMousePos] = useState(null);

  // show “AI Analyze” only when user chose the AI no-crop upload
  const [aiUploadOnly, setAiUploadOnly] = useState(false);

  // Pending detections
  const [pendingDetections, setPendingDetections] = useState([]);
  const [showPreAnalyzeModal, setShowPreAnalyzeModal] = useState(false);
  // --- NEW: payload parked until ANNOTATE canvas is mounted ---
  const [preAI, setPreAI] = useState(null);

// --- NEW: a dedicated ref to guarantee we read ANNOTATE canvas dimensions ---
  const annotateCanvasRef = useRef(null);
  // Dragging/inputs
  const draggingRef = useRef(null);
  const lastInteractionTime = useRef(0);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const fileAiInputRef = useRef(null);

  // AI sessions
  const [kp8Session, setKp8Session] = useState(null);
  const [kp2Session, setKp2Session] = useState(null);
  const [aiModelsLoading, setAiModelsLoading] = useState(true);
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const aiInitialized = useRef(false);

  // Slot config
  const analysisType = slotConfigurations[slotId].analysisType;
  const usePaAnalysis = analysisType === 'PA';
  const annotationLabels = usePaAnalysis ? paAnnotationLabels : bwAnnotationLabels;
  const teethInSlot = slotConfigurations[slotId].teeth;
  const allTeeth = Array.from(new Set([...(teethInSlot || []), ...extraTeeth]));
  // Load models
  useEffect(() => {
    if (aiInitialized.current) return;
    aiInitialized.current = true;
    (async () => {
      try {
        const [kp8, kp2] = await Promise.all([
          ort.InferenceSession.create(KP8_MODEL, { executionProviders: ['wasm'] }),
          ort.InferenceSession.create(KP2_MODEL, { executionProviders: ['wasm'] }),
        ]);
        setKp8Session(kp8);
        setKp2Session(kp2);
      } catch (e) {
        console.error('Failed to load AI models', e);
      } finally {
        setAiModelsLoading(false);
      }
    })();
  }, []);
  
  // Sync initial data later
  useEffect(() => {
  // Hydrate from props only once per slot mount.
  if (hydratedOnceRef.current) return;

  if (initialData?.processedImage) {
    setProcessedImage(initialData.processedImage);
    setCompletedReports(initialData.reports || []);
    setStep(ProcessingStep.ANNOTATE);
  } else {
    setStep(ProcessingStep.UPLOAD);
  }
  hydratedOnceRef.current = true;
}, [initialData, slotId]);
  
  // --------- Drawing helpers ----------
  const drawAIPendingOverlay = (ctx) => {
  pendingDetections.forEach(det => {
    if (det.status !== 'pending') return;

    const isActive = det.id === activeDetId;
    const isHover  = det.id === hoverDetId;

    // visual emphasis
    const alpha      = isActive ? 1.0 : (isHover ? 0.75 : 0.35);
    const axisDash   = isActive ? [] : [6, 4];
    const axisColor  = isActive ? 'rgba(37,99,235,1)'  : 'rgba(37,99,235,0.8)';
    const pointSize  = isActive ? 6 : 4;

    const [a, b] = det.axis;
    const pts = [det.aiPoints.crownTip, det.aiPoints.cej, det.aiPoints.boneLevel, det.aiPoints.rootApex];

    ctx.save();
    ctx.globalAlpha = alpha;

    // Axis
    ctx.beginPath();
    ctx.setLineDash(axisDash);
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = 2;
    ctx.strokeStyle = axisColor;
    ctx.stroke();
    ctx.setLineDash([]);

    // Points + rays
    pts.forEach((p, i) => {
      // point
      ctx.beginPath();
      ctx.arc(p.x, p.y, pointSize, 0, 2 * Math.PI);
      ctx.fillStyle = pointColors[i];
      ctx.fill();

      // ray to axis
      const pr = projectPointOnLine(p, a, b);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(pr.x, pr.y);
      ctx.setLineDash([2, 2]);
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(59,130,246,0.7)';
      ctx.stroke();
      ctx.setLineDash([]);
    });

    ctx.restore();
  });
};

  const drawAnalysisLines = (ctx, report, color) => {
    const [axisStart, axisEnd] = report.axis;
    ctx.beginPath();
    ctx.moveTo(axisStart.x, axisStart.y);
    ctx.lineTo(axisEnd.x, axisEnd.y);
    ctx.strokeStyle = color || '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    report.annotations.forEach((p, i) => {
      const projectedP = projectPointOnLine(p, axisStart, axisEnd);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(projectedP.x, projectedP.y);
      ctx.strokeStyle = pointColors[i];
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = pointColors[i];
      ctx.fill();
    });
  };

  // Find and replace this entire function in ImageAnalyzer.jsx
const draw = useCallback(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ----- STEP 1: KEYSTONE (show original upload with draggable corners) -----
  if (step === ProcessingStep.KEYSTONE && originalImage) {
    // Draw the image stretched to the canvas (no letterbox).
    // (Matches processKeystone() which maps by simple canvas<->image scaling.)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);

    // Keystone polygon + handles
    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(59,130,246,0.9)'; // blue
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(keystonePoints[0].x, keystonePoints[0].y);
    ctx.lineTo(keystonePoints[1].x, keystonePoints[1].y);
    ctx.lineTo(keystonePoints[2].x, keystonePoints[2].y);
    ctx.lineTo(keystonePoints[3].x, keystonePoints[3].y);
    ctx.closePath();
    ctx.stroke();
    ctx.setLineDash([]);

    // Corner handles
    keystonePoints.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, 2 * Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = 'rgba(59,130,246,1)';
      ctx.stroke();
    });
    ctx.restore();
    return; // IMPORTANT: do not fall through to ANNOTATE drawing
  }

  // ----- STEP 2: ANNOTATE (letterboxed processed image + overlays) -----
  const img = processedImageRef.current;
  if (!img) return; // nothing to draw yet

  const { ratio, ox, oy, newW, newH } = makeLetterboxToCanvas(
    img.naturalWidth, img.naturalHeight, canvas.width, canvas.height
  );

  // Optional diagnostics
  logMapping(
    'ANNOTATE DRAW (canvas paint)',
    img.naturalWidth, img.naturalHeight,
    canvas.width, canvas.height,
    ratio, ox, oy,
    pendingDetections?.[0]
  );

  // Background + image
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, ox, oy, newW, newH);

  // Overlays
  if (pendingDetections.length > 0) drawAIPendingOverlay(ctx);
  completedReports.forEach(r => {
    if (r.id !== activeTooth?.id) drawAnalysisLines(ctx, r, '#888888');
  });

  // Active manual annotations (your existing code)
  if (activeTooth) {
    if (toothAxisPoints.length > 0) {
      ctx.beginPath();
      ctx.moveTo(toothAxisPoints[0].x, toothAxisPoints[0].y);
      const endPoint = toothAxisPoints.length === 2
        ? toothAxisPoints[1]
        : (annotationSubStep === 'DRAW_AXIS' && mousePos ? mousePos : null);
      if (endPoint) ctx.lineTo(endPoint.x, endPoint.y);
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      toothAxisPoints.forEach(p => {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI); ctx.fill();
      });
    }
    if (toothAxisPoints.length === 2) {
      annotationPoints.forEach((p, i) => {
        const projectedP = projectPointOnLine(p, toothAxisPoints[0], toothAxisPoints[1]);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(projectedP.x, projectedP.y);
        const idx = usePaAnalysis ? i : i + 1;
        ctx.strokeStyle = pointColors[idx];
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = pointColors[idx]; ctx.fill();
      });
      const required = usePaAnalysis ? 5 : 2;
      if (mousePos && annotationSubStep === 'PLACE_POINTS' && annotationPoints.length < required) {
        const projectedP = projectPointOnLine(mousePos, toothAxisPoints[0], toothAxisPoints[1]);
        ctx.beginPath(); ctx.moveTo(mousePos.x, mousePos.y); ctx.lineTo(projectedP.x, projectedP.y);
        const idx = usePaAnalysis ? annotationPoints.length : annotationPoints.length + 1;
        ctx.strokeStyle = pointColors[idx];
        ctx.lineWidth = 1; ctx.setLineDash([2, 2]); ctx.stroke(); ctx.setLineDash([]);
      }
    }
  }
}, [
  step, originalImage, processedImage, pendingDetections, completedReports,
  activeTooth, toothAxisPoints, annotationPoints, mousePos, usePaAnalysis,
  annotationSubStep, activeDetId, hoverDetId   // <— add these
]);

  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
  if (!processedImage) return;
  const img = new Image();
  img.onload = () => {
    processedImageRef.current = img;
    draw(); // repaint with the loaded image
  };
  img.src = processedImage;
}, [processedImage, draw]);
  // Pointer interactions
  const near = (p, q, r = 20) => Math.hypot(p.x - q.x, p.y - q.y) <= r;
  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  };

  const handleInteractionStart = (e) => {
  const now = Date.now();
  if (now - lastInteractionTime.current < 50) return;
  lastInteractionTime.current = now;
  if (!e.isPrimary) return;
  e.preventDefault();
  canvasRef.current?.setPointerCapture(e.pointerId);
  const p = getCanvasPoint(e);

  // NEW: pick an AI detection (canvas-first UX)
  if (step === ProcessingStep.ANNOTATE && !lockDetSelection) {
  const id = hitTestDetectionAtPoint(p, pendingDetections);
  if (id) { setActiveDetId(id); return; }
}

  // existing manual logic…
  if (step === ProcessingStep.KEYSTONE) {
    const idx = keystonePoints.findIndex((kp) => near(kp, p, 12));
    if (idx !== -1) { draggingRef.current = { type: 'keystone', index: idx }; return; }
  } else if (step === ProcessingStep.ANNOTATE && activeTooth) {
      for (let i = 0; i < toothAxisPoints.length; i++) {
        if (near(toothAxisPoints[i], p, 12)) { draggingRef.current = { type: 'axis', index: i }; return; }
      }
      for (let i = 0; i < annotationPoints.length; i++) {
        if (near(annotationPoints[i], p, 12)) { draggingRef.current = { type: 'annotation', index: i }; return; }
      }

      if (annotationSubStep === 'DRAW_AXIS') {
        const newPoints = [...toothAxisPoints, p];
        setToothAxisPoints(newPoints);
        if (newPoints.length === 2) setAnnotationSubStep('PLACE_POINTS');
      } else if (annotationSubStep === 'PLACE_POINTS') {
        const required = usePaAnalysis ? 5 : 2;
        if (annotationPoints.length < required) setAnnotationPoints([...annotationPoints, p]);
      }
    }
  };

  const handleInteractionMove = (e) => {
    const p = getCanvasPoint(e);
    setMousePos(p);
    if (step === ProcessingStep.ANNOTATE && !lockDetSelection) {
  const id = hitTestDetectionAtPoint(p, pendingDetections);
  setHoverDetId(id);
} else {
  if (hoverDetId) setHoverDetId(null);
}
    const drag = draggingRef.current;
    if (drag && canvasRef.current?.hasPointerCapture(e.pointerId)) {
      if (drag.type === 'keystone') {
        const newPoints = [...keystonePoints];
        newPoints[drag.index] = p; setKeystonePoints(newPoints);
      } else if (drag.type === 'axis') {
        const newPts = [...toothAxisPoints];
        newPts[drag.index] = p; setToothAxisPoints(newPts);
      } else if (drag.type === 'annotation') {
        const newAnn = [...annotationPoints];
        newAnn[drag.index] = p; setAnnotationPoints(newAnn);
      }
    }
  };

  const handleInteractionEnd = (e) => {
    if (canvasRef.current?.hasPointerCapture(e.pointerId)) canvasRef.current.releasePointerCapture(e.pointerId);
    draggingRef.current = null;
  };

  // ---------- File handlers ----------
  // Normal upload -> Keystone crop workflow
  

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
            setAiUploadOnly(false);
            setOriginalImage(img);
            const MAX_DIM = 500;
            let newWidth, newHeight;
            if (img.width > img.height) { newWidth = MAX_DIM; newHeight = (img.height * MAX_DIM) / img.width; }
            else { newHeight = MAX_DIM; newWidth = (img.width * MAX_DIM) / img.height; }
            setCanvasSize({ width: newWidth, height: newHeight });
            const marginX = newWidth * 0.2, marginY = newHeight * 0.2;
            setKeystonePoints([
              { x: marginX, y: marginY },
              { x: newWidth - marginX, y: marginY },
              { x: newWidth - marginX, y: newHeight - marginY },
              { x: marginX, y: newHeight - marginY }
            ]);
            setStep(ProcessingStep.KEYSTONE);
          };
          img.src = event.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
    autosave();
  };
  // Rotate Function
  const handleRotate90 = () => {
if (!originalImage) return;
const src = originalImage;
const can = document.createElement('canvas');
can.width = src.height; // swap
can.height = src.width;
const ctx = can.getContext('2d');
ctx.translate(can.width / 2, can.height / 2);
ctx.rotate(Math.PI / 2);
ctx.drawImage(src, -src.width / 2, -src.height / 2);
const dataUrl = can.toDataURL();
const img = new Image();
img.onload = () => {
setOriginalImage(img);
// re-size the working canvas similar to handleFileChange
const MAX_DIM = 500;
let newWidth, newHeight;
if (img.width > img.height) { newWidth = MAX_DIM; newHeight = (img.height * MAX_DIM) / img.width; }
else { newHeight = MAX_DIM; newWidth = (img.width * MAX_DIM) / img.height; }
setCanvasSize({ width: newWidth, height: newHeight });
const marginX = newWidth * 0.2, marginY = newHeight * 0.2;
setKeystonePoints([
{ x: marginX, y: marginY },
{ x: newWidth - marginX, y: marginY },
{ x: newWidth - marginX, y: newHeight - marginY },
{ x: marginX, y: newHeight - marginY }
]);
};
img.src = dataUrl;
autosave();
};
  // No-crop upload (analyze in place)
  const handleFileChangeAIDirect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result;
        if (!dataUrl) return;
        setProcessedImage(dataUrl);
        setOriginalImage(null);
        setAiUploadOnly(true);
        setPendingDetections([]);
        setCompletedReports([]);
        setActiveTooth(null);
        setAnnotationSubStep('SELECT');
        setStep(ProcessingStep.ANNOTATE);
        autosave();
      };
      reader.readAsDataURL(file);
    }
  };
  // Accept results from AIPreAnalyzeModal and map image-pixel coords → annotation canvas
// ---------- *** THE FIX IS HERE *** ----------
  const handlePreAnalyzeDone = (payload) => {
    setPreAnalyzedData(payload); // Park the data
    setStep(ProcessingStep.ANNOTATE); // Switch to the annotation view
    setShowPreAnalyzeModal(false);
  };
  useEffect(() => {
  if (!processedImage) return;       // ignore empty state
  if (step !== ProcessingStep.ANNOTATE) return;
  autosave();                        // debounced; safe to run on each report change
  }, [completedReports, processedImage, step]);
  useEffect(() => {
    if (step !== ProcessingStep.ANNOTATE || !preAnalyzedData) return;

    // 1. Load the image from the modal's data URL
    const img = new Image();
    img.onload = () => {
        processedImageRef.current = img; // Store the loaded image element in our ref
        setProcessedImage(preAnalyzedData.imageDataUrl); // Update state to trigger redraw

        // 2. Now that the image is loaded, we can safely map coordinates
        const canvas = canvasRef.current;
        if (!canvas) return;

        const { imageWidth, imageHeight, detections } = preAnalyzedData;
        const { ratio, ox, oy, toCanvas } =
  makeLetterboxToCanvas(imageWidth, imageHeight, canvas.width, canvas.height);

// Log the exact mapping numbers you will use
logMapping(
  'MAPPING EFFECT (image → canvas)',
  imageWidth, imageHeight,
  canvas.width, canvas.height,
  ratio, ox, oy,
  preAnalyzedData?.detections?.[0]   // raw (image-space) detection for reference
);

        const mappedDetections = detections.map(d => ({
            id: d.id,
            status: 'pending',
            axis: [toCanvas(d.axis[0]), toCanvas(d.axis[1])],
            aiPoints: {
                crownTip: toCanvas(d.aiPoints.crownTip),
                cej: toCanvas(d.aiPoints.cej),
                boneLevel: toCanvas(d.aiPoints.boneLevel),
                rootApex: toCanvas(d.aiPoints.rootApex),
            },
        }));

        setPendingDetections(mappedDetections);
        // --- 🔽 ADD THIS CONSOLE LOG HERE 🔽 ---
        if (mappedDetections.length > 0) {
          console.log(
            '%c--- DATA IN IMAGE ANALYZER (AFTER MAPPING) ---',
            'color: cyan; font-weight: bold;',
            {
              canvasDimensions: {
                width: canvas.width,
                height: canvas.height,
              },
              firstDetectionMapped: mappedDetections[0],
            }
          );
        }
        // --- 🔼 END OF CONSOLE LOG 🔼 ---
        setPreAnalyzedData(null); // Clear the parked data
    };
    img.src = preAnalyzedData.imageDataUrl;

}, [step, preAnalyzedData]);

  const handleStartOver = () => {
    setStep(ProcessingStep.UPLOAD);
    setOriginalImage(null);
    setProcessedImage(null);
    setCompletedReports([]);
    setActiveTooth(null);
    setToothAxisPoints([]);
    setAnnotationPoints([]);
    setAnnotationSubStep('SELECT');
    setPendingDetections([]);
    setAiUploadOnly(false);
    setLockDetSelection(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (fileAiInputRef.current) fileAiInputRef.current.value = '';
  };

  const processKeystone = () => {
    if (!originalImage) return;
    const canvas = canvasRef.current; if (!canvas) return;
    const targetWidth = isVertical ? 360 : 480;
    const targetHeight = isVertical ? 480 : 360;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth; tempCanvas.height = targetHeight;
    const tempCtx = tempCanvas.getContext('2d'); if (!tempCtx) return;

    const p = keystonePoints.map(point => ({
      x: point.x * (originalImage.width / canvas.width),
      y: point.y * (originalImage.height / canvas.height)
    }));

    const drawTriangle = (p1, p2, p3, t1, t2, t3) => {
      tempCtx.save(); tempCtx.beginPath();
      tempCtx.moveTo(p1.x, p1.y); tempCtx.lineTo(p2.x, p2.y); tempCtx.lineTo(p3.x, p3.y);
      tempCtx.closePath(); tempCtx.clip();
      const det = t1.x * (t2.y - t3.y) + t2.x * (t3.y - t1.y) + t3.x * (t1.y - t2.y);
      const a = (p1.x * (t2.y - t3.y) + p2.x * (t3.y - t1.y) + p3.x * (t1.y - t2.y)) / det;
      const b = (p1.x * (t3.x - t2.x) + p2.x * (t1.x - t3.x) + p3.x * (t2.x - t1.x)) / det;
      const c = p1.x * (t2.x * t3.y - t3.x * t2.y) + p2.x * (t3.x * t1.y - t1.x * t3.y) + p3.x * (t1.x * t2.y - t2.x * t1.y);
      const d = (p1.y * (t2.y - t3.y) + p2.y * (t3.y - t1.y) + p3.y * (t1.y - t2.y)) / det;
      const e = (p1.y * (t3.x - t2.x) + p2.y * (t1.x - t3.x) + p3.y * (t2.x - t1.x)) / det;
      const f = p1.y * (t2.x * t3.y - t3.x * t2.y) + p2.y * (t3.x * t1.y - t1.x * t3.y) + p3.y * (t1.x * t2.y - t2.x * t1.y);
      tempCtx.transform(a, d, b, e, c / det, f / det);
      tempCtx.drawImage(originalImage, 0, 0); tempCtx.restore();
    };

    const d1 = { x: 0, y: 0 }, d2 = { x: targetWidth, y: 0 }, d3 = { x: targetWidth, y: targetHeight }, d4 = { x: 0, y: targetHeight };
    drawTriangle(d1, d2, d4, p[0], p[1], p[3]);
    drawTriangle(d2, d3, d4, p[1], p[2], p[3]);

    setProcessedImage(tempCanvas.toDataURL());
    setAiUploadOnly(false);
    setStep(ProcessingStep.ANNOTATE);
    
  };

  // ---------- Manual analyze ----------
  const analyzePoints = () => {
    if (toothAxisPoints.length < 2 || !activeTooth) return;
    const [axisStart, axisEnd] = toothAxisPoints;
    const dist = (p1, p2) => Math.hypot(p1.x - p2.x, p1.y - p2.y);

    let reportData = {};
    if (analysisType === 'PA') {
      if (annotationPoints.length < 5) return;
      const projPoints = annotationPoints.map(p => projectPointOnLine(p, axisStart, axisEnd));
      const [pCrown, pCej, pBone, pApex, pPhysioBone] = projPoints;

      const clinicalCrownLen = dist(pCrown, pBone);
      const clinicalRootLen = dist(pBone, pApex);
      const crownRootRatio = clinicalRootLen > 0 ? (clinicalCrownLen / clinicalRootLen).toFixed(2) : 'N/A';

      const anatomicalRootLen = dist(pCej, pApex);
      const cejToBoneLen = dist(pCej, pBone);
      const rblPercentForStaging = anatomicalRootLen > 0 ? Math.min(100, Math.round((cejToBoneLen / anatomicalRootLen) * 100)) : 0;
      let stage = 'Stage I';
      if (rblPercentForStaging > 33) stage = 'Stage III/IV';
      else if (rblPercentForStaging >= 15) stage = 'Stage II';

      const adjustedRootLen = dist(pPhysioBone, pApex);
      const adjustedBoneLossLen = dist(pPhysioBone, pBone);
      const adjustedRblPercent = adjustedRootLen > 0 ? Math.min(100, Math.round((adjustedBoneLossLen / adjustedRootLen) * 100)) : 0;

      let prognosis;
      if (adjustedRblPercent > 75) prognosis = PrognosisLevel.HOPELESS;
      else if (adjustedRblPercent > 50) prognosis = PrognosisLevel.QUESTIONABLE;
      else if (adjustedRblPercent >= 25) prognosis = PrognosisLevel.FAIR;
      else prognosis = PrognosisLevel.GOOD;

      const attachmentLossMm = (adjustedBoneLossLen / PIXELS_PER_MM).toFixed(2);

      reportData = { crownRootRatio, rblPercentForStaging, stage, adjustedRblPercent, prognosis, attachmentLossMm, severity: 'N/A' };
    } else {
      if (annotationPoints.length < 2) return;
      const [cejPoint, bonePoint] = annotationPoints.map(p => projectPointOnLine(p, axisStart, axisEnd));
      const distanceInPixels = dist(cejPoint, bonePoint);
      const distanceInMm = distanceInPixels / PIXELS_PER_MM;
      let prognosis;
      if (distanceInMm <= 1) prognosis = 'Normal (N)';
      else if (distanceInMm <= 2) prognosis = 'Early (E)';
      else if (distanceInMm <= 4) prognosis = 'Moderate (M)';
      else prognosis = 'Advanced (A)';
      reportData = { prognosis, attachmentLossMm: distanceInMm.toFixed(2), crownRootRatio: 'N/A', rblPercentForStaging: -1 };
    }

    const newReport = {
      ...reportData,
      id: activeTooth.id,
      toothNumber: activeTooth.number,
      side: activeTooth.side,
      axis: [axisStart, axisEnd],
      annotations: annotationPoints
    };

    setCompletedReports(prev => [
...prev.filter(r => r.id !== activeTooth.id),
newReport
]);
    
    setActiveTooth(null);
    setAnnotationSubStep('SELECT');
    setToothAxisPoints([]);
    setAnnotationPoints([]);
    setLockDetSelection(false);
  };
  const deleteReport = (id) => {
setCompletedReports(prev => prev.filter(r => r.id !== id));
if (activeTooth?.id === id) {
setActiveTooth(null);
setAnnotationSubStep('SELECT');
setToothAxisPoints([]);
setAnnotationPoints([]);

}

};
  const handleSave = () => {
    if (!processedImage) return;
    onSave({ id: slotId, processedImage, reports: completedReports });
    onClose();
  };

  const persistAll = useCallback(async ({ silent = false } = {}) => {
  try {
    const payload = {
      id: slotId,
      processedImage,
      reports: completedReports,
      extraTeeth,
      __silent: silent,
    };
    if (typeof onSave === 'function') {
      onSave(payload);
    }
    if (!silent) console.debug('[persistAll] saved');
  } catch (e) {
    if (!silent) console.error('[persistAll] failed', e);
  }
}, [onSave, slotId, processedImage, completedReports, extraTeeth]);
const persistAllRef = useRef(persistAll);
useEffect(() => {
  persistAllRef.current = persistAll;
}, [persistAll]);
const debouncedAutosave = useMemo(() => {
  let timer;
  const debounced = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      // When it fires, it calls the *latest* function from the ref.
      persistAllRef.current({ silent: true });
    }, 800); // 800ms delay
  };
  // A function to cancel any pending save.
  debounced.cancel = () => {
    clearTimeout(timer);
  };
  return debounced;
}, []); // Empty dependency array ensures this is created only once.
useEffect(() => {
  if (processedImage && step === ProcessingStep.ANNOTATE) {
    debouncedAutosave();
  }
  // Cleanup function to cancel the timer if the component unmounts.
  return () => {
    debouncedAutosave.cancel();
  };
}, [processedImage, completedReports, step, debouncedAutosave]);
const autosaveRef = useRef(() => {});
useEffect(() => {
  const debounce = (fn, wait = 800) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };
  autosaveRef.current = debounce(() => persistAll({ silent: true }), 800);
}, [persistAll]);
const handleSaveOnClose = () => {
  debouncedAutosave.cancel();
  persistAll({ silent: true });
  onClose();
};

const handleSaveAllAndClose = async () => {
  debouncedAutosave.cancel();
  await persistAll({ silent: false });
  onClose && onClose();
};
const autosave = () => autosaveRef.current?.();
  const selectToothForAnalysis = (toothNumber, side) => {
  // If user has selected an AI detection, assign it directly
  if (activeDetId) {
    assignDetectionToTooth(activeDetId, toothNumber, side);
    setActiveDetId(null);
    return;
  }

  // --- manual path (unchanged) ---
  const id = `${toothNumber}${side}`;
  const existingReport = completedReports.find(r => r.id === id);
  if (existingReport) {
    setToothAxisPoints(existingReport.axis);
    setAnnotationPoints(existingReport.annotations);
    setAnnotationSubStep('PLACE_POINTS');
  } else {
    setToothAxisPoints([]);
    setAnnotationPoints([]);
    setAnnotationSubStep('DRAW_AXIS');
  }
  setActiveTooth({ number: toothNumber, side, id });
};
  // ---------- Single "AI Analyze" ----------
  const runAiAnalyze = async () => {
    
    if (!processedImage || !kp8Session || !kp2Session) return;
    setIsAnalyzingAi(true);
    try {
      const img = await new Promise((resolve) => {
        const im = new Image(); im.onload = () => resolve(im); im.src = processedImage;
      });

      const { tensor, letterbox } = buildNCHW3x640Float(img);
      const res8 = await kp8Session.run({ [kp8Session.inputNames[0]]: tensor });
      const res2 = await kp2Session.run({ [kp2Session.inputNames[0]]: tensor });

      const kp8Det = extractDetections(res8, kp8Session, 8, letterbox);
      const axDet  = extractDetections(res2, kp2Session, 2, letterbox);
      if (kp8Det.length === 0 || axDet.length === 0) {
        alert('AI could not detect any teeth/landmarks. Please adjust image or annotate manually.');
        return;
      }

      const pairs = pairDetectionsByIoU(axDet, kp8Det);
      const cw = canvasRef.current.width, ch = canvasRef.current.height;
const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
const { toCanvas } = makeLetterboxToCanvas(iw, ih, cw, ch);

      // For EACH tooth, create TWO pending detections (share the same axis)
      const newDetections = fuseDetections(axDet, kp8Det, toCanvas);

      setPendingDetections(prev => [...prev, ...newDetections]);
    } catch (e) {
      console.error('AI analysis failed', e);
      alert(`AI analysis failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setIsAnalyzingAi(false);
    }
  };
  const clearAiDetections = () => {
setPendingDetections([]);
setActiveDetId(null);
setHoverDetId(null);
};
  const assignDetectionToTooth = (detId, toothNumber, side) => {
    const det = pendingDetections.find(d => d.id === detId);
    if (!det) return;
    setActiveTooth({ number: toothNumber, side, id: `${toothNumber}${side}` });
    setToothAxisPoints(det.axis);

    if (usePaAnalysis) {
      setAnnotationPoints([
        det.aiPoints.crownTip,
        det.aiPoints.cej,
        det.aiPoints.boneLevel,
        det.aiPoints.rootApex
      ]);
    } else {
      setAnnotationPoints([det.aiPoints.cej, det.aiPoints.boneLevel]);
    }
    setAnnotationSubStep('PLACE_POINTS');
    setLockDetSelection(true); 
    setActiveDetId(null);
    setHoverDetId(null);
    setPendingDetections(prev => prev.map(d => d.id === detId
      ? { ...d, status: 'assigned', assigned: { toothNumber, side } }
      : d
    ));
  };

  const discardDetection = (detId) => {
    setPendingDetections(prev => prev.filter(d => d.id !== detId));
  };

  // ---------- UI ----------
  const renderStepContent = () => {
    switch (step) {
      case ProcessingStep.UPLOAD:
        return (
          <div className="text-center">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Upload X-Ray</h3>

            <div className="flex flex-col sm:flex-row justify-center items-center gap-3">
              {/* Normal upload -> Keystone */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border"
              >
                <UploadIcon className="w-5 h-5 text-blue-600" />
                <span>Upload File</span>
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/png, image/jpeg"
                className="hidden"
              />

              
            </div>
          </div>
        );

      case ProcessingStep.KEYSTONE:
        return (
          <div>
            <h3 className="text-lg font-semibold mb-2 text-center text-gray-800">Step 1: Align Film Corners</h3>
            <p className="text-sm text-center text-gray-600 mb-4">Drag the handles to the corners of the X-ray film. Works with touch.</p>
            <canvas
              ref={canvasRef}
              width={canvasSize.width}
              height={canvasSize.height}
              className="bg-gray-900 mx-auto rounded-md cursor-crosshair touch-none"
              onPointerDown={handleInteractionStart}
              onPointerMove={handleInteractionMove}
              onPointerUp={handleInteractionEnd}
              onPointerCancel={handleInteractionEnd}
              onPointerLeave={(e) => { setMousePos(null); setHoverDetId(null); handleInteractionEnd(e); }}
            ></canvas>
            <div className="text-center mt-4 flex items-center justify-center gap-3">
            <button onClick={processKeystone} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold transition-colors">
            Confirm & Crop
            </button>
            <button onClick={handleRotate90} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md border inline-flex items-center gap-2">
            <RotateIcon className="w-4 h-4" />
            Rotate 90°
            </button>
            </div>
          </div>
        );

      case ProcessingStep.ANNOTATE: {
        const requiredPoints = usePaAnalysis ? 5 : 2;
        let instruction = 'Select a tooth area (M or D) to begin or edit.';
        if (activeTooth) {
          const sideText = activeTooth.side === 'M' ? 'Mesial' : 'Distal';
          if (annotationSubStep === 'DRAW_AXIS') instruction = `Place 2 points to define the long axis for T${activeTooth.number} (${sideText}).`;
          else if (annotationSubStep === 'PLACE_POINTS' && annotationPoints.length < requiredPoints) {
            const labelIndex = usePaAnalysis ? annotationPoints.length : annotationPoints.length + 1;
            instruction = `Place the ${annotationLabels[labelIndex]} point for T${activeTooth.number} (${sideText}).`;
          } else instruction = `Analysis for T${activeTooth.number} (${sideText}) ready to analyze or edit.`;
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="flex flex-wrap justify-between items-center mb-2 gap-2">
                <h3 className="text-lg font-semibold text-gray-800">Step 2: Analyze Teeth</h3>
                <div className="flex items-center gap-2">
                  {
pendingDetections.length === 0 ? (
<button
onClick={runAiAnalyze}
disabled={aiModelsLoading || !processedImage || isAnalyzingAi}
className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400"
title="Run AI analysis"
>
<MagicWandIcon className={`w-4 h-4 ${isAnalyzingAi ? 'animate-spin' : ''}`} />
<span>{isAnalyzingAi ? 'Analyzing…' : 'AI Analyze'}</span>
</button>
) : (
<button
onClick={clearAiDetections}
className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-purple-600 text-white hover:bg-purple-700"
title="Clear AI detections"
>
Clear AI detection
</button>
)
}
                  <button
                    onClick={handleStartOver}
                    className="ml-2 flex items-center gap-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-semibold"
                  >
                    <RedoIcon className="w-4 h-4" />
                    Change Image
                  </button>
                </div>
              </div>

              <p className="text-center text-blue-600 h-6 mb-2 font-semibold">{instruction}</p>

              <canvas
                ref={canvasRef} // --- FIX: Simplified ref assignment
                width={isVertical ? 360 : 480}
                height={isVertical ? 480 : 360}
                className="bg-gray-900 mx-auto rounded-md cursor-crosshair touch-none"
                onPointerDown={handleInteractionStart}
                onPointerMove={handleInteractionMove}
                onPointerUp={handleInteractionEnd}
                onPointerCancel={handleInteractionEnd}
                onPointerLeave={(e) => { setMousePos(null); setHoverDetId(null); handleInteractionEnd(e); }}
              ></canvas>
            </div>

            <div className="md:col-span-1 flex flex-col">
              {pendingDetections.length > 0 && (
  <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
    <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
      <MagicWandIcon className="w-4 h-4" />
      AI found: {pendingDetections.filter(d => d.status === 'pending').length}
    </h4>

    {activeDetId && (
      <div className="mt-2 flex items-center gap-2">
        <button
          className="px-3 py-1 text-sm rounded bg-red-600 text-white hover:bg-red-700"
          onClick={() => { discardDetection(activeDetId); setActiveDetId(null); }}
        >
          Discard selected
        </button>
        <button
          className="px-3 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300"
          onClick={() => setActiveDetId(null)}
        >
          Clear selection
        </button>
        <span className="text-xs text-gray-600 ml-auto">
          Tip: click a faded group on the image, then choose tooth side (e.g., 26M).
        </span>
      </div>
    )}
  </div>
)}

              <div>
                <h4 className="font-semibold mb-2 text-gray-800">1. Select a tooth area to analyze/edit:</h4>
                <div className="flex flex-wrap gap-2">
                  {allTeeth.map(tooth => {
                    const reportM = completedReports.find(r => r.id === `${tooth}M`);
                    const reportD = completedReports.find(r => r.id === `${tooth}D`);

                    const getButtonClass = (report) => {
                      if (!report?.prognosis) return 'bg-gray-200 hover:bg-gray-300 text-gray-700';
                      if (report.prognosis.startsWith(PrognosisLevel.GOOD) || report.prognosis.startsWith('Normal')) return 'bg-green-100 text-green-800 hover:bg-green-200';
                      if (report.prognosis.startsWith(PrognosisLevel.FAIR) || report.prognosis.startsWith('Early')) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
                      if (report.prognosis.startsWith(PrognosisLevel.POOR) || report.prognosis.startsWith('Moderate')) return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
                      if (report.prognosis.startsWith(PrognosisLevel.HOPELESS)) return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
                      return 'bg-red-100 text-red-800 hover:bg-red-200';
                    };

                    const activeClassM = activeTooth?.id === `${tooth}M` ? 'ring-2 ring-offset-2 ring-blue-500' : '';
                    const activeClassD = activeTooth?.id === `${tooth}D` ? 'ring-2 ring-offset-2 ring-blue-500' : '';

                    return (
                      <div key={tooth} className="flex rounded-md overflow-hidden">
                        <button onClick={() => selectToothForAnalysis(tooth, 'M')} className={`px-2 py-1.5 text-sm font-semibold transition-colors ${getButtonClass(reportM)} ${activeClassM}`}>
                          {tooth}M
                        </button>
                        <div className="w-px bg-gray-400"></div>
                        <button onClick={() => selectToothForAnalysis(tooth, 'D')} className={`px-2 py-1.5 text-sm font-semibold transition-colors ${getButtonClass(reportD)} ${activeClassD}`}>
                          {tooth}D
                        </button>
                      </div>
                    );
                  })}
                  {addingTooth ? (
<div className="flex items-center gap-2">
<input
value={newTooth}
onChange={(e) => setNewTooth(e.target.value.trim())}
placeholder="e.g., 24"
className="w-20 px-2 py-1 border rounded"
maxLength={2}
/>
<button
onClick={() => {
const v = newTooth;
if (!/^\d{2}$/.test(v)) return alert('Enter a two-digit tooth number (FDI).');
if (!allTeeth.includes(v)) setExtraTeeth(prev => [...prev, v]);
setNewTooth('');
setAddingTooth(false);
}}
className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
>
Add
</button>
<button onClick={() => { setAddingTooth(false); setNewTooth(''); }} className="px-2 py-1 bg-gray-200 rounded">Cancel</button>
</div>
) : (
<button onClick={() => setAddingTooth(true)} className="px-3 py-1 border rounded bg-white hover:bg-gray-50">
+ Add tooth
</button>
)}
                </div>
              </div>

              {activeTooth && (
                <div className="mt-4">
<h4 className="text-base font-semibold text-gray-800 mb-1 flex items-center justify-between">                    
  <span>
  Analysis for Tooth {activeTooth.number} ({activeTooth.side === 'M' ? 'Mesial' : 'Distal'}) : 
               </span>     
                    <button
onClick={() => {
setActiveTooth(null);
setAnnotationSubStep('SELECT');
setToothAxisPoints([]);
setAnnotationPoints([]);
setLockDetSelection(false);
}}
className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm"
>
Cancel
</button>
                  </h4>
                  
                  {annotationSubStep === 'DRAW_AXIS' && <p className="text-sm text-gray-600">Defining axis… ({toothAxisPoints.length}/2 points)</p>}

                  {annotationSubStep === 'PLACE_POINTS' && (
                    <>
                      <ul className="space-y-2">
                        {(usePaAnalysis ? paAnnotationLabels : bwAnnotationLabels).map((label, i) => (
                          <li key={label} className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border border-gray-400" style={{ backgroundColor: pointColors[usePaAnalysis ? i : i + 1] }}></span>
                            <span className={`${annotationPoints.length > i ? 'line-through text-gray-400' : 'text-gray-700'}`}>{label}</span>
                            {annotationPoints.length === i && <span className="text-blue-600 animate-pulse font-bold">&larr; Current</span>}
                          </li>
                        ))}
                        
                      </ul>

                      <div className="mt-4 flex gap-2">
                        
                        <button
                          onClick={() => {
  setAnnotationPoints([]);
  setToothAxisPoints([]);
  setAnnotationSubStep('DRAW_AXIS');
  setLockDetSelection(false);   // also unlock on reset
}}
                          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm"
                        >
                          Reset
                        </button>
                        {(usePaAnalysis ? annotationPoints.length === 5 : annotationPoints.length === 2) && (
                          <button onClick={analyzePoints} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold">
                            Analyze T{activeTooth.number}{activeTooth.side}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {completedReports.length > 0 && (
                <div className="mt-4 bg-gray-50 p-3 rounded-lg flex-grow border">
                  <h4 className="font-semibold text-gray-800 mb-2">Completed Analyses:</h4>
                  <div className="space-y-2 text-sm overflow-y-auto max-h-96">
                    {completedReports
                      .sort((a, b) => a.toothNumber.localeCompare(b.toothNumber) || a.side.localeCompare(b.side))
                      .map(r => (
                        <div key={r.id} className="bg-white p-2 rounded border border-gray-200 shadow-sm">
<div className="flex items-start justify-between">
<p className="font-bold text-base text-gray-800">
T{r.toothNumber}{r.side}:
<span className={`font-bold ml-2 ${
r.prognosis === PrognosisLevel.GOOD ? 'text-green-600' :
r.prognosis === PrognosisLevel.FAIR ? 'text-yellow-600' :
r.prognosis === PrognosisLevel.POOR ? 'text-orange-600' :
r.prognosis === PrognosisLevel.QUESTIONABLE ? 'text-red-600' :
r.prognosis === PrognosisLevel.HOPELESS ? 'text-purple-600' : ''
}`}>
{r.prognosis}
</span>
</p>
<button onClick={() => deleteReport(r.id)} className="p-1 rounded hover:bg-red-50 text-red-600" title="Delete this analysis">
<TrashIcon className="w-4 h-4" />
</button>
</div>
                          
                          {r.rblPercentForStaging !== -1 ? (
                            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                              <p><strong>Loss:</strong> {r.attachmentLossMm}mm | <strong>Prognosis:</strong> {r.prognosis}</p>
                              <p><strong>C:R Ratio:</strong> {r.crownRootRatio}</p>
                              <p><strong>Staging RBL:</strong> {r.rblPercentForStaging}% | <strong>Adj. RBL:</strong> {r.adjustedRblPercent}%</p>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-500">Loss: {r.attachmentLossMm}mm | Prognosis: {r.prognosis}</p>
                          )}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              <div className="mt-auto pt-4">
                <button onClick={handleSaveAllAndClose} className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold text-lg">
                  Save All & Close
                </button>
              </div>
            </div>
          </div>
        );
      }

      default:
        return <div>Loading…</div>;
    }
  };

  // Render
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-6xl relative max-h-[90vh] overflow-y-auto shadow-2xl">
        <button onClick={handleSaveOnClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 z-10 p-1 rounded-full bg-gray-100 hover:bg-gray-200">
          <CloseIcon className="w-6 h-6" />
        </button>
        {renderStepContent()}
        {showPreAnalyzeModal && (
  <AIPreAnalyzeModal
    isOpen={showPreAnalyzeModal}
    onClose={() => setShowPreAnalyzeModal(false)}
    onContinue={handlePreAnalyzeDone}
  />
)}
      </div>
    </div>
  );
};

export default ImageAnalyzer;
