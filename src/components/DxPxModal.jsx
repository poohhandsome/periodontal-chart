// src/components/DxPxModal.jsx
import React, { useState, useEffect, useRef } from 'react';

// --- Configuration ---
const DIAGNOSIS_LEVELS = {
  3: { code: 'A', text: 'Advanced', color: 'bg-red-500 text-white', criteriaColor: 'bg-red-100 text-red-800' },
  2: { code: 'M', text: 'Moderate', color: 'bg-orange-500 text-white', criteriaColor: 'bg-orange-100 text-orange-800' },
  1: { code: 'E', text: 'Early', color: 'bg-green-500 text-white', criteriaColor: 'bg-green-100 text-green-800' },
  0: { code: '', text: 'No Periodontitis', color: 'bg-blue-500 text-white', criteriaColor: 'bg-gray-50' },
};
const PROGNOSIS_LEVELS = ['Good', 'Fair', 'Poor', 'Questionable', 'Hopeless'];
const PROGNOSIS_COLORS = {
    Good: 'bg-green-500 text-white',
    Fair: 'bg-yellow-500 text-white',
    Poor: 'bg-orange-500 text-white',
    Questionable: 'bg-red-500 text-white',
    Hopeless: 'bg-black text-white',
};


const DIAGNOSIS_CRITERIA = {
  pd: [ { label: 'Early', range: '< 5 mm', level: 1 }, { label: 'Moderate', range: '5-6 mm', level: 2 }, { label: 'Advanced', range: '≥ 7 mm', level: 3 } ],
  cal: [ { label: 'Early', range: '1-2 mm', level: 1 }, { label: 'Moderate', range: '3-4 mm', level: 2 }, { label: 'Advanced', range: '≥ 5 mm', level: 3 } ],
};

// --- Helper Functions ---
const roman = (n) => (n == null ? '' : ['', 'I', 'II', 'III'][Number(n)] || '');

const getDetailedDiagnosis = (toothData) => {
    const analysis = { pd: { sitesByLevel: { 1: [], 2: [], 3: [] }, maxLevel: 0 }, cal: { sitesByLevel: { 1: [], 2: [], 3: [] }, maxLevel: 0 } };
    if (!toothData || !toothData.pd || !toothData.re) return { finalSeverity: 0, analysis };
    const allSites = ['db', 'b', 'mb', 'dl', 'l', 'ml'];
    allSites.forEach(site => {
        const pd = toothData.pd[site] ?? 0, re = toothData.re[site] ?? 0;
        if (pd === 0 && re === 0) return;
        const cal = pd + re;
        let pdLevel = 0;
        if (pd >= 7) pdLevel = 3; else if (pd >= 5) pdLevel = 2; else if (pd > 0) pdLevel = 1;
        if (pdLevel > 0) analysis.pd.sitesByLevel[pdLevel].push(`${site.toUpperCase()}(${pd})`);
        analysis.pd.maxLevel = Math.max(analysis.pd.maxLevel, pdLevel);
        let calLevel = 0;
        if (cal >= 5) calLevel = 3; else if (cal >= 3) calLevel = 2; else if (cal >= 1) calLevel = 1;
        if (calLevel > 0) analysis.cal.sitesByLevel[calLevel].push(`${site.toUpperCase()}(${cal})`);
        analysis.cal.maxLevel = Math.max(analysis.cal.maxLevel, calLevel);
    });
    return { finalSeverity: Math.max(analysis.pd.maxLevel, analysis.cal.maxLevel), analysis };
};

const getPrognosis = (toothData) => {
    if (!toothData) return { level: 'Good', factors: {} };
    const { pd = {}, mo = {}, f = {} } = toothData;
    const maxPd = Math.max(0, ...Object.values(pd).filter(v => v != null));
    const mobility = mo.l ?? 0;
    const maxFurcation = Math.max(0, ...Object.values(f).filter(v => v != null));
    let pdPx = 1; if (maxPd >= 6) pdPx = 3;
    let moPx = 1; if (mobility >= 3) moPx = 4; else if (mobility >= 2) moPx = 3; else if (mobility >= 1) moPx = 2;
    let fiPx = 1; if (maxFurcation >= 3) fiPx = 5; else if (maxFurcation >= 2) fiPx = 4; else if (maxFurcation >= 1) fiPx = 2;
    const finalPxLevel = Math.max(pdPx, moPx, fiPx);
    return { level: PROGNOSIS_LEVELS[finalPxLevel - 1], factors: { pd: pdPx, mo: moPx, fi: fiPx } };
};

