import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ProcessingStep, PrognosisLevel } from '../../xray-types';
import { UploadIcon, CameraIcon, CloseIcon, RedoIcon } from './Icons';
import { slotConfigurations } from '../../xray-config';

// --- MODIFIED ---: Updated labels for the new 5-point system
const paAnnotationLabels = ["Crown Tip", "CEJ", "Bone Level", "Root Apex", "Physiologic Bone Level"];
const bwAnnotationLabels = ["Tooth Axis Point", "CEJ", "Bone Level"];

// --- MODIFIED ---: Added a 5th color for the new point
const pointColors = ['#00FFFF', '#FF00FF', '#FFFF00', '#00FF00', '#FFA500']; // Crown, CEJ, Bone, Apex, Physio Bone

const projectPointOnLine = (p, a, b) => {
    const atob = { x: b.x - a.x, y: b.y - a.y };
    const atop = { x: p.x - a.x, y: p.y - a.y };
    const len = atob.x * atob.x + atob.y * atob.y;
    if (len === 0) return a;
    const dot = atop.x * atob.x + atop.y * atob.y;
    const t = Math.max(0, Math.min(1, dot / len));
    return { x: a.x + atob.x * t, y: a.y + atob.y * t };
};

const PIXELS_PER_MM = 12;

const ImageAnalyzer = ({ onClose, onSave, slotId, isVertical, initialData }) => {
  const [step, setStep] = useState(ProcessingStep.UPLOAD);
  const [originalImage, setOriginalImage] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [keystonePoints, setKeystonePoints] = useState([
    { x: 100, y: 100 }, { x: 400, y: 100 }, { x: 400, y: 400 }, { x: 100, y: 400 },
  ]);
  const [canvasSize, setCanvasSize] = useState({ width: 500, height: 500 });
  
  const [annotationSubStep, setAnnotationSubStep] = useState('SELECT');
  const [activeTooth, setActiveTooth] = useState(null);
  const [completedReports, setCompletedReports] = useState([]);
  const [toothAxisPoints, setToothAxisPoints] = useState([]);
  const [annotationPoints, setAnnotationPoints] = useState([]);
  
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const draggingPointIndex = useRef(null);
  const [mousePos, setMousePos] = useState(null);
  const lastInteractionTime = useRef(0);

  const analysisType = slotConfigurations[slotId].analysisType;
  const usePaAnalysis = analysisType === 'PA';
  const annotationLabels = usePaAnalysis ? paAnnotationLabels : bwAnnotationLabels;


  useEffect(() => {
    if (initialData) {
      setProcessedImage(initialData.processedImage);
      setCompletedReports(initialData.reports || []);
      setStep(ProcessingStep.ANNOTATE);
    }
  }, [initialData]);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (step === ProcessingStep.KEYSTONE && originalImage) {
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#00FFFF';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(keystonePoints[0].x, keystonePoints[0].y);
        for(let i=1; i<4; i++) { ctx.lineTo(keystonePoints[i].x, keystonePoints[i].y); }
        ctx.closePath();
        ctx.stroke();
        keystonePoints.forEach(p => {
            ctx.fillStyle = '#00FFFF';
            ctx.beginPath();
            ctx.arc(p.x, p.y, 10, 0, 2 * Math.PI);
            ctx.fill();
        });
    } else if (step === ProcessingStep.ANNOTATE && processedImage) {
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            completedReports.forEach(r => {
                if(r.id !== activeTooth?.id) {
                    drawAnalysisLines(ctx, r, '#888888');
                }
            });
            if (activeTooth) {
                if (toothAxisPoints.length > 0) {
                    ctx.beginPath();
                    ctx.moveTo(toothAxisPoints[0].x, toothAxisPoints[0].y);
                    const endPoint = toothAxisPoints.length === 2 ? toothAxisPoints[1] : (annotationSubStep === 'DRAW_AXIS' && mousePos ? mousePos : null);
                    if (endPoint) {
                        ctx.lineTo(endPoint.x, endPoint.y);
                    }
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
                        ctx.strokeStyle = pointColors[usePaAnalysis ? i : i+1];
                        ctx.lineWidth = 1;
                        ctx.setLineDash([2,2]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, 6, 0, 2*Math.PI);
                        ctx.fillStyle = pointColors[usePaAnalysis ? i : i+1];
                        ctx.fill();
                    });
                    if (mousePos && annotationSubStep === 'PLACE_POINTS' && annotationPoints.length < (usePaAnalysis ? 5 : 2)) {
                        const projectedP = projectPointOnLine(mousePos, toothAxisPoints[0], toothAxisPoints[1]);
                        ctx.beginPath();
                        ctx.moveTo(mousePos.x, mousePos.y);
                        ctx.lineTo(projectedP.x, projectedP.y);
                        ctx.strokeStyle = pointColors[usePaAnalysis ? annotationPoints.length : annotationPoints.length + 1];
                        ctx.lineWidth = 1;
                        ctx.setLineDash([2, 2]);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                }
            }
        };
        img.src = processedImage;
    }
  }, [originalImage, step, keystonePoints, processedImage, annotationPoints, activeTooth, completedReports, toothAxisPoints, mousePos, annotationSubStep, usePaAnalysis]);

  useEffect(() => { draw(); }, [draw]);

  const handleInteractionStart = (e) => {
    const now = Date.now();
    if (now - lastInteractionTime.current < 50) return;
    lastInteractionTime.current = now;
    if (!e.isPrimary) return;
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    const p = getCanvasPoint(e);
    if (step === ProcessingStep.KEYSTONE) {
        const pointIndex = keystonePoints.findIndex((kp) => Math.hypot(kp.x - p.x, kp.y - p.y) < 12);
        if (pointIndex !== -1) draggingPointIndex.current = pointIndex;
    } else if (step === ProcessingStep.ANNOTATE && activeTooth) {
        if (annotationSubStep === 'DRAW_AXIS') {
            const newPoints = [...toothAxisPoints, p];
            setToothAxisPoints(newPoints);
            if (newPoints.length === 2) setAnnotationSubStep('PLACE_POINTS');
        } else if (annotationSubStep === 'PLACE_POINTS' && annotationPoints.length < (usePaAnalysis ? 5 : 2)) {
            setAnnotationPoints([...annotationPoints, p]);
        }
    }
  };

  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const handleInteractionMove = (e) => {
    const p = getCanvasPoint(e);
    setMousePos(p);
    if (draggingPointIndex.current !== null && canvasRef.current?.hasPointerCapture(e.pointerId)) {
        if (step === ProcessingStep.KEYSTONE) {
            const newPoints = [...keystonePoints];
            newPoints[draggingPointIndex.current] = p;
            setKeystonePoints(newPoints);
        }
    }
  };

  const handleInteractionEnd = (e) => { 
    if(canvasRef.current?.hasPointerCapture(e.pointerId)) canvasRef.current.releasePointerCapture(e.pointerId);
    draggingPointIndex.current = null;
  };

  // THIS FUNCTION IS NOW SIMPLIFIED
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
            const marginX = newWidth * 0.2;
            const marginY = newHeight * 0.2;
            setKeystonePoints([{ x: marginX, y: marginY }, { x: newWidth - marginX, y: marginY }, { x: newWidth - marginX, y: newHeight - marginY }, { x: marginX, y: newHeight - marginY }]);
            setStep(ProcessingStep.KEYSTONE);
          };
          img.src = event.target.result;
        }
      };
      reader.readAsDataURL(file);
    }
  };
  
  // NEW FUNCTION TO HANDLE RESETTING THE STATE
  const handleStartOver = () => {
    setStep(ProcessingStep.UPLOAD);
    setOriginalImage(null);
    setProcessedImage(null);
    setCompletedReports([]);
    setActiveTooth(null);
    setToothAxisPoints([]);
    setAnnotationPoints([]);
    setAnnotationSubStep('SELECT');
    // Reset file input value to allow re-uploading the same file
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const processKeystone = () => {
    if (!originalImage) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const targetWidth = isVertical ? 360 : 480;
    const targetHeight = isVertical ? 480 : 360;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = targetWidth;
    tempCanvas.height = targetHeight;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;
    const p = keystonePoints.map(point => ({ x: point.x * (originalImage.width / canvas.width), y: point.y * (originalImage.height / canvas.height) }));
    const drawTriangle = (p1, p2, p3, t1, t2, t3) => {
        tempCtx.save(); tempCtx.beginPath(); tempCtx.moveTo(p1.x, p1.y); tempCtx.lineTo(p2.x, p2.y); tempCtx.lineTo(p3.x, p3.y); tempCtx.closePath(); tempCtx.clip();
        const det = t1.x * (t2.y - t3.y) + t2.x * (t3.y - t1.y) + t3.x * (t1.y - t2.y);
        const a = (p1.x * (t2.y - t3.y) + p2.x * (t3.y - t1.y) + p3.x * (t1.y - t2.y)) / det; const b = (p1.x * (t3.x - t2.x) + p2.x * (t1.x - t3.x) + p3.x * (t2.x - t1.x)) / det; const c = p1.x * (t2.x*t3.y - t3.x*t2.y) + p2.x * (t3.x*t1.y - t1.x*t3.y) + p3.x * (t1.x*t2.y - t2.x*t1.y);
        const d = (p1.y * (t2.y - t3.y) + p2.y * (t3.y - t1.y) + p3.y * (t1.y - t2.y)) / det; const e = (p1.y * (t3.x - t2.x) + p2.y * (t1.x - t3.x) + p3.y * (t2.x - t1.x)) / det; const f = p1.y * (t2.x*t3.y - t3.x*t2.y) + p2.y * (t3.x*t1.y - t1.x*t3.y) + p3.y * (t1.x*t2.y - t2.x*t1.y);
        tempCtx.transform(a, d, b, e, c/det, f/det); tempCtx.drawImage(originalImage, 0, 0); tempCtx.restore();
    };
    const d1 = {x: 0, y: 0}, d2 = {x: targetWidth, y: 0}, d3 = {x: targetWidth, y: targetHeight}, d4 = {x: 0, y: targetHeight};
    drawTriangle(d1, d2, d4, p[0], p[1], p[3]); drawTriangle(d2, d3, d4, p[1], p[2], p[3]);
    setProcessedImage(tempCanvas.toDataURL());
    setStep(ProcessingStep.ANNOTATE);
  };
  
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
      let severity = 'Mild';
      if (adjustedRblPercent > 50) severity = 'Severe';
      else if (adjustedRblPercent >= 25) severity = 'Moderate';
      
      const attachmentLossMm = (adjustedBoneLossLen / PIXELS_PER_MM).toFixed(2);
      
      reportData = {
          crownRootRatio,
          rblPercentForStaging,
          stage,
          adjustedRblPercent,
          severity,
          attachmentLossMm,
          prognosis: severity === 'Mild' ? PrognosisLevel.GOOD : severity === 'Moderate' ? PrognosisLevel.FAIR : PrognosisLevel.POOR,
      };

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
      reportData = { prognosis, attachmentLossMm: distanceInMm.toFixed(2), crownRootRatio: 'N/A', rblPercentForStaging: -1, };
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
    resetAnnotationState();
  };

  const handleSave = () => {
    if (!processedImage) return;
    onSave({ id: slotId, processedImage, reports: completedReports });
    onClose();
  };

  const resetAnnotationState = () => {
    setActiveTooth(null);
    setAnnotationSubStep('SELECT');
    setToothAxisPoints([]);
    setAnnotationPoints([]);
  }
  
  const selectToothForAnalysis = (toothNumber, side) => {
    const id = `${toothNumber}${side}`;
    const existingReport = completedReports.find(r => r.id === id);

    if(existingReport) {
        setToothAxisPoints(existingReport.axis);
        setAnnotationPoints(existingReport.annotations);
        setAnnotationSubStep('PLACE_POINTS');
    } else {
        setToothAxisPoints([]);
        setAnnotationPoints([]);
        setAnnotationSubStep('DRAW_AXIS');
    }
    setActiveTooth({ number: toothNumber, side, id });
  }

  const renderStepContent = () => {
    switch(step) {
      case ProcessingStep.UPLOAD: return ( 
        <div className="text-center"> 
          <h3 className="text-xl font-semibold mb-4 text-gray-800">Upload X-Ray</h3> 
          <div className="flex justify-center items-center gap-4"> 
            <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 p-6 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border"> 
              <UploadIcon className="w-12 h-12 text-blue-600" />
              <span>Upload File</span> 
            </button> 
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/png, image/jpeg" className="hidden" /> 
            <p className="font-bold text-gray-500">OR</p> 
            <button onClick={() => alert("Camera capture coming soon!")} className="flex flex-col items-center gap-2 p-6 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors border"> 
              <CameraIcon className="w-12 h-12 text-blue-600" />
              <span>Use Camera</span> 
            </button> 
          </div> 
        </div> 
      );
      case ProcessingStep.KEYSTONE: return ( <div> <h3 className="text-lg font-semibold mb-2 text-center text-gray-800">Step 1: Align Film Corners</h3> <p className="text-sm text-center text-gray-600 mb-4">Drag the handles to the corners of the X-ray film. Works with touch.</p> <canvas ref={canvasRef} width={canvasSize.width} height={canvasSize.height} className="bg-gray-900 mx-auto rounded-md cursor-crosshair touch-none" onPointerDown={handleInteractionStart} onPointerMove={handleInteractionMove} onPointerUp={handleInteractionEnd} onPointerCancel={handleInteractionEnd} onPointerLeave={(e) => { setMousePos(null); handleInteractionEnd(e); }} ></canvas> <div className="text-center mt-4"> <button onClick={processKeystone} className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-md font-semibold transition-colors">Confirm & Crop</button> </div> </div> );
      case ProcessingStep.ANNOTATE:
        const teethInSlot = slotConfigurations[slotId].teeth;
        let instruction = 'Select a tooth area (M or D) to begin.';
        const requiredPoints = usePaAnalysis ? 5 : 2;
        if (activeTooth) {
            const sideText = activeTooth.side === 'M' ? 'Mesial' : 'Distal';
            if(annotationSubStep === 'DRAW_AXIS') { instruction = `Place 2 points to define the long axis for T${activeTooth.number} (${sideText}).`; } 
            else if (annotationSubStep === 'PLACE_POINTS' && annotationPoints.length < requiredPoints) {
                const labelIndex = usePaAnalysis ? annotationPoints.length : annotationPoints.length + 1;
                instruction = `Place the ${annotationLabels[labelIndex]} point for T${activeTooth.number} (${sideText}).`;
            } else { instruction = `Analysis for T${activeTooth.number} (${sideText}) complete.` }
        }
        return (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-lg font-semibold text-center text-gray-800">Step 2: Analyze Teeth</h3>
                {/* THIS BUTTON NOW CALLS handleStartOver */}
                <button 
                  onClick={handleStartOver} 
                  className="flex items-center gap-2 px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded-md text-sm font-semibold"
                >
                  <RedoIcon className="w-4 h-4" />
                  Change Image
                </button>
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
              <div>
                <h4 className="font-semibold mb-2 text-gray-800">1. Select a tooth area to analyze/edit:</h4>
                <div className="flex flex-wrap gap-2">
                    {teethInSlot.map(tooth => {
                        const reportM = completedReports.find(r => r.id === `${tooth}M`);
                        const reportD = completedReports.find(r => r.id === `${tooth}D`);

                        const getButtonClass = (report) => {
                            if (!report?.prognosis) return "bg-gray-200 hover:bg-gray-300 text-gray-700";
                            if (report.prognosis.startsWith(PrognosisLevel.GOOD) || report.prognosis.startsWith('Normal')) return 'bg-green-100 text-green-800 hover:bg-green-200';
                            if (report.prognosis.startsWith(PrognosisLevel.FAIR) || report.prognosis.startsWith('Early')) return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200';
                            if (report.prognosis.startsWith(PrognosisLevel.POOR) || report.prognosis.startsWith('Moderate')) return 'bg-orange-100 text-orange-800 hover:bg-orange-200';
                            return 'bg-red-100 text-red-800 hover:bg-red-200';
                        };
                        
                        const activeClassM = activeTooth?.id === `${tooth}M` ? "ring-2 ring-offset-2 ring-blue-500" : "";
                        const activeClassD = activeTooth?.id === `${tooth}D` ? "ring-2 ring-offset-2 ring-blue-500" : "";

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
                        )
                    })}
                </div>
              </div>
              {activeTooth && ( <div className="mt-4"> 
                <h4 className="font-semibold mb-2 text-gray-800">Analysis for Tooth {activeTooth.number} ({activeTooth.side === 'M' ? 'Mesial' : 'Distal'}):</h4> 
                {annotationSubStep === 'DRAW_AXIS' && <p className="text-sm text-gray-600">Defining axis... ({toothAxisPoints.length}/2 points)</p>} {annotationSubStep === 'PLACE_POINTS' && ( <> <ul className="space-y-2"> {(usePaAnalysis ? annotationLabels : annotationLabels.slice(1)).map((label, i) => ( <li key={label} className="flex items-center gap-2"><span className="w-4 h-4 rounded-full border border-gray-400" style={{ backgroundColor: pointColors[usePaAnalysis ? i : i+1] }}></span><span className={`${annotationPoints.length > i ? 'line-through text-gray-400' : 'text-gray-700'}`}>{label}</span>{annotationPoints.length === i && <span className="text-blue-600 animate-pulse font-bold">&larr; Current</span>}</li> ))} </ul> <div className="mt-4 flex gap-2"> <button onClick={() => { setAnnotationPoints([]); setToothAxisPoints([]); setAnnotationSubStep('DRAW_AXIS'); }} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-sm">Reset</button> {annotationPoints.length === requiredPoints && ( <button onClick={analyzePoints} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-semibold">Analyze T{activeTooth.number}{activeTooth.side}</button> )} </div> </> )} </div> )}
              {completedReports.length > 0 && ( <div className="mt-4 bg-gray-50 p-3 rounded-lg flex-grow border"> <h4 className="font-semibold text-gray-800 mb-2">Completed Analyses:</h4> 
              <div className="space-y-2 text-sm overflow-y-auto max-h-96"> 
                {completedReports.sort((a,b) => a.toothNumber.localeCompare(b.toothNumber) || a.side.localeCompare(b.side)).map(r => ( 
                    <div key={r.id} className="bg-white p-2 rounded border border-gray-200 shadow-sm">
                        <p className="font-bold text-base text-gray-800">T{r.toothNumber}{r.side}: 
                            <span className={`font-bold ml-2 ${ r.stage === 'Stage I' ? 'text-green-600' : r.stage === 'Stage II' ? 'text-yellow-600' : 'text-red-600' }`}>
                                {r.stage || r.prognosis}
                            </span>
                        </p>
                        {r.rblPercentForStaging !== -1 ? (
                            <div className="text-xs text-gray-600 mt-1 space-y-0.5">
                                <p><strong>Loss:</strong> {r.attachmentLossMm}mm ({r.severity})</p>
                                <p><strong>C:R Ratio:</strong> {r.crownRootRatio}</p>
                                <p><strong>Staging RBL:</strong> {r.rblPercentForStaging}% | <strong>Adjusted RBL:</strong> {r.adjustedRblPercent}%</p>
                            </div>
                        ) : (
                            <p className="text-xs text-gray-500">Loss: {r.attachmentLossMm}mm</p>
                        )}
                    </div> 
                ))} 
              </div> 
              </div> )}
               <div className="mt-auto pt-4"> <button onClick={handleSave} className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-semibold text-lg">Save All & Close</button> </div>
            </div>
          </div>
        );
    }
  };

  
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
