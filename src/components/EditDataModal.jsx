// src/components/EditDataModal.jsx
import React, { useState, useEffect, useRef, useMemo } from 'react';
import InlineNumpad from './InlineNumpad';

// ---------- helpers ----------
const roman = (n) => (n == null ? '' : ['','I','II','III'][Number(n)] || '');
const isUpperFDI = (toothId) => {
    const n = parseInt(String(toothId), 10);
    return n >= 11 && n <= 28;
};
const isMolarFDI = (toothId) => {
    const n = parseInt(String(toothId), 10);
    const pos = n % 10;
    return pos >= 6 && pos <= 8;
};

// common shell for a read-only box driven by our pads
const ReadOnlyBox = ({ label, value, active }) => (
    <div className="flex flex-col items-center">
        <label className="text-sm font-semibold text-gray-600">{label}</label>
        <div
            className={`w-20 h-12 mt-1 text-center text-xl font-bold bg-gray-100 rounded-md flex items-center justify-center border-2 ${
                active ? 'border-blue-500 bg-white' : 'border-transparent'
            }`}
        >
            {value ?? ''} {/* UPDATED: Changed from '–' to blank */}
        </div>
    </div>
);

// Numpad for F (Roman numerals)
const RomanPad = ({ onPick, onClear }) => (
    <div className="flex gap-2 p-2 bg-white rounded-xl shadow-2xl border border-gray-200 z-[1000]">
        {[
            { t: 'I',   v: 1, cls: 'bg-blue-600 hover:bg-blue-700 w-12' },
            { t: 'II',  v: 2, cls: 'bg-blue-600 hover:bg-blue-700 w-12' },
            { t: 'III', v: 3, cls: 'bg-blue-600 hover:bg-blue-700 w-12' },
            { t: 'C',   v: null, cls: 'bg-red-500 hover:bg-red-600 w-12' },
        ].map(({ t, v, cls }) => (
            <button
                key={t}
                onClick={() => (v == null ? onClear() : onPick(v))}
                className={`py-3 rounded-lg font-semibold text-white ${cls}`}
            >
                {t}
            </button>
        ))}
    </div>
);

// Picker for MO (Miller) — buttons 1/2/3 and Clear
const MoPicker = ({ value, onPick, onClear }) => (
    <div className="flex items-center justify-center gap-2"> {/* UPDATED: Added justify-center */}
        {[1, 2, 3].map((n) => (
            <button
                key={n}
                onClick={() => onPick(n)}
                className={`w-12 h-12 rounded-lg font-bold ${
                    value === n
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
            >
                {n}
            </button>
        ))}
        <button
            onClick={onClear}
            className="w-12 h-12 rounded-lg font-bold bg-red-500 text-white hover:bg-red-600"
        >
            C
        </button>
    </div>
);

const InfoBox = ({ title, children }) => (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700 leading-relaxed">
        <div className="font-semibold text-gray-800 mb-1">{title}</div>
        {children}
    </div>
);

// ----------------------------------------------------
const EditDataModal = ({ toothId, surface, initialData, onSave, onClose }) => {
    const makeSafe = (d) => ({
        pd: { ...(d?.pd || {}) },
        re: { ...(d?.re || {}) },
        mgj: { b: d?.mgj?.b ?? null, l: d?.mgj?.l ?? null },
        bleeding: { ...(d?.bleeding || {}) },
        suppuration: { ...(d?.suppuration || {}) },
        mo: { b: d?.mo?.b ?? null, l: d?.mo?.l ?? null },
        f: { b: d?.f?.b ?? null, l: d?.f?.l ?? null, mli: d?.f?.mli ?? null, dli: d?.f?.dli ?? null },
        dxpx: d?.dxpx ?? ''
    });

    const [data, setData] = useState(makeSafe(initialData));
    const [activeInput, setActiveInput] = useState(null);
    const [infoPopup, setInfoPopup] = useState(null);
    const modalRef = useRef(null);
    const padRef = useRef(null);
    const infoRef = useRef(null);

    useEffect(() => setData(makeSafe(initialData)), [initialData]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            const isOutsideModal = modalRef.current && !modalRef.current.contains(event.target);
            const isOutsidePad = padRef.current && !padRef.current.contains(event.target);
            const isOutsideInfo = infoRef.current && !infoRef.current.contains(event.target);

            if (isOutsideModal && isOutsidePad && isOutsideInfo) {
                setActiveInput(null);
                setInfoPopup(null);
            } else if (isOutsideModal && isOutsidePad) {
                setActiveInput(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const activeType = useMemo(() => (activeInput ? activeInput.split('.')[0] : null), [activeInput]);

    const setField = (path, value) => {
        const [type, site] = path.split('.');
        setData((prev) => {
            const d = makeSafe(prev);
            if (d[type]) {
                d[type][site] = value;
            }
            return d;
        });
    };

    const handleNumpadInput = (num) => {
        if (!activeInput) return;
        if (activeType !== 'pd' && activeType !== 're' && activeType !== 'mgj') return;
        const [type, site] = activeInput.split('.');
        const currentValue = data[type]?.[site];
        const next = (currentValue == null ? '' : String(currentValue)) + String(num);
        setField(activeInput, next === '' ? null : parseInt(next, 10));
    };

    const handleNumpadModify = (amount) => {
        if (!activeInput) return;
        if (activeType !== 'pd' && activeType !== 're' && activeType !== 'mgj') return;
        const [type, site] = activeInput.split('.');
        const currentValue = data[type]?.[site];
        const next = (currentValue ?? 0) + amount;
        setField(activeInput, next);
    };

    const handleNumpadClear = () => {
        if (!activeInput) return;
        setField(activeInput, null);
    };
    
    const renderSiteInputs = (inputSurface) => {
        const sites = inputSurface === 'buccal' ? ['db', 'b', 'mb'] : ['dl', 'l', 'ml'];
        return (
            <div className="grid grid-cols-3 gap-4">
                {sites.map(site => (
                    <div key={inputSurface + site} className="flex flex-col gap-2">
                        <div className="cursor-pointer" onClick={() => setActiveInput(`pd.${site}`)}>
                            <ReadOnlyBox label={`PD ${site.toUpperCase()}`} value={data.pd[site]} active={activeInput === `pd.${site}`} />
                        </div>
                        <div className="cursor-pointer" onClick={() => setActiveInput(`re.${site}`)}>
                            <ReadOnlyBox label={`RE ${site.toUpperCase()}`} value={data.re[site]} active={activeInput === `re.${site}`} />
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    const renderLingualExtras = () => {
        if (surface !== 'lingual') return null;
        const isUpper = isUpperFDI(toothId);
        const isMolar = isMolarFDI(toothId);

        return (
            <>
                <div className="mt-4">
                    <div className="mb-2 flex items-center justify-center gap-2"> {/* UPDATED: Added justify-center */}
                        <span className="text-sm font-semibold text-gray-700">Mobility (MO)</span>
                        <button onClick={() => setInfoPopup(infoPopup === 'miller' ? null : 'miller')} className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 rounded-full text-xs font-bold hover:bg-blue-500 hover:text-white">?</button>
                    </div>
                    <div className="flex items-center justify-center gap-6"> {/* UPDATED: Added justify-center */}
                        <MoPicker
                            value={data.mo.l}
                            onPick={(n) => setField('mo.l', n)}
                            onClear={() => setField('mo.l', null)}
                        />
                    </div>
                </div>

                {isMolar && (
                    <div className="mt-6">
                        <div className="mb-2 flex items-center justify-center gap-2"> {/* UPDATED: Added justify-center */}
                            <span className="text-sm font-semibold text-gray-700">Furcation involvement (F)</span>
                             <button onClick={() => setInfoPopup(infoPopup === 'hamp' ? null : 'hamp')} className="w-5 h-5 flex items-center justify-center bg-gray-200 text-gray-600 rounded-full text-xs font-bold hover:bg-blue-500 hover:text-white">?</button>
                        </div>

                        {isUpper ? (
                            <div className="grid grid-cols-3 gap-4">
                                <div role="button" tabIndex={0} onClick={() => setActiveInput('f.b')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveInput('f.b')} className="cursor-pointer hover:opacity-90">
                                    <ReadOnlyBox label="F(B)" value={roman(data.f.b)} active={activeInput === 'f.b'} />
                                </div>
                                <div role="button" tabIndex={0} onClick={() => setActiveInput('f.mli')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveInput('f.mli')} className="cursor-pointer hover:opacity-90">
                                    <ReadOnlyBox label="F(MLi)" value={roman(data.f.mli)} active={activeInput === 'f.mli'} />
                                </div>
                                <div role="button" tabIndex={0} onClick={() => setActiveInput('f.dli')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveInput('f.dli')} className="cursor-pointer hover:opacity-90">
                                    <ReadOnlyBox label="F(DLi)" value={roman(data.f.dli)} active={activeInput === 'f.dli'} />
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div role="button" tabIndex={0} onClick={() => setActiveInput('f.l')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveInput('f.l')} className="cursor-pointer hover:opacity-90">
                                    <ReadOnlyBox label="F(Li)" value={roman(data.f.l)} active={activeInput === 'f.l'} />
                                </div>
                                <div role="button" tabIndex={0} onClick={() => setActiveInput('f.b')} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveInput('f.b')} className="cursor-pointer hover:opacity-90">
                                    <ReadOnlyBox label="F(B)" value={roman(data.f.b)} active={activeInput === 'f.b'} />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </>
        );
    };

    return (
        // NEW: This outer div centers the content without pushing it.
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            
            {/* NEW: A wrapper div that establishes the relative center for positioning the numpad */}
            <div className="relative">

                {/* NEW: Numpad container is positioned absolutely relative to the wrapper */}
                <div ref={padRef} className="absolute top-1/2 -translate-y-1/2 right-full mr-4 flex-shrink-0">
                    {activeInput && (activeType === 'pd' || activeType === 're' || activeType === 'mgj') && (
                        <InlineNumpad
                            onInput={handleNumpadInput}
                            onIncrement={() => handleNumpadModify(1)}
                            onDecrement={() => handleNumpadModify(-1)}
                            onClear={handleNumpadClear}
                        />
                    )}
                    {activeInput && activeType === 'f' && (
                        <RomanPad onPick={(n) => setField(activeInput, n)} onClear={() => setField(activeInput, null)} />
                    )}
                </div>
            
                {/* This is the main modal content */}
                <div ref={modalRef} className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                    <h2 className="text-3xl font-bold text-blue-700 mb-4">
                        Edit {surface.charAt(0).toUpperCase() + surface.slice(1)} Data for Tooth #{toothId}
                    </h2>

                    {renderSiteInputs(surface)}

                    {surface === 'buccal' && (
                        <>
                            <div className="my-4 border-t border-gray-200"></div>
                            <div className="flex justify-center">
                                <div className="cursor-pointer" onClick={() => setActiveInput('mgj.b')}>
                                    <ReadOnlyBox label="MGJ" value={data.mgj.b} active={activeInput === 'mgj.b'}/>
                                </div>
                            </div>
                        </>
                    )}

                    {renderLingualExtras()}

                    <div className="flex justify-end gap-3 mt-6">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">
                            Cancel
                        </button>
                        <button onClick={() => onSave(toothId, data)} className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">
                            Save Changes
                        </button>
                    </div>

                    {infoPopup && (
    <div ref={infoRef} className="absolute top-0 left-full ml-4 w-64">
        {infoPopup === 'miller' && (
            <InfoBox title="Miller Classification (1950)">
                <div><strong>Grade I:</strong> The first distinguishable sign of mobility greater than physiologic.</div>
                <div className="mt-1"><strong>Grade II:</strong> Horizontal tooth movement up to 1 mm.</div>
                <div className="mt-1"><strong>Grade III:</strong> Horizontal movement greater than 1 mm and/or any vertical movement.</div>
            </InfoBox>
        )}
        {infoPopup === 'hamp' && (
            <InfoBox title="Hamp Classification (1975)">
                <div><strong>Class I:</strong> Horizontal furcation involvement of less than 3 mm.</div>
                <div className="mt-1"><strong>Class II:</strong> Horizontal involvement of more than 3 mm, but not through-and-through.</div>
                <div className="mt-1"><strong>Class III:</strong> A complete through-and-through furcation involvement.</div>
            </InfoBox>
        )}
    </div>
)}
                </div>
            </div>
        </div>
    );
};

export default EditDataModal;