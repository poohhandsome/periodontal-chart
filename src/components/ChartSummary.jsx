// src/components/ChartSummary.jsx

import React, { useMemo } from 'react';
import { ALL_TEETH, UPPER_RIGHT, UPPER_LEFT, LOWER_RIGHT, LOWER_LEFT } from '../chart.config';
import PizzaChart from './PizzaChart';

const SummaryList = ({ title, sites, colorClass }) => (
    <div>
        <h4 className={`font-bold ${colorClass}`}>{title}</h4>
        {sites.length > 0 ? (
            <p className="text-sm text-gray-700 font-mono">
                {sites.join(', ')}
            </p>
        ) : (
            <p className="text-sm text-gray-500">None</p>
        )}
    </div>
);

const PizzaRow = ({ teeth, chartData, missingTeeth, rotation }) => (
    <div className="flex justify-between items-center">
        {teeth.map(toothId => (
            <PizzaChart
                key={toothId}
                toothId={toothId}
                bleedingData={chartData[toothId]?.bleeding}
                isMissing={missingTeeth.includes(toothId)}
                rotation={rotation}
            />
        ))}
    </div>
);

const ChartSummary = ({ chartData, missingTeeth }) => {
    const summary = useMemo(() => {
        const availableTeethCount = 32 - missingTeeth.length;
        if (availableTeethCount === 0) {
            return { bopPercentage: 0, sites7mm: [], sites6mm: [], sites5mm: [], sites4mm: [] };
        }

        let bopCount = 0;
        let sites7mm = [];
        let sites6mm = [];
        let sites5mm = [];
        let sites4mm = [];

        ALL_TEETH.forEach(toothId => {
            if (missingTeeth.includes(toothId)) return;

            const tooth = chartData[toothId];
            for (const site in tooth.pd) {
                const pd = tooth.pd[site];
                const siteName = `${toothId}${site.charAt(0).toUpperCase()}`;

                if (pd >= 7) {
                    sites7mm.push(siteName);
                } else if (pd === 6) {
                    sites6mm.push(siteName);
                } else if (pd === 5) {
                    sites5mm.push(siteName);
                } else if (pd === 4) {
                    sites4mm.push(siteName);
                }
            }

            for (const site in tooth.bleeding) {
                if (tooth.bleeding[site]) {
                    bopCount++;
                }
            }
        });
        
        const totalSites = availableTeethCount * 6;
        const bopPercentage = totalSites > 0 ? ((bopCount / totalSites) * 100).toFixed(1) : 0;

        return { bopPercentage, sites7mm, sites6mm, sites5mm, sites4mm };
    }, [chartData, missingTeeth]);

    return (
        <div className="mt-6 bg-white p-4 rounded-xl shadow-lg">
            <h3 className="text-xl font-bold text-blue-700 mb-3 border-b pb-2">Chart Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1 text-center flex flex-col items-center justify-center">
                    <h4 className="font-bold text-gray-700">Bleeding on Probing</h4>
                    <p className="text-5xl font-bold text-red-500 my-2">{summary.bopPercentage}%</p>
                </div>
                <div className="md:col-span-2 space-y-2">
                    <SummaryList title="Sites with PD >= 7mm" sites={summary.sites7mm} colorClass="text-red-700" />
                    <SummaryList title="Sites with PD = 6mm" sites={summary.sites6mm} colorClass="text-red-500" />
                    <SummaryList title="Sites with PD = 5mm" sites={summary.sites5mm} colorClass="text-orange-500" />
                    <SummaryList title="Sites with PD = 4mm" sites={summary.sites4mm} colorClass="text-yellow-500" />
                </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 space-y-3">
                <PizzaRow teeth={[...UPPER_RIGHT, ...UPPER_LEFT]} chartData={chartData} missingTeeth={missingTeeth} rotation={-90} />
                <PizzaRow teeth={[...LOWER_RIGHT, ...LOWER_LEFT]} chartData={chartData} missingTeeth={missingTeeth} rotation={90} />
            </div>
        </div>
    );
};

export default ChartSummary;