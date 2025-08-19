// src/components/xray-analyzer/AIPreAnalyzeModal.jsx
import React, { useEffect, useRef, useState } from 'react';
import * as ort from 'onnxruntime-web';

// --- ORT & Model Configuration (Identical to ONNXPage) ---
ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
ort.env.logLevel = 'warning';
const KP8_MODEL = '/best.onnx';
const KP2_MODEL = '/tooth-axis.onnx';
// --- 8-KP index map (your training order)
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
export default function AIPreAnalyzeModal({ isOpen, onClose, onContinue }) {
  // --- State and Refs (Mirrors ONNXPage) ---
  const [kp8Session, setKp8Session] = useState(null);
  const [kp2Session, setKp2Session] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // For model loading
  const [isAnalyzing, setIsAnalyzing] = useState(false); // For analysis running
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const inputImageRef = useRef(null); // Holds the HTMLImageElement
  const analysisResultsRef = useRef([]); // To store the final structured detections

  // --- Model Loading (Identical to ONNXPage) ---
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      try {
        const [s8, s2] = await Promise.all([
          ort.InferenceSession.create(KP8_MODEL),
          ort.InferenceSession.create(KP2_MODEL),
        ]);
        if (!cancelled) { setKp8Session(s8); setKp2Session(s2); }
      } catch (e) {
        if (!cancelled) setError(`Failed to load models: ${e?.message ?? 'Unknown error'}`);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen]);
  
  // --- NEW: Geometry Helpers (for calculating results) ---
  const projScalar = (P, A, B) => {
    const abx = B.x - A.x, aby = B.y - A.y;
    const apx = P.x - A.x, apy = P.y - A.y;
    const denom = (abx*abx + aby*aby) || 1e-6;
    return (apx*abx + apy*aby) / denom;
  };
  const pointAtT = (A, B, t) => ({ x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) });
  const makeId = () => Math.random().toString(36).slice(2, 9);


  // --- Image Handling and Drawing (Mirrors ONNXPage) ---
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target.result;
      setImageUrl(url);
      const img = new Image();
      img.onload = () => {
        inputImageRef.current = img;
        drawInitialImage(img);
        analysisResultsRef.current = []; // Clear previous results
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const drawInitialImage = (img) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
  };

  // --- Pre-processing (Identical to ONNXPage) ---
  const buildNCHW3x640Float = (img) => {
    const W = 640, H = 640;
    const can = document.createElement('canvas');
    can.width = W; can.height = H;
    const ctx = can.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const ratio = Math.min(W / img.width, H / img.height);
    const newW = Math.round(img.width * ratio);
    const newH = Math.round(img.height * ratio);
    const ox = Math.floor((W - newW) / 2);
    const oy = Math.floor((H - newH) / 2);
    ctx.drawImage(img, ox, oy, newW, newH);
    const { data } = ctx.getImageData(0, 0, W, H);
    const plane = W * H;
    const arr = new Float32Array(3 * plane);
    for (let i = 0, p = 0; i < plane; i++, p += 4) {
      arr[i] = data[p] / 255;
      arr[i + plane] = data[p + 1] / 255;
      arr[i + 2 * plane] = data[p + 2] / 255;
    }
    return { tensor: new ort.Tensor('float32', arr, [1, 3, H, W]), letterbox: { ratio, ox, oy } };
  };

  // --- NMS Helper (Identical to ONNXPage) ---
  const nonMaxSuppression = (boxes, scores, iouThreshold) => {
    const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
    const keep = [], suppressed = Array(scores.length).fill(false);
    for (const i of order) {
      if (suppressed[i]) continue;
      keep.push(i);
      for (const j of order) {
        if (i === j || suppressed[j]) continue;
        const [x1,y1,x2,y2] = boxes[i]; const [X1,Y1,X2,Y2] = boxes[j];
        const ix1=Math.max(x1,X1), iy1=Math.max(y1,Y1), ix2=Math.min(x2,X2), iy2=Math.min(y2,Y2);
        const inter = Math.max(0, ix2-ix1) * Math.max(0, iy2-iy1);
        const a1=(x2-x1)*(y2-y1), a2=(X2-X1)*(Y2-Y1);
        const iou = inter / (a1 + a2 - inter);
        if (iou > iouThreshold) suppressed[j] = true;
      }
    }
    return keep;
  };

  const extendLineToCanvasBounds = (p1, p2, width, height) => {
    let x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
    if (Math.abs(x1 - x2) < 1e-6) return [{ x: x1, y: 0 }, { x: x1, y: height }];
    if (Math.abs(y1 - y2) < 1e-6) return [{ x: 0, y: y1 }, { x: width, y: y1 }];
    const m = (y2 - y1) / (x2 - x1); const b = y1 - m * x1;
    const intersections = [];
    let x_y0 = (0 - b) / m; if (x_y0 >= 0 && x_y0 <= width) intersections.push({ x: x_y0, y: 0 });
    let x_yh = (height - b) / m; if (x_yh >= 0 && x_yh <= width) intersections.push({ x: x_yh, y: height });
    let y_x0 = m * 0 + b; if (y_x0 >= 0 && y_x0 <= height) intersections.push({ x: 0, y: y_x0 });
    let y_xw = m * width + b; if (y_xw >= 0 && y_xw <= height) intersections.push({ x: width, y: y_xw });
    return intersections.length >= 2 ? [intersections[0], intersections[1]] : null;
  };

  // --- Main Analysis Logic ---
  const runAnalysis = async () => {
    if (isAnalyzing || !kp8Session || !kp2Session || !inputImageRef.current) return;
    setIsAnalyzing(true); setError(null); analysisResultsRef.current = [];

    try {
      const img = inputImageRef.current;
      const { tensor, letterbox } = buildNCHW3x640Float(img);

      const kp8Res = await kp8Session.run({ [kp8Session.inputNames[0]]: tensor });
      await Promise.resolve();
      const kp2Res = await kp2Session.run({ [kp2Session.inputNames[0]]: tensor });

      const canvas = canvasRef.current; const ctx = canvas.getContext('2d');
      drawInitialImage(img);

      const { ratio, ox, oy } = letterbox; const scale = 1 / ratio;
      const xOffset = ox, yOffset = oy; const confTh = 0.3, iouTh = 0.45;

      const processModelOutput = (results, session, numKeypoints) => {
        const outName = session.outputNames?.[0];
        const tensor = outName ? results[outName] : null; if (!tensor || tensor.dims.length !== 3) return [];
        const dims = tensor.dims, nCand = dims[2], data = tensor.data; const get = (k, i) => data[k*nCand+i];
        const boxes=[], scores=[], keypoints=[];
        for (let i=0; i<nCand; i++) {
            if (get(4,i) < confTh) continue;
            const cx=get(0,i), cy=get(1,i), w=get(2,i), h=get(3,i);
            boxes.push([(cx-w/2-xOffset)*scale, (cy-h/2-yOffset)*scale, (cx+w/2-xOffset)*scale, (cy+h/2-yOffset)*scale]);
            scores.push(get(4,i));
            const pts=[];
            for (let j=0; j<numKeypoints; j++) { pts.push({ x:(get(5+j*3,i)-xOffset)*scale, y:(get(6+j*3,i)-yOffset)*scale, s:get(7+j*3,i) }); }
            keypoints.push(pts);
        }
        const keep = nonMaxSuppression(boxes, scores, iouTh);
        return keep.map(idx => ({ box:boxes[idx], points:keypoints[idx] }));
      };

      const kp8Detections = processModelOutput(kp8Res, kp8Session, 8);
      const kp2Detections = processModelOutput(kp2Res, kp2Session, 2);
      
      const fusedResults = []; // This will hold the structured data

      for (const axisDetection of kp2Detections) {
        const axisPoints = axisDetection.points;
        if (axisPoints.length !== 2 || !axisPoints.every(p => p.s > 0.2)) continue;
        const [A1, A2] = axisPoints;

        // Draw the blue axis line for visual feedback
        const extendedPoints = extendLineToCanvasBounds(A1, A2, canvas.width, canvas.height);
        if (extendedPoints) {
            ctx.beginPath(); ctx.moveTo(extendedPoints[0].x, extendedPoints[0].y); ctx.lineTo(extendedPoints[1].x, extendedPoints[1].y);
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.7)'; ctx.lineWidth = 2; ctx.stroke();
        }

        let bestMatch = null, minDistance = Infinity;
        const axisCenter = { x: (A1.x + A2.x)/2, y: (A1.y + A2.y)/2 };
        for (const kp8 of kp8Detections) {
            const boxCenter = { x: (kp8.box[0] + kp8.box[2])/2, y: (kp8.box[1] + kp8.box[3])/2 };
            const distance = Math.hypot(axisCenter.x-boxCenter.x, axisCenter.y-boxCenter.y);
            if (distance < minDistance) { minDistance = distance; bestMatch = kp8; }
        }
        
        if (bestMatch && minDistance < 200) {
  const K = bestMatch.points;

  // 8-KP landmarks (image-pixel coords)
  const crownM = K[KP8_IDX.crownM];
  const cejM   = K[KP8_IDX.cejM];
  const boneM  = K[KP8_IDX.boneM];
  const apexM  = K[KP8_IDX.apexM];

  const crownD = K[KP8_IDX.crownD];
  const cejD   = K[KP8_IDX.cejD];
  const boneD  = K[KP8_IDX.boneD];
  const apexD  = K[KP8_IDX.apexD];

  // Orient the axis separately for each side (end nearer the side’s crown becomes "crown")
  const dist = (P, Q) => Math.hypot(P.x - Q.x, P.y - Q.y);

  let crownAxisM = A1, apexAxisM = A2;
  if (dist(A1, crownM) > dist(A2, crownM)) { crownAxisM = A2; apexAxisM = A1; }

  let crownAxisD = A1, apexAxisD = A2;
  if (dist(A1, crownD) > dist(A2, crownD)) { crownAxisD = A2; apexAxisD = A1; }

  // Emit two side-specific detections using 8-KP landmarks; keep axis for reference/projection
  fusedResults.push({
    id: makeId(),
    axis: [crownAxisM, apexAxisM],
    aiPoints: { crownTip: crownM, cej: cejM, boneLevel: boneM, rootApex: apexM },
    status: 'pending',
  });

  fusedResults.push({
    id: makeId(),
    axis: [crownAxisD, apexAxisD],
    aiPoints: { crownTip: crownD, cej: cejD, boneLevel: boneD, rootApex: apexD },
    status: 'pending',
  });
            // Also draw the points for immediate visual feedback
            ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)'; ctx.lineWidth = 2;
            for (const p of bestMatch.points) {
                if (p.s < 0.2) continue;
                ctx.fillStyle = 'rgba(255, 0, 0, 0.95)'; ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, 2*Math.PI); ctx.fill();
                const k = ((A2.y-A1.y)*(p.x-A1.x) - (A2.x-A1.x)*(p.y-A1.y)) / (Math.pow(A2.y-A1.y,2) + Math.pow(A2.x-A1.x,2));
                const perpPoint = { x: p.x-k*(A2.y-A1.y), y: p.y+k*(A2.x-A1.x) };
                ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(perpPoint.x, perpPoint.y); ctx.stroke();
            }
        }
      }
      analysisResultsRef.current = fusedResults;
      // --- 🔽 ADD THIS CONSOLE LOG HERE 🔽 ---
      if (fusedResults.length > 0) {
        console.log(
          '%c--- DATA FROM AI PRE-ANALYZE (BEFORE MAPPING) ---',
          'color: lime; font-weight: bold;',
          {
            imageDimensions: {
              width: inputImageRef.current.naturalWidth,
              height: inputImageRef.current.naturalHeight,
            },
            firstDetection: fusedResults[0],
          }
        );
      }
      // --- 🔼 END OF CONSOLE LOG 🔼 ---
       // Store the final structured data
    } catch (e) {
      console.error(e); setError(`Analysis failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // --- UI Rendering ---
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-xl p-6 flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">AI Pre-Analysis</h2>
          <button onClick={onClose} className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200">Close</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold">1. Upload X-Ray</h3>
            <input type="file" accept="image/*" onChange={handleFileChange} className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
            <hr/>
            <h3 className="text-lg font-semibold">2. Run Analysis</h3>
            <button onClick={runAnalysis} disabled={isLoading || isAnalyzing || !imageUrl} className="w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
              {isLoading ? 'Loading Models...' : (isAnalyzing ? 'Analyzing...' : 'Start AI Analysis')}
            </button>
            {error && <p className="text-red-600 text-sm mt-2">{error}</p>}
            <div className="mt-auto">
                 <button
                    onClick={() => {
                        if (!inputImageRef.current || !imageUrl || analysisResultsRef.current.length === 0) return;
                        onContinue({
                            imageDataUrl: imageUrl,
                            imageWidth: inputImageRef.current.naturalWidth,
                            imageHeight: inputImageRef.current.naturalHeight,
                            detections: analysisResultsRef.current, // Pass the structured data
                        });
                    }}
                    className="w-full px-4 py-2 rounded-md bg-emerald-600 text-white disabled:bg-gray-300"
                    disabled={analysisResultsRef.current.length === 0}
                >
                    Use these results → Continue
                </button>
            </div>
          </div>
          <div className="bg-gray-200 border rounded-lg p-2 overflow-auto flex items-center justify-center">
            <canvas ref={canvasRef} className="max-w-full max-h-full" />
            {!imageUrl && <div className="text-center text-gray-500">Image preview appears here</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
