// src/components/ReleaseNotesModal.jsx
import React from 'react';
// Note: This import assumes your Icons.jsx file is in the xray-analyzer subdirectory.
// If you moved it, you may need to adjust the path.
import { CloseIcon } from './xray-analyzer/Icons';

const releaseNotes = [
    { version: '1.1.2', date: '2025-08-15',notes: ['XRay: Export to PDF Updated']},
    { version: '1.1.1b', date: '2025-08-14',notes: ['XRay Layout Updated']},
    {
        version: '1.1.0',
        date: '2025-08-14',
        notes: [
            'Implemented a comprehensive X-Ray Analysis module with detailed analysis.',
            'Upgraded data persistence from LocalStorage to IndexedDB for improved performance and reliability.',
            'Fixed a bug to disable the on-screen keyboard when using the custom numpad on iPads.',
        ],
    },
    {
        version: '1.0.3',
        date: '2025-08-08',
        notes: [
            'Implemented Voice-Controlled Chart.',
            'Minor Bugs fixed.',
        ],
    },
    {
        version: '1.0.2',
        date: '2025-08-08',
        notes: [
            'Upgraded PDF Export Engine.',
            'Add Click-to-Edit Function, Flexible Charting Flow',
            'Minor Bugs fixed.',
        ],
    },
    {
        version: '1.0.0',
        date: '2025-07-20',
        notes: [
            'Initial release of EasyPerio.',
            'Includes Periodontal Chart and Plaque Index tools.',
        ],
    },
];

const ReleaseNotesModal = ({ onClose }) => {
    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6 relative max-h-[90vh] flex flex-col">
                <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 z-10 p-1 rounded-full bg-gray-100 hover:bg-gray-200">
                    <CloseIcon className="w-6 h-6" />
                </button>
                <h2 className="text-3xl font-bold text-blue-700 mb-4">Release Notes</h2>
                <div className="overflow-y-auto pr-4 space-y-6">
                    {releaseNotes.map((release) => (
                        <div key={release.version}>
                            <h3 className="text-xl font-semibold text-gray-800">Version {release.version} <span className="text-sm font-normal text-gray-500">- {release.date}</span></h3>
                            <ul className="mt-2 list-disc list-inside space-y-1 text-gray-700">
                                {release.notes.map((note, index) => (
                                    <li key={index}>{note}</li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                 <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                    <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReleaseNotesModal;