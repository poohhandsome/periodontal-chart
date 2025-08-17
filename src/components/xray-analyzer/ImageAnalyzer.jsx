// src/components/.../ImageAnalyzer.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import * as ort from 'onnxruntime-web';
import { ProcessingStep, PrognosisLevel } from '../../xray-types';
import { UploadIcon, CloseIcon, RedoIcon, MagicWandIcon } from './Icons';
import { slotConfigurations } from '../../xray-config';

// ---------- ORT & Models ----------
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
ort.env.logLevel = 'warning';
const KP8_MODEL = '/best.onnx';        // 8-keypoint model
const KP2_MODEL = '/tooth-axis.onnx';  // 2-keypoint axis model

// ---------- Constants ----------
const paAnnotationLabels = ['Crown Tip', 'CEJ', 'Bone Level', 'Root Apex', 'Physiologic Bone Level'];
const bwAnnotationLabels = ['Tooth Axis Point', 'CEJ', 'Bone Level'];
const pointColors = ['#00FFFF', '#FF00FF', '#FFFF00', '#00FF00', '#FFA500'];
const PIXELS_PER_MM = 12;

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
// Unit vector with length
const unitVec = (p, q) => {
  const vx = q.x - p.x, vy = q.y - p.y;
  const L = Math.hypot(vx, vy) || 1e-6;
  return { x: vx / L, y: vy / L, L };
};

// Mirror a point across a line AB (used to synthesize the missing side)
const reflectAcrossAxis = (p, a, b) => {
  const pr = projectPointOnLine(p, a, b);
  return { x: 2 * pr.x - p.x, y: 2 * pr.y - p.y };
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
      const a1 = (x2 - x1) * (y2 - y1), a2 = (X2 - X1) * (Y2 - Y1);
      const iou = inter / (a1 + a2 - inter);
      if (iou > iouThreshold) suppressed[j] = true;
    }
  }
  return keep;
};

// Build tensor with letterbox; map back to *image* pixels
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

// Parse YOLO pose-style outputs robustly (v8/v11, pixels/normalized, xyxy/cxcywh).
// Returns boxes & keypoints in ORIGINAL IMAGE PIXELS (not 640), ready for toCanvasMapper(...).
const extractDetections = (results, session, numKeypoints, letterbox, opts = {}) => {
  const confTh = opts.confTh ?? 0.30;
  const iouTh  = opts.iouTh  ?? 0.45;

  const outName = session.outputNames?.[0];
  const t = outName ? results[outName] : null;
  if (!t || t.dims.length !== 3 || t.dims[0] !== 1) {
    console.error("Invalid ONNX output tensor shape:", t?.dims);
    return [];
  }

  const data = t.data;
  const [_, d1, d2] = t.dims;

  // Figure out layout: [1, nCand, props] vs [1, props, nCand]
  let nCand, props, get;
  if (d2 >= d1) {
    // [1, props, nCand]
    props = d1; nCand = d2;
    get = (i, k) => data[k * nCand + i];
  } else {
    // [1, nCand, props]
    nCand = d1; props = d2;
    get = (i, k) => data[i * props + k];
  }

  // Quick sanity for pose: 4(box)+1(conf)+3*numKeypoints
  if (props < 5 + 3 * numKeypoints) {
    console.warn("Props too small for keypoints:", { props, numKeypoints });
  }

  const S = 640; // buildNCHW3x640Float uses 640x640
  const { ratio, ox, oy } = letterbox;

  // Helpers
  const denorm = (v, normalized) => normalized ? (v * S) : v;
  const unmap = (x, y) => ({ x: (x - ox) / ratio, y: (y - oy) / ratio });

  // Auto-detect: normalized coords? xyxy or cxcywh?
  let normVotes = 0, pixVotes = 0, xyxyVotes = 0, cxcywhVotes = 0, samples = 0;
  for (let i = 0; i < nCand && samples < 60; i++) {
    const sc = get(i, 4);
    if (sc < confTh) continue;
    const a = get(i, 0), b = get(i, 1), c = get(i, 2), d = get(i, 3);
    if (a >= 0 && a <= 1 && b >= 0 && b <= 1 && c >= 0 && c <= 1 && d >= 0 && d <= 1) normVotes++; else pixVotes++;
    const w_xyxy  = c - a, h_xyxy  = d - b;
    if (w_xyxy > 0 && h_xyxy > 0) xyxyVotes++; else cxcywhVotes++; // rough vote
    samples++;
  }
  const isNormalized = normVotes > pixVotes;
  const isXYXY = xyxyVotes >= cxcywhVotes;

  const boxes = [];
  const scores = [];
  const kps = [];

  for (let i = 0; i < nCand; i++) {
    const score = get(i, 4);
    if (score < confTh) continue;

    let x1p, y1p, x2p, y2p;
    if (isXYXY) {
      const x1 = denorm(get(i, 0), isNormalized);
      const y1 = denorm(get(i, 1), isNormalized);
      const x2 = denorm(get(i, 2), isNormalized);
      const y2 = denorm(get(i, 3), isNormalized);
      const p1 = unmap(x1, y1);
      const p2 = unmap(x2, y2);
      x1p = p1.x; y1p = p1.y; x2p = p2.x; y2p = p2.y;
    } else {
      const cx = denorm(get(i, 0), isNormalized);
      const cy = denorm(get(i, 1), isNormalized);
      const w  = denorm(get(i, 2), isNormalized);
      const h  = denorm(get(i, 3), isNormalized);
      const p1 = unmap(cx - w / 2, cy - h / 2);
      const p2 = unmap(cx + w / 2, cy + h / 2);
      x1p = p1.x; y1p = p1.y; x2p = p2.x; y2p = p2.y;
    }

    // Skip degenerate
    if (!isFinite(x1p) || !isFinite(y1p) || !isFinite(x2p) || !isFinite(y2p)) continue;
    if (x2p <= x1p || y2p <= y1p) continue;

    boxes.push([x1p, y1p, x2p, y2p]);
    scores.push(score);

    const pts = [];
    for (let j = 0; j < numKeypoints; j++) {
      const kx = denorm(get(i, 5 + j * 3), isNormalized);
      const ky = denorm(get(i, 6 + j * 3), isNormalized);
      const u = unmap(kx, ky);
      pts.push({ x: u.x, y: u.y });
    }
    kps.push(pts);
  }

  const keep = nonMaxSuppression(boxes, scores, iouTh);
  return keep.map(idx => ({ box: boxes[idx], points: kps[idx], score: scores[idx] }));
};


