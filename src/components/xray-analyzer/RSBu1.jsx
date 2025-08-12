import React, { useState } from 'react';
import BoneLossModal from './BoneLossModal';
import ToothSelectionModal from './ToothSelectionModal';

const ReportSummary = ({ slots, findings, onUpdateFindings, onUpdateBoneLossType }) => {
    const [boneLossModal, setBoneLossModal] = useState({ isOpen: false, toothReport: null, slot: null });
    const [toothSelectionModal, setToothSelectionModal] = useState({ isOpen: false, findingKey: null, title: '' });

    const allReports = slots.flatMap(slot => 
        slot.reports.map(report => ({ ...report, slotId: slot.id, processedImage: slot.processedImage }))
    );

    const boneLossLevels = {
        mild: allReports.filter(r => r.attachmentLossPercent < 25),
        moderate: allReports.filter(r => r.attachmentLossPercent >= 25 && r.attachmentLossPercent <= 50),
        severe: allReports.filter(r => r.attachmentLossPercent > 50),
    };

    const handleToothClick = (toothReport) => {
        const slot = slots.find(s => s.id === toothReport.slotId);
        setBoneLossModal({ isOpen: true, toothReport, slot });
    };

    const handleAddTeethClick = (findingKey, title) => {
        setToothSelectionModal({ isOpen: true, findingKey, title });
    };
    
    const handleSaveSelectedTeeth = (findingKey, selectedTeeth) => {
        onUpdateFindings(prev => ({...prev, [findingKey]: selectedTeeth }));
        setToothSelectionModal({ isOpen: false, findingKey: null, title: '' });
    };

    const renderTooth = (report) => (
        <button key={report.toothNumber} onClick={() => handleToothClick(report)} className="m-1 px-2 py-1 bg-gray-200 rounded hover:bg-blue-200 transition-colors">
            {report.toothNumber}
            {report.boneLossType && <span className="ml-1 text-xs font-semibold text-blue-800">({report.boneLossType.charAt(0)})</span>}
        </button>
    );

    const FindingSection = ({ title, findingKey }) => (
        <div className="p-4 bg-gray-50 rounded-lg shadow-inner">
            <h4 className="font-bold text-gray-700 mb-2">{title}</h4>
            <div className="flex flex-wrap gap-1 mb-2 min-h-[36px]">
                {findings[findingKey]?.sort((a, b) => a - b).map(tooth => (
                    <span key={tooth} className="px-2 py-1 bg-gray-300 text-sm rounded-md">{tooth}</span>
                ))}
            </div>
            <button onClick={() => handleAddTeethClick(findingKey, title)} className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Add Teeth</button>
        </div>
    );

    return (
        <div className="p-4 bg-white rounded-2xl shadow-xl w-full max-w-7xl mx-auto border border-gray-200">
            <h2 className="text-2xl font-bold text-center mb-6 text-blue-800">Radiographic Findings Summary</h2>

            <div className="bg-gray-100 p-4 rounded-lg mb-6">
                <h3 className="text-lg font-semibold mb-2">1. Level of Bone Loss</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <h4 className="font-bold">Mild (&lt;25%)</h4>
                        <div className="flex flex-wrap">{boneLossLevels.mild.map(renderTooth)}</div>
                    </div>
                    <div>
                        <h4 className="font-bold">Moderate (25-50%)</h4>
                        <div className="flex flex-wrap">{boneLossLevels.moderate.map(renderTooth)}</div>
                    </div>
                    <div>
                        <h4 className="font-bold">Severe (&gt;50%)</h4>
                        <div className="flex flex-wrap">{boneLossLevels.severe.map(renderTooth)}</div>
                    </div>
                </div>
                 <p className="text-xs text-right text-gray-500 mt-2">Click tooth to specify (H)orizontal/(V)ertical bone loss.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Left Column */}
                <div className="flex flex-col gap-4">
                    <FindingSection title="2. Furcation Involvement" findingKey="furcationInvolvement"/>
                    <FindingSection title="3. Widening PDL" findingKey="wideningPDL" />
                    <FindingSection title="4. Caries Related" findingKey="caries"/>
                    <FindingSection title="5. Defective Restoration" findingKey="defectiveRestoration"/>
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-4">
                    <FindingSection title="6. Visible Calculus" findingKey="calculus"/>
                    <FindingSection title="7. Root Proximity" findingKey="rootProximity"/>
                    <FindingSection title="8. Periapical Lesion" findingKey="periapicalLesion"/>
                    <FindingSection title="9. Other Findings" findingKey="other"/>
                </div>
            </div>

            {boneLossModal.isOpen && (
                <BoneLossModal
                    toothReport={boneLossModal.toothReport}
                    slot={boneLossModal.slot}
                    onClose={() => setBoneLossModal({ isOpen: false, toothReport: null, slot: null })}
                    onSave={onUpdateBoneLossType}
                />
            )}
            {toothSelectionModal.isOpen && (
                <ToothSelectionModal
                    findingKey={toothSelectionModal.findingKey}
                    title={toothSelectionModal.title}
                    initialSelectedTeeth={findings[toothSelectionModal.findingKey] || []}
                    onClose={() => setToothSelectionModal({ isOpen: false, findingKey: null, title: '' })}
                    onSave={handleSaveSelectedTeeth}
                />
            )}
        </div>
    );
};

export default ReportSummary;
