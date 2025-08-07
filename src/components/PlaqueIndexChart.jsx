// src/components/PlaqueIndexChart.jsx
import React from 'react';
import PlaqueTooth from './PlaqueTooth';
import { UPPER_RIGHT_PLAQUE, UPPER_LEFT_PLAQUE, LOWER_LEFT_PLAQUE, LOWER_RIGHT_PLAQUE } from '../plaque.config';

const Quadrant = ({ teeth, plaqueData, missingTeeth, onToothClick, isEditMode }) => (
    <div className="grid grid-cols-8 gap-1 md:gap-2">
        {teeth.map(toothId => (
            <PlaqueTooth
                key={toothId}
                toothId={toothId}
                toothData={plaqueData[toothId]}
                isMissing={missingTeeth.includes(toothId)}
                onClick={onToothClick}
                isEditMode={isEditMode}
            />
        ))}
    </div>
);

const PlaqueIndexChart = ({ plaqueData, missingTeeth, onToothClick, isEditMode }) => {
    return (
        <div className="bg-white p-4 rounded-xl shadow-lg space-y-4">
            {/* Maxillary Arch */}
            <div className="flex items-center gap-4">
                <Quadrant teeth={UPPER_RIGHT_PLAQUE} plaqueData={plaqueData} missingTeeth={missingTeeth} onToothClick={onToothClick} isEditMode={isEditMode} />
                <div className="w-px bg-gray-300 self-stretch"></div>
                <Quadrant teeth={UPPER_LEFT_PLAQUE} plaqueData={plaqueData} missingTeeth={missingTeeth} onToothClick={onToothClick} isEditMode={isEditMode} />
            </div>
            {/* Midline Separator */}
            <div className="h-px bg-gray-300"></div>
            {/* Mandibular Arch */}
            <div className="flex items-center gap-4">
                 <Quadrant teeth={LOWER_RIGHT_PLAQUE} plaqueData={plaqueData} missingTeeth={missingTeeth} onToothClick={onToothClick} isEditMode={isEditMode} />
                 <div className="w-px bg-gray-300 self-stretch"></div>
                 <Quadrant teeth={LOWER_LEFT_PLAQUE} plaqueData={plaqueData} missingTeeth={missingTeeth} onToothClick={onToothClick} isEditMode={isEditMode} />
            </div>
        </div>
    );
};

export default PlaqueIndexChart;