// Map image-pixel coordinates → canvas pixels
const toCanvasMapper = (img, canvas) => {
  const cw = canvas.width, ch = canvas.height;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  return (p) => ({ x: (p.x * cw) / iw, y: (p.y * ch) / ih });
};
const parseDetectionsFromONNX = (results, session, numKeypoints, letterbox) => {
    const outName = session.outputNames?.[0];
    const tensor = outName ? results[outName] : null;
    if (!tensor || tensor.dims.length !== 3) return [];

    const { ratio, ox, oy } = letterbox;
    const scale = 1 / ratio;
    const xOffset = ox;
    const yOffset = oy;
    const confTh = 0.3, iouTh = 0.45;

    // This specific (transposed) data access method is what works for your models
    const dims = tensor.dims, nCand = dims[2], data = tensor.data;
    const get = (k, i) => data[k * nCand + i];
    
    const boxes = [], scores = [], keypoints = [];
    for (let i = 0; i < nCand; i++) {
        const score = get(4, i);
        if (score < confTh) continue;

        const cx = get(0, i), cy = get(1, i), w = get(2, i), h = get(3, i);
        // Un-letterbox the bounding box to the original image's coordinate space
        boxes.push([
            (cx - w / 2 - xOffset) * scale,
            (cy - h / 2 - yOffset) * scale,
            (cx + w / 2 - xOffset) * scale,
            (cy + h / 2 - yOffset) * scale
        ]);
        scores.push(score);

        const pts = [];
        for (let j = 0; j < numKeypoints; j++) {
            // Un-letterbox the keypoints to the original image's coordinate space
            pts.push({
                x: (get(5 + j * 3, i) - xOffset) * scale,
                y: (get(6 + j * 3, i) - yOffset) * scale,
                s: get(7 + j * 3, i) // score/visibility
            });
        }
        keypoints.push(pts);
    }
    
    const keep = nonMaxSuppression(boxes, scores, iouTh);
    return keep.map(idx => ({ box: boxes[idx], points: keypoints[idx], score: scores[idx] }));
};

