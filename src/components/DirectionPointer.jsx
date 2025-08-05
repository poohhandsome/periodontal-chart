// src/components/DirectionPointer.jsx
import React from 'react';

const DirectionPointer = ({ startLabel, endLabel, isReversed }) => {
  const ArrowIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Flip the arrow horizontally if the direction is reversed
      transform={isReversed ? 'scale(-1, 1)' : ''}
      style={{ transformOrigin: 'center' }}
    >
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  );

  return (
    <div className="absolute inset-0 flex items-center justify-center text-blue-600 font-semibold text-sm select-none pointer-events-none">
      <div className="bg-blue-50/80 backdrop-blur-sm rounded-full px-4 py-1 flex items-center gap-2 shadow">
        {isReversed ? (
          <>
            <span>{endLabel}</span>
            <ArrowIcon />
            <span>{startLabel}</span>
          </>
        ) : (
          <>
            <span>{startLabel}</span>
            <ArrowIcon />
            <span>{endLabel}</span>
          </>
        )}
      </div>
    </div>
  );
};

export default DirectionPointer;
