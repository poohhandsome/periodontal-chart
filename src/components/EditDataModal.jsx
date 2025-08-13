// src/components/EditDataModal.jsx
import React, { useState, useEffect, useRef } from 'react';
import InlineNumpad from './InlineNumpad';

const EditInput = ({ label, value, onFocus, onChange }) => (
    <div className="flex flex-col items-center">
        <label className="text-sm font-semibold text-gray-600">{label}</label>
        <input
            type="number"
            value={value ?? ''}
            onFocus={onFocus}
            onChange={e => onChange(e.target.value)}
            readOnly
            className="w-16 h-12 mt-1 text-center text-xl font-bold bg-gray-100 border-2 border-transparent focus:border-blue-500 focus:bg-white rounded-md outline-none"
        />
    </div>
);

const EditDataModal = ({ toothId, surface, initialData, onSave, onClose }) => {
    const [data, setData] = useState(initialData);
    const [activeInput, setActiveInput] = useState(null);
    const modalRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (modalRef.current && !modalRef.current.contains(event.target)) {
                setActiveInput(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleInputChange = (field, newValue) => {
        const [type, site] = field.split('.');
        const parsedValue = newValue === '' ? null : parseInt(newValue, 10);
        
        setData(prev => {
            const newData = JSON.parse(JSON.stringify(prev));
            if (type === 'mgj') {
                newData.mgj.b = parsedValue;
            } else {
                newData[type][site] = parsedValue;
            }
            return newData;
        });
    };

    const handleNumpadInput = (num) => {
        if (!activeInput) return;
        const [type, site] = activeInput.split('.');
        const currentValue = (type === 'mgj' ? data.mgj.b : data[type][site]) ?? '';
        const newValue = currentValue.toString() + num.toString();
        handleInputChange(activeInput, newValue);
    };

    const handleNumpadModify = (amount) => {
        if (!activeInput) return;
        const [type, site] = activeInput.split('.');
        const currentValue = (type === 'mgj' ? data.mgj.b : data[type][site]) ?? 0;
        handleInputChange(activeInput, currentValue + amount);
    };

    const handleNumpadClear = () => {
        if (!activeInput) return;
        handleInputChange(activeInput, '');
    };

    const renderSiteInputs = (inputSurface) => {
        const sites = inputSurface === 'buccal' ? ['db', 'b', 'mb'] : ['dl', 'l', 'ml'];
        return (
            <div className="grid grid-cols-3 gap-4">
                {sites.map(site => (
                    <div key={inputSurface + site} className="flex flex-col gap-2">
                        <EditInput label={`PD ${site.toUpperCase()}`} value={data.pd[site]} onFocus={() => setActiveInput(`pd.${site}`)} onChange={(val) => handleInputChange(`pd.${site}`, val)} />
                        <EditInput label={`RE ${site.toUpperCase()}`} value={data.re[site]} onFocus={() => setActiveInput(`re.${site}`)} onChange={(val) => handleInputChange(`re.${site}`, val)} />
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div ref={modalRef} className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
                <h2 className="text-3xl font-bold text-blue-700 mb-4">Edit {surface.charAt(0).toUpperCase() + surface.slice(1)} Data for Tooth #{toothId}</h2>
                
                {renderSiteInputs(surface)}

                {surface === 'buccal' && (
                    <>
                        <div className="my-4 border-t border-gray-200"></div>
                        <div className="flex justify-center">
                            <EditInput label="MGJ" value={data.mgj.b} onFocus={() => setActiveInput('mgj.b')} onChange={(val) => handleInputChange('mgj.b', val)} />
                        </div>
                    </>
                )}

                {activeInput && (
                    <div className="absolute top-1/2 -translate-y-1/2 right-full mr-4">
                        <InlineNumpad 
                            onInput={handleNumpadInput}
                            onIncrement={() => handleNumpadModify(1)}
                            onDecrement={() => handleNumpadModify(-1)}
                            onClear={handleNumpadClear}
                        />
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={onClose} className="px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors">Cancel</button>
                  <button onClick={() => onSave(toothId, data)} className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors">Save Changes</button>
                </div>
            </div>
        </div>
    );
};

export default EditDataModal;