// Scalar projection of point P onto axis A->B (0 at A, 1 at B if P is at B)
const projScalar = (P, A, B) => {
  const abx = B.x - A.x, aby = B.y - A.y;
  const apx = P.x - A.x, apy = P.y - A.y;
  const denom = (abx*abx + aby*aby) || 1e-6;
  return (apx*abx + apy*aby) / denom;
};

// Point on axis A->B at scalar t
const pointAtT = (A, B, t) => ({
  x: A.x + t * (B.x - A.x),
  y: A.y + t * (B.y - A.y),
});
// --- IoU + greedy pairing (axis ↔ kp8) ---
const iou = (a, b) => {
  const [x1,y1,x2,y2] = a, [X1,Y1,X2,Y2] = b;
  const ix1 = Math.max(x1, X1), iy1 = Math.max(y1, Y1);
  const ix2 = Math.min(x2, X2), iy2 = Math.min(y2, Y2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);
  const a1 = (x2 - x1) * (y2 - y1), a2 = (X2 - X1) * (Y2 - Y1);
  const denom = a1 + a2 - inter;
  return denom <= 0 ? 0 : inter / denom;
};
// Pair axis and kp8 by IoU of boxes (robust)
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
    // accept any IoU > 0, fall back later if none matched
    if (c.iou >= 0) {
      usedA.add(c.ai); usedK.add(c.ki);
      pairs.push({ axis: axisDets[c.ai], kp8: kp8Dets[c.ki] });
    }
  }

  // Fallback: if nothing paired (weird), pair by left-to-right centers
  if (!pairs.length) {
    const centerX = (b) => (b[0] + b[2]) / 2;
    const A = axisDets.slice().sort((u,v) => centerX(u.box) - centerX(v.box));
    const K = kp8Dets.slice().sort((u,v) => centerX(u.box) - centerX(v.box));
    const n = Math.min(A.length, K.length);
    for (let i=0;i<n;i++) pairs.push({ axis: A[i], kp8: K[i] });
  }
  return pairs;
};

const makeId = () => Math.random().toString(36).slice(2, 9);

