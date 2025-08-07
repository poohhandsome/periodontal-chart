// src/components/PizzaChart.jsx

import React from 'react';
import { UPPER_LEFT, LOWER_LEFT, LOWER_RIGHT } from '../chart.config';

// Helper function to calculate the x, y coordinates for a point on a circle
const getCoords = (angle, radius) => {
  const radians = ((angle - 90) * Math.PI) / 180;
  return {
    x: radius + radius * Math.cos(radians),
    y: radius + radius * Math.sin(radians),
  };
};

// Helper function to generate the SVG path for a 60-degree pizza slice
const getSlicePath = (sliceIndex, radius) => {
  const startAngle = sliceIndex * 60;
  const endAngle = startAngle + 60;

  const start = getCoords(startAngle, radius);
  const end = getCoords(endAngle, radius);

  // Path commands: M(ove) to center, L(ine) to arc start, A(rc) to arc end, Z(close path)
  return `M${radius},${radius} L${start.x},${start.y} A${radius},${radius} 0 0 1 ${end.x},${end.y} Z`;
};

// Add 'rotation' prop
const PizzaChart = ({ toothId, bleedingData = {}, isMissing = false, rotation = 0 }) => {
  const radius = 20;
  
  // The Pizza Chart has a fixed anatomical layout: Distal-Buccal is always the first slice.
  // We need to map the bleeding data correctly to this fixed layout.
  const anatomicalSites = ['db', 'b', 'mb', 'ml', 'l', 'dl'];

  const getBleedingStatusForSlice = (site) => {
    let key = site;
    const isUpperLeft = UPPER_LEFT.includes(toothId);
    const isLowerLeft = LOWER_LEFT.includes(toothId);
    const isLowerRight = LOWER_RIGHT.includes(toothId);

    // For Q2 (Upper Left), the buccal and lingual sides are flipped.
    if (isUpperLeft) {
      if (site === 'db') key = 'mb';
      else if (site === 'mb') key = 'db';
      else if (site === 'dl') key = 'ml';
      else if (site === 'ml') key = 'dl';
    }
    
    // For Q3 (Lower Left), only the buccal side is flipped relative to the chart's visual flow.
    if (isLowerLeft) {
        if (site === 'db') key = 'mb';
        else if (site === 'mb') key = 'db';
    }
    
    // For Q4 (Lower Right), only the lingual side is flipped.
    if (isLowerRight) {
        if (site === 'dl') key = 'ml';
        else if (site === 'ml') key = 'dl';
    }
    
    return bleedingData[key];
  };


  if (isMissing) {
    return (
        <div className="flex flex-col items-center">
            <svg width={radius * 2} height={radius * 2} viewBox={`0 0 ${radius * 2} ${radius * 2}`}>
                <circle cx={radius} cy={radius} r={radius-1} fill="#e5e7eb" />
            </svg>
            <div className="text-xs text-gray-400 font-mono mt-1">{toothId}</div>
        </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg
        width={radius * 2}
        height={radius * 2}
        viewBox={`0 0 ${radius * 2} ${radius * 2}`}
        style={{ transform: `rotate(${rotation}deg)` }}
        className="transition-transform duration-300"
      >
        {anatomicalSites.map((site, i) => (
          <path
            key={i}
            d={getSlicePath(i, radius)}
            fill={getBleedingStatusForSlice(site) ? '#EF4444' : '#f3f4f6'}
            stroke="#d1d5db"
            strokeWidth="1"
          />
        ))}
      </svg>
      <div className="text-xs text-gray-700 font-mono mt-1">{toothId}</div>
    </div>
  );
};

export default PizzaChart;