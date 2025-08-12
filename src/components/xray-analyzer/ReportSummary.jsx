import React, { useState } from 'react';
import BoneLossModal from './BoneLossModal';
import ToothSelectionModal from './ToothSelectionModal';

const PeriodontalStagingTable = ({ allReports }) => {
    
    const reportsMap = new Map();
    allReports.forEach(report => {
        if (!reportsMap.has(report.toothNumber)) {
            reportsMap.set(report.toothNumber, report);
        }
    });

    const getStagingStatus = (mm) => {
        if (mm === null || typeof mm === 'undefined') return { text: 'N/A', color: 'bg-gray-200' };
        const loss = parseFloat(mm);
        if (isNaN(loss)) return { text: 'N/A', color: 'bg-gray-200' };
        if (loss <= 3) return { text: 'Stage I (Early)', color: 'bg-green-200 text-green-800' };
        if (loss <= 5) return { text: 'Stage II (Moderate)', color: 'bg-yellow-200 text-yellow-800' };
        if (loss > 5) return { text: 'Stage III (Advanced)', color: 'bg-red-200 text-red-800' };
        return { text: 'N/A', color: 'bg-gray-200' };
    };

    const range = (start, end) => Array.from({ length: Math.abs(end - start) + 1 }, (_, i) => String(start > end ? start - i : start + i));

    const StagingTable = ({ title, rangeLeft, rangeRight }) => (
        <div className="mb-4">
            <h4 className="font-bold text-gray-700 mb-2">{title}</h4>
            <div className="grid grid-cols-[auto_repeat(17,_minmax(0,_1fr))] gap-px bg-gray-300 border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-200 p-2 font-semibold text-sm text-center">Tooth #</div>
                {rangeLeft.map(t => <div key={t} className="bg-white p-2 font-mono font-bold text-center">{t}</div>)}
                <div className="bg-gray-200"></div>
                {rangeRight.map(t => <div key={t} className="bg-white p-2 font-mono font-bold text-center">{t}</div>)}

                <div className="bg-gray-200 p-2 font-semibold text-sm text-center">Loss (mm)</div>
                {[...rangeLeft, "spacer", ...rangeRight].map((tooth) => {
                    if (tooth === "spacer") return <div key="spacer-mm" className="bg-gray-200"></div>;
                    const report = reportsMap.get(tooth);
                    return (
                        <div key={tooth} className="bg-white p-1">
                            <input
                                type="text"
                                readOnly
                                value={report?.attachmentLossMm ?? ''}
                                className="w-full h-full text-center border-none rounded bg-gray-100 cursor-default"
                                aria-label={`Bone loss for tooth ${tooth}`}
                            />
                        </div>
                    );
                })}

                <div className="bg-gray-200 p-2 font-semibold text-sm text-center">Diagnostic</div>
                {[...rangeLeft, "spacer", ...rangeRight].map((tooth) => {
                     if (tooth === "spacer") return <div key="spacer-diag" className="bg-gray-200"></div>;
                     const report = reportsMap.get(tooth);
                     const { text, color } = getStagingStatus(report?.attachmentLossMm);
                     return (
                        <div key={tooth} className={`p-2 text-center text-xs font-semibold transition-colors ${color}`}>
                            {text}
                        </div>
                     )
                })}
            </div>
        </div>
    );

    return (
        <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-3">Periodontal Staging Diagnostic</h3>
            <p className="text-sm text-gray-600 mb-4">
                This table reflects the bone loss measurements calculated during the image analysis.
            </p>
            <StagingTable title="Maxillary Arch (Upper)" rangeLeft={range(18, 11)} rangeRight={range(21, 28)} />
            <StagingTable title="Mandibular Arch (Lower)" rangeLeft={range(48, 41)} rangeRight={range(31, 38)} />
        </div>
    );
};

