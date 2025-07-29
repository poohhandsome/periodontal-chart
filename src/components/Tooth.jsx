// src/components/Tooth.jsx

import React from 'react';

// ... (Constants, helpers, and ToothGraphic are unchanged)
const SVG_WIDTH = 48; const SVG_HEIGHT = 100; const CEJ_Y = 50; const PIXELS_PER_MM = 5; const SITE_WIDTH = SVG_WIDTH / 3;
const getSiteKeys = (surface) => surface === 'buccal' ? ['db', 'b', 'mb'] : ['dl', 'l', 'ml'];
const ToothGraphic = ({ arch }) => {
    const toothPath = "M15,35 C15,30 18,25 24,25 C30,25 33,30 33,35 L33,50 C33,55 30,60 27,62 L21,62 C18,60 15,55 15,50 Z";
    const transform = arch === 'upper' ? `translate(0, ${SVG_HEIGHT}) scale(1, -1)` : '';
    return (<g transform={transform} className="tooth-graphic opacity-5"><path d={toothPath} fill="#a0a0a0" /></g>)
}


const Tooth = ({ toothId, surface, arch, toothData, onSiteClick, activeSite, isEditMode }) => {
  const siteKeys = getSiteKeys(surface);
  const direction = arch === 'upper' ? -1 : 1;

  // ... (getLinePoints, recessionPoints, mgjPoints are unchanged)
  const getLinePoints = (dataArray) => {
    return siteKeys.map((site, index) => {
        const val = dataArray[site] ?? 0;
        const x = index * SITE_WIDTH + SITE_WIDTH / 2;
        const y = CEJ_Y + (val * PIXELS_PER_MM * direction);
        return `${x},${y}`;
      }).join(' ');
  };
  const recessionPoints = getLinePoints(toothData.re);
  const mgjValue = toothData.mgj.b;
  const mgjPoints = (surface === 'buccal' && mgjValue) ? `0,${CEJ_Y + (mgjValue * PIXELS_PER_MM * direction)} ${SVG_WIDTH},${CEJ_Y + (mgjValue * PIXELS_PER_MM * direction)}` : '';

  // Apply a red overlay in edit mode
  const editModeClass = isEditMode ? 'relative after:absolute after:inset-0 after:bg-red-500/20 after:cursor-pointer' : '';

  return (
    <div className={`flex flex-col items-center h-full ${editModeClass}`} onClick={() => isEditMode && onSiteClick(toothId, surface, siteKeys[0])}>
      {arch === 'lower' && <div className="text-xs font-mono select-none h-4">{toothId}</div>}
      <div className="bg-white text-gray-800 rounded-sm text-center relative flex-1 w-full">
        <svg width="100%" height="100%" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
          {/* ... (SVG content is the same) ... */}
           <g className="grid">
            {Array.from({ length: 15 }).map((_, i) => (<line key={`grid-${i}`} x1="0" y1={CEJ_Y + (i - 7) * PIXELS_PER_MM} x2={SVG_WIDTH} y2={CEJ_Y + (i - 7) * PIXELS_PER_MM} stroke={i === 7 ? '#ccc' : '#E5E7EB'} strokeWidth="0.5"/>))}
          </g>
          <ToothGraphic arch={arch} />
          <g className="pd-shading">
            {siteKeys.map((site, index) => {
              const pd = toothData.pd[site] ?? 0; const re = toothData.re[site] ?? 0;
              if (pd >= 4) {
                const x = index * SITE_WIDTH; const reY = CEJ_Y + (re * PIXELS_PER_MM * direction); const pdHeight = pd * PIXELS_PER_MM * direction;
                return (<rect key={`pd-${site}`} x={x} y={Math.min(reY, reY + pdHeight)} width={SITE_WIDTH} height={Math.abs(pdHeight)} fill="rgba(59, 130, 246, 0.3)" />);
              } return null;
            })}
          </g>
          <polyline points={recessionPoints} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
          {mgjPoints && <polyline points={mgjPoints} fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="2 2"/>}
           <g className="indicators">
                {siteKeys.map((site, index) => {
                    const x = index * SITE_WIDTH + (SITE_WIDTH / 2); const recessionY = CEJ_Y + (toothData.re[site] ?? 0) * PIXELS_PER_MM * direction; const y = recessionY - (4 * direction);
                    if (toothData.bleeding[site]) return <circle key={`bop-${site}`} cx={x} cy={y} r="2.5" fill="#EF4444" />;
                    return null;
                })}
            </g>
          <g className="interaction-layer">
            {siteKeys.map((site, index) => {
              const isActive = activeSite && activeSite.toothId === toothId && activeSite.surface === surface && activeSite.site === site;
              return (<rect key={`interactive-${site}`} x={index * SITE_WIDTH} y="0" width={SITE_WIDTH} height={SVG_HEIGHT} fill="transparent" onClick={() => !isEditMode && onSiteClick(toothId, surface, site)}
                  className={`cursor-pointer transition-colors ${isActive ? 'fill-blue-500/20' : 'hover:fill-blue-500/10'}`} />)
            })}
          </g>
        </svg>
      </div>
      {arch === 'upper' && <div className="text-xs font-mono select-none h-4 mt-1">{toothId}</div>}
    </div>
  );
};

export default Tooth;