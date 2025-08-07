// src/components/PlaqueIndexChart.jsx
import React from 'react';
import PlaqueTooth from './PlaqueTooth';
import { UPPER_RIGHT_PLAQUE, UPPER_LEFT_PLAQUE, LOWER_LEFT_PLAQUE, LOWER_RIGHT_PLAQUE } from '../plaque.config';

const Quadrant = ({ teeth, plaqueData, missingTeeth, onToothClick, isEditMode }) => (
    <div className="flex flex-wrap justify-center gap-2">
        {teeth.map(toothId => (
            <div key={toothId} className="w-12 h-12">  {/* Container to control the size */}
                <PlaqueTooth
                    toothId={toothId}
                    toothData={plaqueData[toothId]}
                    isMissing={missingTeeth.includes(toothId)}
                    onClick={onToothClick}
                    isEditMode={isEditMode}
                />
            </div>
        ))}
    </div>
);

const PlaqueIndexChart = ({ plaqueData, missingTeeth, onToothClick, isEditMode }) => {
    return (
        <div className="bg-white p-2 md:p-4 rounded-xl shadow-lg space-y-4">
            {/* Maxillary Arch */}
            <div className="flex flex-col md:flex-row items-center gap-4">
                <Quadrant teeth={UPPER_RIGHT_PLAQUE} plaqueData={plaqueData} missingTeeth={missingTeeth} onToothClick={onToothClick} isEditMode={isEditMode} />
                <div className="w-full md:w-px h-px md:h-auto bg-gray-300 self-stretch"></div>
                <Quadrant teeth={UPPER_LEFT_PLAQUE} plaqueData={plaqueData} missingTeeth={missingTeeth} onToothClick={onToothClick} isEditMode={isEditMode} />
            </div>
            {/* Midline Separator */}
            <div className="h-px bg-gray-300"></div>
            {/* Mandibular Arch */}
            <div className="flex flex-col md:flex-row items-center gap-4">
                 <Quadrant teeth={LOWER_RIGHT_PLAQUE} plaqueData={plaqueData} missingTeeth={missingTeeth} onToothClick={onToothClick} isEditMode={isEditMode} />
                 <div className="w-full md:w-px h-px md:h-auto bg-gray-300 self-stretch"></div>
                 <Quadrant teeth={LOWER_LEFT_PLAQUE} plaqueData={plaqueData} missingTeeth={missingTeeth} onToothClick={onToothClick} isEditMode={isEditMode} />
            </div>
        </div>
    );
};

export default PlaqueIndexChart;