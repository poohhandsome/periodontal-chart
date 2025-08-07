// src/components/Tooth.jsx

import React from 'react';
import { UPPER_LEFT, LOWER_LEFT } from '../chart.config';

// Constants for drawing measurements. PIXELS_PER_MM is the scale.
const SVG_WIDTH = 48;
const SVG_HEIGHT = 100;
const CEJ_Y = 50; // The vertical center, where the CEJ of your image should be.
const PIXELS_PER_MM = 5;
const SITE_WIDTH = SVG_WIDTH / 3;

// Helper to get the correct site keys ('db', 'b', 'mb' or 'dl', 'l', 'ml')
const getSiteKeys = (surface) => surface === 'buccal' ? ['db', 'b', 'mb'] : ['dl', 'l', 'ml'];

const Tooth = ({ toothId, surface, arch, toothData, onSiteClick, activeSite, isEditMode }) => {
  const isLeftSide = UPPER_LEFT.includes(toothId) || LOWER_LEFT.includes(toothId);

  // The keys for data access remain constant
  const dataSiteKeys = getSiteKeys(surface);

  // The keys for VISUAL display are reversed for the left side of the mouth
  const displaySiteKeys = isLeftSide ? [...dataSiteKeys].reverse() : dataSiteKeys;

  // This direction variable correctly handles the measurement logic for the upper arch.
  const direction = arch === 'upper' ? -1 : 1;

  // Function to calculate the points for the recession line, now uses display keys
  const getLinePoints = (dataArray) => {
    return displaySiteKeys.map((site, index) => {
        const val = dataArray[site] ?? 0;
        const x = index * SITE_WIDTH + SITE_WIDTH / 2;
        const y = CEJ_Y + (val * PIXELS_PER_MM * direction);
        return `${x},${y}`;
      }).join(' ');
  };

  const recessionPoints = getLinePoints(toothData.re);

  // --- CORRECTED MGJ LOGIC ---
  const mgjValue = toothData.mgj.b;
  const centralRecession = toothData.re['b'] ?? 0;
  let mgjPoints = '';
  if (surface === 'buccal' && mgjValue) {
      const mgj_Y = CEJ_Y + ((centralRecession + mgjValue) * PIXELS_PER_MM * direction);
      mgjPoints = `0,${mgj_Y} ${SVG_WIDTH},${mgj_Y}`;
  }

  const editModeClass = isEditMode ? 'relative after:absolute after:inset-0 after:bg-red-500/20 after:cursor-pointer' : '';

  return (
    <div className={`flex flex-col items-center h-full ${editModeClass}`} onClick={() => isEditMode && onSiteClick(toothId, surface, dataSiteKeys[0])}>
      {arch === 'lower' && <div className="text-xs font-mono select-none h-4">{toothId}</div>}
      <div className="bg-white text-gray-800 rounded-sm text-center relative flex-1 w-full">
        <svg width="100%" height="100%" viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}>
          {/* Grid lines for measurement reference */}
          <g className="grid">
            {Array.from({ length: 15 }).map((_, i) => (<line key={`grid-${i}`} x1="0" y1={CEJ_Y + (i - 7) * PIXELS_PER_MM} x2={SVG_WIDTH} y2={CEJ_Y + (i - 7) * PIXELS_PER_MM} stroke={i === 7 ? '#ccc' : '#E5E7EB'} strokeWidth="0.5"/>))}
          </g>
          
          <image
            href={`/teeth/${toothId}.png`}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            className="opacity-25"
          />

          {/* Vertical lines for Pocket Depth - uses display keys for position */}
          <g className="pocket-depth-lines">
            {displaySiteKeys.map((site, index) => {
              const pd = toothData.pd[site] ?? 0;
              const re = toothData.re[site] ?? 0;
              if (pd >= 4) {
                const x = index * SITE_WIDTH + SITE_WIDTH / 2;
                const startY = CEJ_Y + (re * PIXELS_PER_MM * direction);
                const endY = startY + (pd * PIXELS_PER_MM * direction);
                return (
                  <line
                    key={`pd-line-${site}`}
                    x1={x}
                    y1={startY}
                    x2={x}
                    y2={endY}
                    stroke="#3B82F6"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                );
              }
              return null;
            })}
          </g>

          <polyline points={recessionPoints} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>

          {mgjPoints && <polyline points={mgjPoints} fill="none" stroke="#374151" strokeWidth="1.5" strokeDasharray="2 2"/>}
           
          {/* Bleeding and Suppuration Indicators - uses display keys for position */}
          <g className="indicators">
                {displaySiteKeys.map((site, index) => {
                    const x = index * SITE_WIDTH + (SITE_WIDTH / 2); const recessionY = CEJ_Y + (toothData.re[site] ?? 0) * PIXELS_PER_MM * direction; const y = recessionY - (4 * direction);
                    if (toothData.bleeding[site]) return <circle key={`bop-${site}`} cx={x} cy={y} r="2.5" fill="#EF4444" />;
                    return null;
                })}
            </g>

          {/* Transparent layer for click interactions - uses display keys for position but passes back correct data key */}
          <g className="interaction-layer">
            {displaySiteKeys.map((site, index) => {
              const isActive = activeSite && activeSite.toothId === toothId && activeSite.surface === surface && activeSite.site === site;
              return (<rect key={`interactive-${site}`} x={index * SITE_WIDTH} y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="transparent" onClick={() => !isEditMode && onSiteClick(toothId, surface, site)}
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