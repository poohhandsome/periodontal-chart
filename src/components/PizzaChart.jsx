// src/components/PizzaChart.jsx

import React from 'react';

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
  const sites = ['db', 'b', 'mb', 'ml', 'l', 'dl']; // Order of slices

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
      {/* Apply rotation to the SVG element */}
      <svg
        width={radius * 2}
        height={radius * 2}
        viewBox={`0 0 ${radius * 2} ${radius * 2}`}
        style={{ transform: `rotate(${rotation}deg)` }}
        className="transition-transform duration-300"
      >
        {sites.map((site, i) => (
          <path
            key={i}
            d={getSlicePath(i, radius)}
            fill={bleedingData[site] ? '#EF4444' : '#f3f4f6'}
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