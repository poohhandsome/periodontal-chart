// src/components/PlaqueIndexSummary.jsx
import React, { useMemo } from 'react';
import { ALL_TEETH_PLAQUE, PLAQUE_SITES } from '../plaque.config';

const PlaqueIndexSummary = ({ plaqueData, missingTeeth }) => {
    const summary = useMemo(() => {
        const presentTeeth = ALL_TEETH_PLAQUE.filter(t => !missingTeeth.includes(t));
        if (presentTeeth.length === 0) {
            return { percentage: 0, plaqueSurfaces: 0, totalSurfaces: 0 };
        }

        let plaqueSurfaces = 0;
        presentTeeth.forEach(toothId => {
            PLAQUE_SITES.forEach(site => {
                if (plaqueData[toothId][site]) {
                    plaqueSurfaces++;
                }
            });
        });

        const totalSurfaces = presentTeeth.length * PLAQUE_SITES.length;
        const percentage = totalSurfaces > 0 ? ((plaqueSurfaces / totalSurfaces) * 100) : 0;

        return {
            percentage: percentage.toFixed(1),
            plaqueSurfaces,
            totalSurfaces,
        };
    }, [plaqueData, missingTeeth]);

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg h-full">
            <h3 className="text-xl font-bold text-blue-700 mb-4 border-b pb-2">Plaque Index Summary</h3>
            <div className="space-y-4 text-center">
                <div>
                    <p className="text-5xl font-bold text-red-500">{summary.percentage}%</p>
                    <p className="text-gray-600 font-semibold">Plaque Score</p>
                </div>
                <div className="flex justify-around pt-4">
                    <div>
                        <p className="text-2xl font-semibold text-gray-800">{summary.plaqueSurfaces}</p>
                        <p className="text-sm text-gray-500">Plaque Surfaces</p>
                    </div>
                    <div>
                        <p className="text-2xl font-semibold text-gray-800">{summary.totalSurfaces}</p>
                        <p className="text-sm text-gray-500">Total Surfaces</p>
                    </div>
                </div>
                 <div className="pt-4">
                    <p className="text-xs text-gray-500">
                        Formula: (Plaque Surfaces / Total Surfaces) x 100
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PlaqueIndexSummary;