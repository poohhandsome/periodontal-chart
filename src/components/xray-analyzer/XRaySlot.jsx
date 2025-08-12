import React, { useRef, useEffect } from 'react';
import { PrognosisLevel } from '../../xray-types';
import { CameraIcon } from './Icons';

const pointColors = ['#00FFFF', '#FF00FF', '#FFFF00', '#00FF00']; // Crown, CEJ, Bone, Apex

const getPrognosisColor = (prognosis) => {
    switch(prognosis) {
        case PrognosisLevel.GOOD: return 'border-green-500';
        case PrognosisLevel.FAIR: return 'border-yellow-500';
        case PrognosisLevel.POOR: return 'border-orange-500';
        case PrognosisLevel.QUESTIONABLE: return 'border-red-500';
        default: return 'border-gray-400';
    }
}

const getPrognosisCharColor = (prognosis) => {
    switch(prognosis) {
        case PrognosisLevel.GOOD: return 'text-green-300';
        case PrognosisLevel.FAIR: return 'text-yellow-300';
        case PrognosisLevel.POOR: return 'text-orange-300';
        case PrognosisLevel.QUESTIONABLE: return 'text-red-400';
        default: return 'text-gray-300';
    }
}

const getWorstPrognosis = (reports) => {
    if (reports.length === 0) return PrognosisLevel.NOT_AVAILABLE;
    const levels = [PrognosisLevel.GOOD, PrognosisLevel.FAIR, PrognosisLevel.POOR, PrognosisLevel.QUESTIONABLE];
    const worstLevelIndex = Math.max(...reports.map(r => levels.indexOf(r.prognosis)));
    return levels[worstLevelIndex];
};

const projectPointOnLine = (p, a, b) => {
    const atob = { x: b.x - a.x, y: b.y - a.y };
    const atop = { x: p.x - a.x, y: p.y - a.y };
    const len = atob.x * atob.x + atob.y * atob.y;
    if (len === 0) return a;
    const dot = atop.x * atob.x + atop.y * atob.y;
    const t = Math.max(0, Math.min(1, dot / len));
    return { x: a.x + atob.x * t, y: a.y + atob.y * t };
};


const XRaySlot = ({ slot, onClick, isVertical, label }) => {
  const aspectRatio = isVertical ? 'aspect-[3/4]' : 'aspect-[4/3]';
  const worstPrognosis = getWorstPrognosis(slot.reports);
  const borderColor = getPrognosisColor(worstPrognosis);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const image = imageRef.current;
    if (!canvas || !image || !slot.processedImage || slot.reports.length === 0) {
        if(canvas) {
            const ctx = canvas.getContext('2d');
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
        return;
    };

    const draw = () => {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        canvas.width = image.clientWidth;
        canvas.height = image.clientHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const scaleX = canvas.width / (isVertical ? 360 : 480);
        const scaleY = canvas.height / (isVertical ? 480 : 360);

        slot.reports.forEach(report => {
            const scalePoint = (p) => ({x: p.x * scaleX, y: p.y * scaleY});
            
            const [axisStart, axisEnd] = report.axis.map(scalePoint);
            const annotations = report.annotations.map(scalePoint);

            ctx.beginPath();
            ctx.moveTo(axisStart.x, axisStart.y);
            ctx.lineTo(axisEnd.x, axisEnd.y);
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1;
            ctx.stroke();

            annotations.forEach((p, i) => {
                const projectedP = projectPointOnLine(p, axisStart, axisEnd);
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(projectedP.x, projectedP.y);
                ctx.strokeStyle = pointColors[i];
                ctx.lineWidth = 0.8;
                ctx.setLineDash([1, 2]);
                ctx.stroke();
                ctx.setLineDash([]);
                
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.5, 0, 2 * Math.PI);
                ctx.fillStyle = pointColors[i];
                ctx.fill();
            });
        });
    }

    if (image.complete) {
        draw();
    } else {
        image.onload = draw;
    }
    
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);

  }, [slot.reports, slot.processedImage, isVertical]);


  return (
    <button
      onClick={() => onClick(slot.id)}
      className={`relative rounded-md overflow-hidden transition-all duration-300 ease-in-out bg-gray-500 border-2 border-dashed hover:border-blue-500 hover:bg-gray-400 ${aspectRatio} ${
        slot.reports.length > 0 ? borderColor + ' border-solid' : 'border-gray-400'
      }`}
      aria-label={`X-ray slot for ${label}`}
    >
      {slot.processedImage ? (
        <>
          <img ref={imageRef} src={slot.processedImage} alt={`Analyzed X-ray for ${label}`} className="w-full h-full object-cover" />
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"></canvas>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 right-0 p-1">
            <div className="flex flex-wrap content-start gap-x-1.5 gap-y-0 text-white text-left">
                {/* --- MODIFIED CODE --- */}
                {slot.reports.sort((a,b) => a.toothNumber.localeCompare(b.toothNumber) || a.side.localeCompare(b.side)).map(report => (
                    <p key={report.id} className="font-bold text-xs shadow-black [text-shadow:1px_1px_2px_var(--tw-shadow-color)]">
                        <span className="text-gray-300">T{report.toothNumber}{report.side}:</span> <span className={getPrognosisCharColor(report.prognosis)}>{report.prognosis.charAt(0)}</span>
                    </p>
                ))}
                {/* --- END MODIFIED CODE --- */}
            </div>
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col justify-center items-center text-gray-300 p-1">
            <CameraIcon className="w-6 h-6 mb-1"/>
            <span className="text-xs text-center leading-tight">{label}</span>
        </div>
      )}
    </button>
  );
};

export default XRaySlot;