const ReportSummary = ({ slots, findings, onUpdateFindings, onUpdateBoneLossType }) => {
    const [boneLossModal, setBoneLossModal] = useState({ isOpen: false, toothReport: null, slot: null, side: null });
    const [toothSelectionModal, setToothSelectionModal] = useState({ isOpen: false, findingKey: null, title: '' });

    const allReports = slots.flatMap(slot => 
        slot.reports.map(report => ({ ...report, slotId: slot.id, processedImage: slot.processedImage }))
    );
    
    const boneLossLevels = {
        mild: allReports.filter(r => r.attachmentLossPercent < 25),
        moderate: allReports.filter(r => r.attachmentLossPercent >= 25 && r.attachmentLossPercent <= 50),
        severe: allReports.filter(r => r.attachmentLossPercent > 50),
    };

    const handleToothClick = (toothReport, side) => {
        const slot = slots.find(s => s.id === toothReport.slotId);
        setBoneLossModal({ isOpen: true, toothReport, slot, side });
    };

    const handleAddTeethClick = (findingKey, title) => {
        setToothSelectionModal({ isOpen: true, findingKey, title });
    };
    
    const handleSaveSelectedTeeth = (findingKey, selectedTeeth) => {
        onUpdateFindings(prev => ({...prev, [findingKey]: selectedTeeth }));
        setToothSelectionModal({ isOpen: false, findingKey: null, title: '' });
    };

    // --- MODIFIED CODE ---
    // This function now correctly displays the (H) or (V) from the `boneLossType` property.
    const renderTooth = (report) => (
        <button key={report.id} onClick={() => handleToothClick(report, report.side)} className="m-1 px-2 py-1 bg-gray-200 rounded hover:bg-blue-200 transition-colors">
            {report.toothNumber}{report.side}
            {report.boneLossType && <span className="ml-1 text-xs font-semibold text-blue-800">({report.boneLossType.charAt(0)})</span>}
        </button>
    );
    // --- END MODIFIED CODE ---

    const FindingSection = ({ title, findingKey }) => (
        <div className="p-4 bg-gray-50 rounded-lg shadow-inner">
            <h4 className="font-bold text-gray-700 mb-2">{title}</h4>
            <div className="flex flex-wrap gap-1 mb-2 min-h-[36px]">
                {findings[findingKey]?.sort((a, b) => a.tooth - b.tooth).map(tooth => (
                    <span key={`${tooth.tooth}${tooth.side}`} className="px-2 py-1 bg-gray-300 text-sm rounded-md">{tooth.tooth}{tooth.side}</span>
                ))}
            </div>
            <button onClick={() => handleAddTeethClick(findingKey, title)} className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600">Add Teeth</button>
        </div>
    );

    return (
        <div className="p-4 bg-white rounded-2xl shadow-xl w-full max-w-7xl mx-auto border border-gray-200">
            <h2 className="text-2xl font-bold text-center mb-6 text-blue-800">Radiographic Findings Summary</h2>

            <div id="pdf-section-2">
                <div className="bg-gray-100 p-4 rounded-lg mb-6">
                    <h3 className="text-lg font-semibold mb-2">1. Level of Bone Loss (by % of Root)</h3>
                    <p className="text-sm text-gray-500 mb-4">This section categorizes each analysis by severity based on percentage of bone loss. Click a tooth to specify Horizontal/Vertical bone loss.</p>
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
                </div>
                <PeriodontalStagingTable allReports={allReports} />
            </div>

            <div id="pdf-section-3" className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-4">
                    <FindingSection title="2. Furcation Involvement" findingKey="furcationInvolvement"/>
                    <FindingSection title="3. Widening PDL" findingKey="wideningPDL" />
                    <FindingSection title="4. Caries Related" findingKey="caries"/>
                    <FindingSection title="5. Defective Restoration" findingKey="defectiveRestoration"/>
                </div>
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
                    side={boneLossModal.side} // Pass the side to the modal
                    onClose={() => setBoneLossModal({ isOpen: false, toothReport: null, slot: null, side: null })}
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