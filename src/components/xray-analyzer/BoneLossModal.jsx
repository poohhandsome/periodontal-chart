import React from 'react';
import { CloseIcon } from './Icons';

const BoneLossModal = ({ toothReport, slot, onClose, onSave }) => {
    if (!toothReport || !slot) return null;

    const handleSave = (type) => {
        onSave(toothReport.toothNumber, type);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-lg relative shadow-2xl">
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 z-10 p-1 rounded-full bg-gray-100 hover:bg-gray-200">
                    <CloseIcon className="w-6 h-6" />
                </button>
                <h3 className="text-xl font-bold mb-4">Bone Loss Type for Tooth #{toothReport.toothNumber}</h3>
                <div className="mb-4">
                    <img src={slot.processedImage} alt={`X-ray for tooth ${toothReport.toothNumber}`} className="rounded-md mx-auto" />
                </div>
                <p className="text-center text-gray-600 mb-4">Please select the type of bone loss visible for this tooth.</p>
                <div className="flex justify-center gap-4">
                    <button onClick={() => handleSave('Horizontal')} className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">Horizontal Bone Loss</button>
                    <button onClick={() => handleSave('Vertical')} className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors">Vertical Bone Loss</button>
                </div>
            </div>
        </div>
    );
};

export default BoneLossModal;
