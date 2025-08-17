// src/pages/XRayAnalysisONNXPage.jsx
import React, { useState, useRef, useEffect } from 'react';
import * as ort from 'onnxruntime-web';

// ORT runtime
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/";
ort.env.logLevel = 'warning';

// --- Constants for both models ---
const KP8_MODEL = '/best.onnx';        // 8-point model
const KP2_MODEL = '/tooth-axis.onnx';  // 2-point model

const XRayAnalysisONNXPage = () => {
  const [kp8Session, setKp8Session] = useState(null);
  const [kp2Session, setKp2Session] = useState(null);
  const initialized = useRef(false);

  const [image, setImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const canvasRef = useRef(null);
  const inputImageRef = useRef(null);   // holds the HTMLImageElement
  const isAnalyzing = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        // Load both models in parallel is fine
        const [kp8, kp2] = await Promise.all([
          ort.InferenceSession.create(KP8_MODEL, { executionProviders: ['wasm'] }),
          ort.InferenceSession.create(KP2_MODEL, { executionProviders: ['wasm'] })
        ]);
        console.log('8-Point Model I/O', kp8.inputNames, kp8.outputNames);
        console.log('2-Point Model I/O', kp2.inputNames, kp2.outputNames);
        setKp8Session(kp8);
        setKp2Session(kp2);
      } catch (e) {
        console.error(e);
        setError('Failed to load one or more models.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target.result;
      setImage(url);
      const img = new Image();
      img.onload = () => {
        inputImageRef.current = img;
        drawInitialImage(img);
      };
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const drawInitialImage = (img) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);
  };

  // Letterbox to 3x640x640 float32 NCHW
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
      const r = data[p], g = data[p + 1], b = data[p + 2];
      arr[i] = r / 255; arr[i + plane] = g / 255; arr[i + 2 * plane] = b / 255;
    }
    return { tensor: new ort.Tensor('float32', arr, [1, 3, H, W]), letterbox: { ratio, ox, oy } };
  };

  const feedFor = (session, tensor) => ({ [session.inputNames?.[0] || 'images']: tensor });

  const runAnalysis = async () => {
    if (isAnalyzing.current) return;
    isAnalyzing.current = true;

    // Guard: sessions and image must exist
    if (!kp8Session || !kp2Session) {
      setError('Models are not loaded yet.');
      isAnalyzing.current = false;
      return;
    }
    if (!inputImageRef.current) {
      setError('Please upload an image first.');
      isAnalyzing.current = false;
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { tensor, letterbox } = buildNCHW3x640Float(inputImageRef.current);

      // IMPORTANT: run SEQUENTIALLY to avoid “session already started”
      const kp8Res = await kp8Session.run(feedFor(kp8Session, tensor));
      // Optional tiny yield to UI/event loop
      await Promise.resolve();
      const kp2Res = await kp2Session.run(feedFor(kp2Session, tensor));

      postprocessCombinedOutput(kp8Res, kp2Res, inputImageRef.current, kp8Session, kp2Session, letterbox);
    } catch (e) {
      console.error(e);
      // Typical message here was: “session already started”
      setError(`Analysis failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      isAnalyzing.current = false;
    }
  };

  const nonMaxSuppression = (boxes, scores, iouThreshold) => {
    const order = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
    const keep = [], suppressed = Array(scores.length).fill(false);
    for (const i of order) {
      if (suppressed[i]) continue;
      keep.push(i);
      for (const j of order) {
        if (i === j || suppressed[j]) continue;
        const [x1,y1,x2,y2] = boxes[i];
        const [X1,Y1,X2,Y2] = boxes[j];
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
  const extendLineToCanvasBounds = (p1, p2, width, height) => {
    let x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;

    // Handle vertical and horizontal lines to avoid division by zero
    if (Math.abs(x1 - x2) < 1e-6) { // Vertical line
        return [{ x: x1, y: 0 }, { x: x1, y: height }];
    }
    if (Math.abs(y1 - y2) < 1e-6) { // Horizontal line
        return [{ x: 0, y: y1 }, { x: width, y: y1 }];
    }

    const m = (y2 - y1) / (x2 - x1); // Slope
    const b = y1 - m * x1;          // Y-intercept

    const intersections = [];
    // Check intersection with top edge (y=0)
    let x = (0 - b) / m;
    if (x >= 0 && x <= width) intersections.push({ x, y: 0 });
    // Check intersection with bottom edge (y=height)
    x = (height - b) / m;
    if (x >= 0 && x <= width) intersections.push({ x, y: height });
    // Check intersection with left edge (x=0)
    let y = m * 0 + b;
    if (y >= 0 && y <= height) intersections.push({ x: 0, y });
    // Check intersection with right edge (x=width)
    y = m * width + b;
    if (y >= 0 && y <= height) intersections.push({ x: width, y });

    // Return the first two unique intersection points found
    if (intersections.length >= 2) {
        return [intersections[0], intersections[1]];
    }
    return null; // Should not happen in a normal case
};
  const postprocessCombinedOutput = (kp8Results, kp2Results, originalImage, kp8Session, kp2Session, letterbox) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    drawInitialImage(originalImage);

    const { ratio, ox, oy } = letterbox;
    const scale = 1 / ratio;
    const xOffset = ox;
    const yOffset = oy;
    const confTh = 0.3, iouTh = 0.45;

    // Helper function to process raw model output into a structured format
    const processModelOutput = (results, session, numKeypoints) => {
        const outName = session.outputNames?.[0];
        const tensor = outName ? results[outName] : null;
        if (!tensor || tensor.dims.length !== 3) return [];

        const dims = tensor.dims, nCand = dims[2], data = tensor.data;
        const get = (k, i) => data[k * nCand + i];
        
        const boxes = [], scores = [], keypoints = [];
        for (let i = 0; i < nCand; i++) {
            if (get(4, i) < confTh) continue;
            const cx = get(0, i), cy = get(1, i), w = get(2, i), h = get(3, i);
            boxes.push([(cx - w / 2 - xOffset) * scale, (cy - h / 2 - yOffset) * scale, (cx + w / 2 - xOffset) * scale, (cy + h / 2 - yOffset) * scale]);
            scores.push(get(4, i));
            const pts = [];
            for (let j = 0; j < numKeypoints; j++) {
                pts.push({
                    x: (get(5 + j * 3, i) - xOffset) * scale,
                    y: (get(6 + j * 3, i) - yOffset) * scale,
                    s: get(7 + j * 3, i)
                });
            }
            keypoints.push(pts);
        }
        
        const keep = nonMaxSuppression(boxes, scores, iouTh);
        const detections = [];
        for (const idx of keep) {
            detections.push({ box: boxes[idx], points: keypoints[idx] });
        }
        return detections;
    };

    // 1. Process both models to get clean lists of detections
    const kp8Detections = processModelOutput(kp8Results, kp8Session, 8);
    const kp2Detections = processModelOutput(kp2Results, kp2Session, 2);

    // 2. Loop through each detected axis
    for (const axisDetection of kp2Detections) {
        const axisPoints = axisDetection.points;
        if (axisPoints.length !== 2 || !axisPoints.every(p => p.s > 0.2)) continue;

        const crownTip = axisPoints[0];
        const rootApex = axisPoints[1];

        // Draw the extended blue axis line
        const extendedPoints = extendLineToCanvasBounds(crownTip, rootApex, canvas.width, canvas.height);
        if (extendedPoints) {
            ctx.beginPath();
            ctx.moveTo(extendedPoints[0].x, extendedPoints[0].y);
            ctx.lineTo(extendedPoints[1].x, extendedPoints[1].y);
            ctx.strokeStyle = 'rgba(0, 150, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        // Draw the two keypoints for the axis itself in blue
        for (const p of axisPoints) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(0, 0, 255, 0.8)';
            ctx.fill();
        }

        // Find the best matching 8-point detection for this axis
        let bestMatch = null;
        let minDistance = Infinity;
        const axisCenter = { x: (crownTip.x + rootApex.x) / 2, y: (crownTip.y + rootApex.y) / 2 };

        for (const kp8 of kp8Detections) {
            const box = kp8.box;
            const boxCenter = { x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2 };
            const distance = Math.sqrt(Math.pow(axisCenter.x - boxCenter.x, 2) + Math.pow(axisCenter.y - boxCenter.y, 2));
            if (distance < minDistance) {
                minDistance = distance;
                bestMatch = kp8;
            }
        }
        
        // If a close enough match is found...
        if (bestMatch && minDistance < 200) {
            // --- MODIFIED DRAWING LOGIC ---
            // Loop through each of the 8 points in the matched detection
            for (const p of bestMatch.points) {
                if (p.s < 0.2) continue;

                // 1. Draw the red keypoint
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5, 0, 2 * Math.PI);
                ctx.fillStyle = 'rgba(255, 0, 0, 0.95)';
                ctx.fill();

                // 2. Calculate its perpendicular line to the axis
                const p1 = crownTip, p2 = rootApex, p3 = p; // p3 is now the current keypoint
                const k = ((p2.y - p1.y) * (p3.x - p1.x) - (p2.x - p1.x) * (p3.y - p1.y)) / (Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));
                const perpendicularPoint = { x: p3.x - k * (p2.y - p1.y), y: p3.y + k * (p2.x - p1.x) };

                // 3. Draw the yellow perpendicular line
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(perpendicularPoint.x, perpendicularPoint.y);
                ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)'; // Yellow
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }
    }
};

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto bg-white p-6 rounded-xl shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-blue-700">Combined AI X-Ray Analysis</h1>
          <a href="#" className="text-blue-600 hover:underline">&larr; Back to Home</a>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-2">1. Upload X-Ray</h2>
            <input
              type="file" accept="image/*" onChange={handleFileChange}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-xs text-gray-500 mt-2">Your image is processed on your device and never uploaded.</p>
            <hr className="my-6" />
            <h2 className="text-xl font-semibold mb-2">2. Run Combined Analysis</h2>
            <button
              onClick={runAnalysis}
              disabled={isLoading || !image}
              className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Analyzing...' : 'Start AI Analysis'}
            </button>
            {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
          </div>
          <div className="bg-gray-200 border border-gray-300 rounded-lg p-2">
            <canvas ref={canvasRef} className="w-full h-auto" />
            {!image && <div className="text-center text-gray-500 p-20">Image preview appears here</div>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default XRayAnalysisONNXPage;
