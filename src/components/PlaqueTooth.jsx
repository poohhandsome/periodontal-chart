// src/components/PlaqueTooth.jsx
import React from 'react';

const PlaqueSite = ({ side, hasPlaque, onClick }) => (
    <div
        onClick={onClick}
        className={`w-1/2 h-1/2 flex items-center justify-center cursor-pointer 
                    ${hasPlaque ? 'bg-red-500' : 'bg-gray-200'}
                    ${side === 'm' ? 'rounded-tl-md' : ''}
                    ${side === 'd' ? 'rounded-tr-md' : ''}
                    ${side === 'b' ? 'rounded-bl-md' : ''}
                    ${side === 'l' ? 'rounded-br-md' : ''}
                    hover:bg-red-300 transition-colors`}
    >
    </div>
);

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
            <div className="w-10 h-10 flex flex-wrap border border-gray-400 rounded-md overflow-hidden">
                <PlaqueSite side="m" hasPlaque={toothData.m} onClick={() => onClick(toothId, 'm')} />
                <PlaqueSite side="d" hasPlaque={toothData.d} onClick={() => onClick(toothId, 'd')} />
                <PlaqueSite side="b" hasPlaque={toothData.b} onClick={() => onClick(toothId, 'b')} />
                <PlaqueSite side="l" hasPlaque={toothData.l} onClick={() => onClick(toothId, 'l')} />
            </div>
            <div className="text-xs font-mono select-none">{toothId}</div>
        </div>
    );
};

export default PlaqueTooth;