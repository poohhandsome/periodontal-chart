// src/components/ExportPDFModal.jsx
import React, { useState } from 'react';
import { CloseIcon } from './xray-analyzer/Icons';

const Checkbox = ({ label, id, checked, onChange, description }) => (
    <label htmlFor={id} className="flex items-start space-x-3 bg-gray-100 p-3 rounded-md hover:bg-gray-200 transition-colors cursor-pointer">
        <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={onChange}
            className="h-5 w-5 mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <div>
            <span className="font-medium text-gray-800">{label}</span>
            {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
    </label>
);

const ExportPDFModal = ({ isOpen, onClose, onExport, patientInfo }) => {
    const [exportOptions, setExportOptions] = useState({
        patientInfo: true,
        visualChart: true,  // New granular option
        dataTables: true,   // New granular option
        chartSummary: true,
        clinicalNotes: true, // New option
    });

    const handleCheckboxChange = (event) => {
        const { id, checked } = event.target;
        setExportOptions(prev => ({ ...prev, [id]: checked }));
    };

    const handleExportClick = () => {
        onExport(exportOptions);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">PDF Export Options</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700">
                        <CloseIcon className="w-6 h-6" />
                    </button>
                </div>

                <p className="text-gray-600 mb-6">
                    Select the sections you want to include in the PDF report for <span className="font-semibold">{patientInfo.patientName || 'this patient'}</span>.
                </p>

                <div className="space-y-4">
                    <Checkbox
                        id="patientInfo"
                        label="Patient Information"
                        checked={exportOptions.patientInfo}
                        onChange={handleCheckboxChange}
                    />
                    <Checkbox
                        id="visualChart"
                        label="Visual Chart"
                        description="The graphical tooth chart with lines and overlays."
                        checked={exportOptions.visualChart}
                        onChange={handleCheckboxChange}
                    />
                    <Checkbox
                        id="dataTables"
                        label="Data Tables"
                        description="The rows of numerical data (PD, RE, MGJ, etc.)."
                        checked={exportOptions.dataTables}
                        onChange={handleCheckboxChange}
                    />
                    <Checkbox
                        id="chartSummary"
                        label="Chart Summary"
                        checked={exportOptions.chartSummary}
                        onChange={handleCheckboxChange}
                    />
                    <Checkbox
                        id="clinicalNotes"
                        label="Clinical Notes"
                        description="Include the notes and impressions you've written."
                        checked={exportOptions.clinicalNotes}
                        onChange={handleCheckboxChange}
                    />
                </div>

                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExportClick}
                        className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                        Generate PDF
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ExportPDFModal;