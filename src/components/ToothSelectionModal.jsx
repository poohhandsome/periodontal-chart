import React, { useState } from 'react';
import { CloseIcon } from './Icons';

// Standard tooth number layout
const upperArch = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const lowerArch = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];


const ToothSelectionModal = ({ findingKey, title, initialSelectedTeeth, onClose, onSave }) => {
    const [selectedTeeth, setSelectedTeeth] = useState(initialSelectedTeeth || []);

    const toggleTooth = (tooth) => {
        setSelectedTeeth(prev => 
            prev.includes(tooth) ? prev.filter(t => t !== tooth) : [...prev, tooth]
        );
    };

    const handleSave = () => {
        onSave(findingKey, selectedTeeth.sort((a,b) => a - b));
    };

    const Tooth = ({ number }) => {
        const isSelected = selectedTeeth.includes(number);
        return (
            <button 
                onClick={() => toggleTooth(number)}
                className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected ? 'bg-blue-500 border-blue-700 text-white font-bold' : 'bg-gray-200 border-gray-300 hover:bg-blue-100'
                }`}
            >
                {number}
            </button>
        )
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl relative shadow-2xl">
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 z-10 p-1 rounded-full bg-gray-100 hover:bg-gray-200">
                    <CloseIcon className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold mb-2 text-center">Select Teeth for: <span className="text-blue-700">{title}</span></h3>
                <p className="text-center text-gray-500 mb-6">Click on a tooth to add or remove it from the list.</p>
                
                <div className="flex flex-col items-center gap-4">
                    {/* Upper Arch */}
                    <div className="flex justify-center gap-1.5 flex-wrap">
                        {upperArch.map(t => <Tooth key={t} number={t} />)}
                    </div>
                    {/* Lower Arch */}
                    <div className="flex justify-center gap-1.5 flex-wrap">
                        {lowerArch.map(t => <Tooth key={t} number={t} />)}
                    </div>
                </div>

                <div className="mt-8 flex justify-end gap-4">
                    <button onClick={onClose} className="px-6 py-2 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600">Cancel</button>
                    <button onClick={handleSave} className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700">Save Selections</button>
                </div>
            </div>
        </div>
    );
};

export default ToothSelectionModal;
