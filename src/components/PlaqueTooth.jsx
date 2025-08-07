// src/components/PlaqueTooth.jsx
import React from 'react';

const PlaqueTooth = ({ toothId, toothData, isMissing, onClick, isEditMode }) => {
    const editModeClass = isEditMode ? 'relative after:absolute after:inset-0 after:bg-red-500/20 after:cursor-pointer' : '';

    if (isMissing) {
        return (
            <div className={`flex flex-col items-center gap-1 ${editModeClass}`} onClick={() => onClick(toothId)}>
                <div className="w-10 h-10 bg-gray-300 rounded-md flex items-center justify-center">
                    <span className="text-gray-500 text-xs select-none">Missing</span>
                </div>
                <div className="text-xs font-mono select-none">{toothId}</div>
            </div>
        );
    }

    return (
        <div className={`flex flex-col items-center gap-1 ${editModeClass}`}>
            <svg width="40" height="40" viewBox="0 0 40 40" className="cursor-pointer">
                <g>
                    {/* Mesial (Top Triangle) */}
                    <path
                        d="M 0 0 L 40 0 L 20 20 Z"
                        fill={toothData.m ? '#EF4444' : '#E5E7EB'}
                        stroke="#9CA3AF"
                        strokeWidth="0.5"
                        onClick={() => onClick(toothId, 'm')}
                        className="hover:opacity-75 transition-opacity"
                    />
                    {/* Distal (Bottom Triangle) */}
                    <path
                        d="M 0 40 L 40 40 L 20 20 Z"
                        fill={toothData.d ? '#EF4444' : '#E5E7EB'}
                        stroke="#9CA3AF"
                        strokeWidth="0.5"
                        onClick={() => onClick(toothId, 'd')}
                        className="hover:opacity-75 transition-opacity"
                    />
                    {/* Buccal (Left Triangle) */}
                    <path
                        d="M 0 0 L 0 40 L 20 20 Z"
                        fill={toothData.b ? '#EF4444' : '#E5E7EB'}
                        stroke="#9CA3AF"
                        strokeWidth="0.5"
                        onClick={() => onClick(toothId, 'b')}
                        className="hover:opacity-75 transition-opacity"
                    />
                    {/* Lingual (Right Triangle) */}
                    <path
                        d="M 40 0 L 40 40 L 20 20 Z"
                        fill={toothData.l ? '#EF4444' : '#E5E7EB'}
                        stroke="#9CA3AF"
                        strokeWidth="0.5"
                        onClick={() => onClick(toothId, 'l')}
                        className="hover:opacity-75 transition-opacity"
                    />
                </g>
            </svg>
            <div className="text-xs font-mono select-none">{toothId}</div>
        </div>
    );
};

export default PlaqueTooth;