// ---------- Component ----------
const ImageAnalyzer = ({ onClose, onSave, slotId, isVertical, initialData }) => {
  // App state
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

  // Pending detections (paired axis + kp8)
  const [pendingDetections, setPendingDetections] = useState([]);

  // Dragging/inputs
  const draggingRef = useRef(null);
  const lastInteractionTime = useRef(0);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

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
    if (initialData?.processedImage) {
      setProcessedImage(initialData.processedImage);
      setCompletedReports(initialData.reports || []);
      setStep(ProcessingStep.ANNOTATE);
    }
  }, [initialData]);

  // Faded overlay for pending list
  const drawAIPendingOverlay = (ctx) => {
    const alpha = 0.45;
    pendingDetections.forEach(det => {
      if (det.status !== 'pending') return;
      const [a, b] = det.axis;
      const pts = [det.aiPoints.crownTip, det.aiPoints.cej, det.aiPoints.boneLevel, det.aiPoints.rootApex];

      ctx.save();
      ctx.globalAlpha = alpha;

      // Axis
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(37,99,235,1)';
      ctx.stroke();
      ctx.setLineDash([]);

      // Points + rays
      pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
        ctx.fillStyle = pointColors[i];
        ctx.fill();

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

  // Drawing
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

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (step === ProcessingStep.KEYSTONE && originalImage) {
      ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#00FFFF';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(keystonePoints[0].x, keystonePoints[0].y);
      for (let i = 1; i < 4; i++) ctx.lineTo(keystonePoints[i].x, keystonePoints[i].y);
      ctx.closePath(); ctx.stroke();
      keystonePoints.forEach(p => {
        ctx.fillStyle = '#00FFFF';
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI); ctx.fill();
      });
      return;
    }

    if (step === ProcessingStep.ANNOTATE && processedImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Pending overlay (dashed axes + faded points)
        if (pendingDetections.length) drawAIPendingOverlay(ctx);

        // Greyed-out completed (other teeth)
        completedReports.forEach(r => {
          if (r.id !== activeTooth?.id) drawAnalysisLines(ctx, r, '#888888');
        });

        // Active tooth
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
      };
      img.src = processedImage;
    }
  }, [
    originalImage, step, keystonePoints, processedImage,
    pendingDetections,
    annotationPoints, activeTooth, completedReports, toothAxisPoints, mousePos, annotationSubStep, usePaAnalysis
  ]);

  useEffect(() => { draw(); }, [draw]);

  // Pointer interactions
  const near = (p, q, r = 12) => Math.hypot(p.x - q.x, p.y - q.y) <= r;

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleInteractionStart = (e) => {
    const now = Date.now();
    if (now - lastInteractionTime.current < 50) return;
    lastInteractionTime.current = now;
    if (!e.isPrimary) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = getCanvasPoint(e);

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

  // File handlers
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          const img = new Image();
          img.onload = () => {
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
  };

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
    if (fileInputRef.current) fileInputRef.current.value = '';
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
    setStep(ProcessingStep.ANNOTATE);
  };

  // Manual analyze
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

    setCompletedReports(prev => [...prev.filter(r => r.id !== activeTooth.id), newReport]);
    setActiveTooth(null);
    setAnnotationSubStep('SELECT');
    setToothAxisPoints([]);
    setAnnotationPoints([]);
  };

  const handleSave = () => {
    if (!processedImage) return;
    onSave({ id: slotId, processedImage, reports: completedReports });
    onClose();
  };

  const selectToothForAnalysis = (toothNumber, side) => {
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

  // ---------- Single "AI Analyze" (combined) ----------
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

    const kp8Det = parseDetectionsFromONNX(res8, kp8Session, 8, letterbox);
      const axDet  = parseDetectionsFromONNX(res2, kp2Session, 2, letterbox);
    if (kp8Det.length === 0 || axDet.length === 0) {
      alert('AI could not detect any teeth/landmarks. Please adjust crop or annotate manually.');
      return;
    }

    const pairs = pairDetectionsByIoU(axDet, kp8Det);
    const toCanvas = toCanvasMapper(img, canvasRef.current);

    // For EACH tooth, create TWO pending detections (share the same axis)
    const newDetections = pairs.flatMap(({ axis, kp8 }) => {
        const A1 = axis.points[0]; // Directly use the point
        const A2 = axis.points[1]; // Directly use the point
        
        const K = kp8.points;
        const crown = K[0]; 
      const apex  = K[4];

      // Use your two CEJ candidates (K[1] and K[7]) as the two sides
      const cejL = K[1];
      const cejR = K[7];

      // Put bone on the axis at the midpoint between CEJ and Apex (by axis parameter t)
      const tApex = projScalar(apex, A1, A2);
      const tCejL = projScalar(cejL, A1, A2);
      const tCejR = projScalar(cejR, A1, A2);
      const boneL = pointAtT(A1, A2, (tApex + tCejL) / 2);
      const boneR = pointAtT(A1, A2, (tApex + tCejR) / 2);

      // Return TWO detections (side-agnostic; you choose M/D in the UI)
      return [
        {
          id: makeId(),
          axis: [A1, A2],
          aiPoints: { crownTip: crown, cej: cejL, boneLevel: boneL, rootApex: apex },
          status: 'pending'
        },
        {
          id: makeId(),
          axis: [A1, A2],
          aiPoints: { crownTip: crown, cej: cejR, boneLevel: boneR, rootApex: apex },
          status: 'pending'
        }
      ];
    });

    // If you want to REPLACE previous pending results, use setPendingDetections(newDetections)
    setPendingDetections(prev => [...prev, ...newDetections]);
  } catch (e) {
    console.error('AI analysis failed', e);
    alert(`AI analysis failed: ${e?.message ?? 'Unknown error'}`);
  } finally {
    setIsAnalyzingAi(false);
  }
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
            <div className="flex justify-center items-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-6 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border"
              >
                <UploadIcon className="w-12 h-12 text-blue-600" />
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
              onPointerLeave={(e) => { setMousePos(null); handleInteractionEnd(e); }}
            ></canvas>
            <div className="text-center mt-4">
              <button onClick={processKeystone} className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-semibold transition-colors">
                Confirm & Crop
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
                  <button
                    onClick={runAiAnalyze}
                    disabled={aiModelsLoading || !processedImage || isAnalyzingAi}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-gray-400"
                    title="Run AI analysis"
                  >
                    <MagicWandIcon className={`w-4 h-4 ${isAnalyzingAi ? 'animate-spin' : ''}`} />
                    <span>{isAnalyzingAi ? 'Analyzing…' : 'AI Analyze'}</span>
                  </button>
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
                ref={canvasRef}
                width={isVertical ? 360 : 480}
                height={isVertical ? 480 : 360}
                className="bg-gray-900 mx-auto rounded-md cursor-crosshair touch-none"
                onPointerDown={handleInteractionStart}
                onPointerMove={handleInteractionMove}
                onPointerUp={handleInteractionEnd}
                onPointerCancel={handleInteractionEnd}
                onPointerLeave={(e) => { setMousePos(null); handleInteractionEnd(e); }}
              ></canvas>
            </div>

            <div className="md:col-span-1 flex flex-col">
              {pendingDetections.length > 0 && (
                <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <h4 className="font-semibold text-purple-800 mb-2 flex items-center gap-2">
  <MagicWandIcon className="w-4 h-4" />
  AI Pending Detections ({pendingDetections.filter(d => d.status === 'pending').length})
</h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {pendingDetections.map(det => (
                      <div key={det.id} className="bg-white rounded border p-2">
                        <p className="text-xs text-gray-600 mb-2">
                          Status: <span className="font-semibold">{det.status}</span>
                        </p>
                        <div className="flex items-center gap-2">
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            defaultValue={det.assigned?.toothNumber ?? ''}
                            onChange={(e) => det.assigned = { ...(det.assigned || {}), toothNumber: e.target.value, side: det.assigned?.side ?? 'M' }}
                          >
                            <option value="" disabled>Tooth</option>
                            {teethInSlot.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select
                            className="border rounded px-2 py-1 text-sm"
                            defaultValue={det.assigned?.side ?? 'M'}
                            onChange={(e) => det.assigned = { ...(det.assigned || {}), toothNumber: det.assigned?.toothNumber ?? '', side: e.target.value }}
                          >
                            <option value="M">M</option>
                            <option value="D">D</option>
                          </select>
                          <button
                            className="px-2 py-1 text-sm rounded bg-blue-600 text-white hover:bg-blue-700"
                            onClick={() => {
                              const t = det.assigned?.toothNumber;
                              const s = det.assigned?.side;
                              if (!t || !s) { alert('Select tooth and side.'); return; }
                              assignDetectionToTooth(det.id, t, s);
                            }}
                          >
                            Set & Refine
                          </button>
                          <button
                            className="px-2 py-1 text-sm rounded bg-gray-200 hover:bg-gray-300"
                            onClick={() => discardDetection(det.id)}
                          >
                            Discard
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold mb-2 text-gray-800">1. Select a tooth area to analyze/edit:</h4>
                <div className="flex flex-wrap gap-2">
                  {teethInSlot.map(tooth => {
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
                </div>
              </div>

              {activeTooth && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2 text-gray-800">
                    Analysis for Tooth {activeTooth.number} ({activeTooth.side === 'M' ? 'Mesial' : 'Distal'}):
                  </h4>

                  {annotationSubStep === 'DRAW_AXIS' && <p className="text-sm text-gray-600">Defining axis… ({toothAxisPoints.length}/2 points)</p>}

                  {annotationSubStep === 'PLACE_POINTS' && (
                    <>
                      <ul className="space-y-2">
                        {(usePaAnalysis ? annotationLabels : annotationLabels.slice(1)).map((label, i) => (
                          <li key={label} className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border border-gray-400" style={{ backgroundColor: pointColors[usePaAnalysis ? i : i + 1] }}></span>
                            <span className={`${annotationPoints.length > i ? 'line-through text-gray-400' : 'text-gray-700'}`}>{label}</span>
                            {annotationPoints.length === i && <span className="text-blue-600 animate-pulse font-bold">&larr; Current</span>}
                          </li>
                        ))}
                      </ul>

                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={() => { setAnnotationPoints([]); setToothAxisPoints([]); setAnnotationSubStep('DRAW_AXIS'); }}
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
                <button onClick={handleSave} className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold text-lg">
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
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 z-10 p-1 rounded-full bg-gray-100 hover:bg-gray-200">
          <CloseIcon className="w-6 h-6" />
        </button>
        {renderStepContent()}
      </div>
    </div>
  );
};

export default ImageAnalyzer;
