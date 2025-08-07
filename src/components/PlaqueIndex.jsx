// src/components/PlaqueIndex.jsx
import React, { useState, useEffect } from 'react';
import PlaqueIndexChart from './PlaqueIndexChart';
import PlaqueIndexSummary from './PlaqueIndexSummary';
import Dropdown from './Dropdown';
import ConfirmationModal from './ConfirmationModal';
import { INITIAL_PLAQUE_DATA } from '../plaque.config';

const getInitialPlaqueState = () => {
    const savedState = localStorage.getItem('plaqueIndexCurrentState');
    if (savedState) {
        try {
            return JSON.parse(savedState);
        } catch (e) {
            console.error("Failed to parse plaque state:", e);
        }
    }
    return {
        plaqueData: INITIAL_PLAQUE_DATA,
        missingTeeth: [],
    };
};

const PlaqueIndex = () => {
    const [initialState] = useState(getInitialPlaqueState);
    const [plaqueData, setPlaqueData] = useState(initialState.plaqueData);
    const [missingTeeth, setMissingTeeth] = useState(initialState.missingTeeth);
    const [isEditMode, setIsEditMode] = useState(false);
    const [isClearConfirmOpen, setClearConfirmOpen] = useState(false);

    useEffect(() => {
        const currentState = { plaqueData, missingTeeth };
        localStorage.setItem('plaqueIndexCurrentState', JSON.stringify(currentState));
    }, [plaqueData, missingTeeth]);
    
    const handleToothClick = (toothId, site) => {
        if (isEditMode) {
            setMissingTeeth(prev => prev.includes(toothId) ? prev.filter(t => t !== toothId) : [...prev, toothId]);
        } else {
            setPlaqueData(prev => {
                const newData = JSON.parse(JSON.stringify(prev));
                newData[toothId][site] = !newData[toothId][site];
                return newData;
            });
        }
    };

    const handleClearChart = () => {
        setPlaqueData(INITIAL_PLAQUE_DATA);
        setMissingTeeth([]);
        setClearConfirmOpen(false);
    };

    const handleDownload = () => {
        const dataToSave = { plaqueData, missingTeeth };
        const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'PlaqueIndexChart.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const loadedData = JSON.parse(e.target.result);
                    if (loadedData.plaqueData && loadedData.missingTeeth) {
                        setPlaqueData(loadedData.plaqueData);
                        setMissingTeeth(loadedData.missingTeeth);
                        alert('Plaque chart loaded successfully!');
                    } else {
                        alert('Invalid plaque chart file format.');
                    }
                } catch (error) {
                    alert('Error reading or parsing the file.');
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 text-gray-800 p-4 font-sans">
            <div className="w-full max-w-7xl mx-auto px-2">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-4">
                        <a href="#" className="text-blue-600 hover:text-blue-800 font-semibold">&larr; Back to Home</a>
                        <h1 className="text-3xl font-bold text-blue-700">Plaque Index (O'Leary)</h1>
                    </div>
                    <div className="space-x-2 flex items-center">
                         <button onClick={() => setIsEditMode(!isEditMode)} className={`px-4 py-2 rounded-lg font-semibold text-white transition-colors h-10 ${isEditMode ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-500 hover:bg-gray-600'}`}>
                            {isEditMode ? 'Finish Editing' : 'Remove Teeth'}
                        </button>
                        <Dropdown label="File">
                            <button onClick={handleDownload} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download</button>
                            <label className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                                Upload
                                <input type="file" accept=".json" className="hidden" onChange={handleUpload} />
                            </label>
                             <div className="my-1 border-t border-gray-200"></div>
                            <button onClick={() => setClearConfirmOpen(true)} className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50">Clear Chart</button>
                        </Dropdown>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2">
                         <PlaqueIndexChart plaqueData={plaqueData} missingTeeth={missingTeeth} onToothClick={handleToothClick} isEditMode={isEditMode} />
                    </div>
                    <div className="lg:col-span-1">
                        <PlaqueIndexSummary plaqueData={plaqueData} missingTeeth={missingTeeth} />
                    </div>
                </div>

            </div>
             <ConfirmationModal
                isOpen={isClearConfirmOpen}
                onClose={() => setClearConfirmOpen(false)}
                onConfirm={handleClearChart}
                title="Clear Plaque Chart"
            >
                <p>Are you sure you want to clear all plaque data? This action cannot be undone.</p>
            </ConfirmationModal>
        </div>
    );
};

export default PlaqueIndex;