// --- Sub-components ---
const ClinicalDataMultiValueRow = ({ label, sites, data, highlightCondition }) => (
    <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
        <span className="text-sm text-gray-600 font-semibold">{label}</span>
        <div className="flex gap-1">{sites.map(site => { const value = data[site]; const isHighlighted = highlightCondition && highlightCondition(value); return <span key={site} className={`w-10 text-center font-mono text-sm p-1 rounded ${isHighlighted ? 'bg-red-100 text-red-700 font-bold' : ''}`}>{value ?? '-'}</span>; })}</div>
    </div>
);
const ClinicalDataCalRow = ({ label, sites, pdData, reData, highlightCondition }) => (
    <div className="flex justify-between items-center p-2 bg-gray-100 rounded font-semibold">
        <span className="text-sm text-gray-700">{label}</span>
        <div className="flex gap-1">{sites.map(site => { const pd = pdData[site] ?? 0; const re = reData[site] ?? 0; const value = pd + re; const isHighlighted = highlightCondition && highlightCondition(value); return <span key={site} className={`w-10 text-center font-mono text-sm p-1 rounded ${isHighlighted ? 'bg-red-100 text-red-700 font-bold' : ''}`}>{value > 0 ? value : '-'}</span>; })}</div>
    </div>
);
const ClinicalDataSingleValueRow = ({ label, value, highlight }) => (
    <div className={`flex justify-between items-center p-2 rounded ${highlight ? 'bg-red-100 font-bold text-red-700' : 'bg-gray-50'}`}>
        <span className="text-sm text-gray-600 font-semibold">{label}</span>
        <span className="text-sm font-mono">{value ?? '-'}</span>
    </div>
);
const CriteriaRow = ({ label, range, sites, color, isHighlighted }) => (
    <div className={`flex justify-between items-center p-2 rounded-md transition-colors ${isHighlighted ? color : 'bg-gray-50'}`}>
        <div><span className="font-bold">{label}:</span><span className="text-gray-600 ml-2">{range}</span></div>
        <div className="flex flex-wrap justify-end gap-1">{sites.map(site => <span key={site} className="font-mono text-xs px-2 py-1 rounded-md bg-white shadow-sm">{site}</span>)}</div>
    </div>
);
const PrognosisTable = ({ prognosisFactors }) => {
    const headers = ['Good', 'Fair', 'Poor', 'Questionable', 'Hopeless'];
    const factors = [
        { key: 'bone', label: '% Bone', criteria: ['> 75%', '50-75%', '50-75%', '25-50%', '< 25%'] },
        { key: 'pd', label: 'PD', criteria: ['< 6mm', '< 6mm', '≥ 6mm', '≥ 6mm', '≥ 6mm'] },
        { key: 'mo', label: 'MO', criteria: ['0', '0-1', '0-2', '2-3', '2-3'] },
        { key: 'fi', label: 'FI', criteria: ['0', '0-1', '1-2', '2-3', '3'] },
    ];
    return (
        <div className="bg-white p-3 rounded-lg border">
            {/* THIS IS THE CHANGE: Added the table title */}
            <h4 className="text-xs font-semibold text-gray-500 text-center mb-2">Thai Association of Periodontology 2557</h4>
            <table className="w-full border-collapse text-center text-xs">
                <thead>
                    <tr>
                        <th className="p-2 font-semibold text-gray-600 border-b">Factor</th>
                        {headers.map(h => <th key={h} className="p-2 font-semibold text-gray-600 border-b">{h}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {factors.map(factor => (
                        <tr key={factor.key}>
                            <td className="p-2 font-semibold text-gray-700 border-b">{factor.label}</td>
                            {factor.criteria.map((crit, index) => {
                                const level = index + 1;
                                const isHighlighted = prognosisFactors[factor.key] === level;
                                return <td key={level} className={`p-2 border-b ${isHighlighted ? 'bg-blue-100 text-blue-800 font-bold rounded' : ''}`}>{crit}</td>
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

// --- Main Component ---
const DxPxModal = ({ tooth, onClose, onSave }) => {
    if (!tooth) return null;
    const { toothId, data } = tooth;

    const [diagnosis, setDiagnosis] = useState(() => getDetailedDiagnosis(data));
    const [prognosis, setPrognosis] = useState(() => getPrognosis(data));
    const [isPxChooserOpen, setPxChooserOpen] = useState(false);

    const modalRef = useRef(null);
    const pxChooserRef = useRef(null);

    useEffect(() => {
        setPrognosis(getPrognosis(data));
    }, [data]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target) && pxChooserRef.current && !pxChooserRef.current.contains(event.target)) {
                setPxChooserOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDxOverride = () => {
        const currentLevel = diagnosis.finalSeverity;
        const nextLevel = currentLevel > 0 ? currentLevel - 1 : 3;
        setDiagnosis(prev => ({ ...prev, finalSeverity: nextLevel }));
    };

    const handlePxOverride = (level) => {
        setPrognosis(prev => ({ ...prev, level }));
        setPxChooserOpen(false);
    };

    const handleSaveChanges = () => {
        const dxCode = DIAGNOSIS_LEVELS[diagnosis.finalSeverity].code;
        const pxCode = prognosis.level ? prognosis.level.charAt(0) : '-';
        onSave(toothId, `${dxCode}/${pxCode}`, prognosis.level);
        onClose();
    };
    
    const dxInfo = DIAGNOSIS_LEVELS[diagnosis.finalSeverity];
    const { pd = {}, re = {}, mgj = {}, mo = {}, f = {} } = data || {};
    
    const formatFurcation = () => {
        const parts = [];
        if (f.b) parts.push(`${roman(f.b)}(B)`); if (f.l) parts.push(`${roman(f.l)}(Li)`); if (f.mli) parts.push(`${roman(f.mli)}(MLi)`); if (f.dli) parts.push(`${roman(f.dli)}(DLi)`);
        return parts.join('/') || null;
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div ref={modalRef} className="bg-white rounded-xl shadow-2xl w-full max-w-6xl p-6 grid grid-cols-3" onClick={e => e.stopPropagation()}>
                
                {/* --- Left Column: Clinical Summary --- */}
                <div className="flex flex-col gap-4 pr-6">
                    <div className="flex items-center gap-4"><div className="text-center w-24 flex-shrink-0"><div className="text-lg font-semibold text-gray-600">Tooth</div><div className="text-7xl font-bold text-black leading-tight">{toothId}</div></div><div className="bg-white flex items-center justify-center h-40 flex-1"><img src={`/teeth/${toothId}.png`} alt={`Tooth ${toothId}`} className="max-w-full max-h-full object-contain" onError={(e) => { e.target.style.display = 'none'; }}/></div></div>
                    <div className="space-y-2">
                        <ClinicalDataMultiValueRow label="PD (Buccal)" sites={['mb', 'b', 'db']} data={pd} highlightCondition={(val) => val >= 4} />
                        <ClinicalDataMultiValueRow label="RE (Buccal)" sites={['mb', 'b', 'db']} data={re} />
                        <ClinicalDataCalRow label="CAL (Buccal)" sites={['mb', 'b', 'db']} pdData={pd} reData={re} highlightCondition={(val) => val >= 3} />
                        <div className="pt-2"></div>
                        <ClinicalDataMultiValueRow label="PD (Lingual)" sites={['ml', 'l', 'dl']} data={pd} highlightCondition={(val) => val >= 4} />
                        <ClinicalDataMultiValueRow label="RE (Lingual)" sites={['ml', 'l', 'dl']} data={re} />
                        <ClinicalDataCalRow label="CAL (Lingual)" sites={['ml', 'l', 'dl']} pdData={pd} reData={re} highlightCondition={(val) => val >= 3} />
                        <div className="pt-2"></div>
                        <ClinicalDataSingleValueRow label="% Bone Left" value={null} />
                        <ClinicalDataSingleValueRow label="MGJ (B)" value={mgj.b} highlight={mgj.b != null && mgj.b < 2} />
                        <ClinicalDataSingleValueRow label="Mobility (MO)" value={mo.l} highlight={!!mo.l} />
                        <ClinicalDataSingleValueRow label="Furcation (F)" value={formatFurcation()} highlight={!!formatFurcation()} />
                    </div>
                </div>

                {/* --- Middle Column: Diagnosis --- */}
                <div className="border-l border-r border-gray-200 px-6">
                    <h2 className="text-xl font-bold text-blue-700 mb-4">Diagnosis</h2>
                     <div className={`p-4 rounded-lg text-center cursor-pointer transition-transform hover:scale-105 ${dxInfo.color}`} onClick={handleDxOverride} title="Click to manually override diagnosis"><div className="text-sm font-semibold opacity-80">DIAGNOSIS (Dx)</div><div className="text-2xl font-bold mt-1">{dxInfo.text}</div></div>
                    <div className="mt-4">
                        <div className="flex items-center gap-2 mb-3"><h3 className="font-semibold text-gray-800">Diagnostic Criteria Analysis</h3><a href="https://aap.onlinelibrary.wiley.com/doi/pdf/10.1902/jop.2015.157001" target="_blank" rel="noopener noreferrer" className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 rounded-full text-xs font-bold hover:bg-blue-500 hover:text-white" title="View AAP Classification PDF">?</a></div>
                        <div className="space-y-3">
                            <div><h4 className="text-sm font-bold text-gray-600 mb-2">Probing Depth (PD)</h4><div className="space-y-1">{DIAGNOSIS_CRITERIA.pd.map(crit => <CriteriaRow key={crit.level} {...crit} isHighlighted={diagnosis.analysis.pd.maxLevel === crit.level} sites={diagnosis.analysis.pd.sitesByLevel[crit.level]} color={DIAGNOSIS_LEVELS[crit.level].criteriaColor} />)}</div></div>
                            <div><h4 className="text-sm font-bold text-gray-600 mb-2">Clinical Attachment Loss (CAL)</h4><div className="space-y-1">{DIAGNOSIS_CRITERIA.cal.map(crit => <CriteriaRow key={crit.level} {...crit} isHighlighted={diagnosis.analysis.cal.maxLevel === crit.level} sites={diagnosis.analysis.cal.sitesByLevel[crit.level]} color={DIAGNOSIS_LEVELS[crit.level].criteriaColor} />)}</div></div>
                        </div>
                    </div>
                </div>

                {/* --- Right Column: Prognosis --- */}
                <div className="pl-6 relative">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">Prognosis</h2>
                    <div className={`p-4 rounded-lg text-center cursor-pointer transition-transform hover:scale-105 ${PROGNOSIS_COLORS[prognosis.level]}`} onClick={() => setPxChooserOpen(prev => !prev)} title="Click to manually override prognosis">
                        <div className="text-sm font-semibold opacity-80">PROGNOSIS (Px)</div>
                        <div className="text-2xl font-bold mt-1">{prognosis.level}</div>
                    </div>
                    
                    {isPxChooserOpen && (
<div ref={pxChooserRef} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-lg shadow-2xl border z-20">

                            <div className="flex flex-col gap-1">
                                {PROGNOSIS_LEVELS.map(level => (
                                    <button key={level} onClick={() => handlePxOverride(level)} className={`w-full text-left p-2 rounded-md font-semibold text-sm transition-colors ${prognosis.level === level ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-gray-700'}`}>
                                        {level}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="mt-4">
                        <PrognosisTable prognosisFactors={prognosis.factors} />
                    </div>
                </div>

                {/* --- Footer --- */}
                <div className="col-span-3 flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">Cancel</button>
                    <button onClick={handleSaveChanges} className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">Save & Close</button>
                </div>
            </div>
        </div>
    );
};

export default DxPxModal;