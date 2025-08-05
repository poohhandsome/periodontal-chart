// src/components/Numpad.jsx

import React, { useState, useRef, useEffect } from 'react';

const NumpadButton = ({ value, onSelect, className = '' }) => (
  <button
    onClick={() => onSelect(value)}
    className={`w-16 h-12 flex justify-center items-center rounded-md text-lg font-semibold transition-all duration-150 border
                bg-white text-gray-700 border-gray-300 hover:bg-blue-500 hover:text-white hover:border-blue-500
                ${className}`}
  >
    {value}
  </button>
);

const CustomInput = ({ title, onSave, onCancel }) => {
    const [val, setVal] = useState('');
    const inputRef = useRef(null);
    useEffect(() => { inputRef.current?.focus(); }, []);
    
    const handleSave = (e) => {
        e.preventDefault();
        const num = parseInt(val, 10);
        if (!isNaN(num)) onSave(num);
    };
    
    return (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex items-center justify-center">
            <form onSubmit={handleSave} className="bg-white p-4 rounded-lg shadow-2xl border border-gray-200">
                <h4 className="font-semibold mb-2 text-gray-800">{title}</h4>
                <input 
                    ref={inputRef}
                    type="number"
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    className="w-full p-2 bg-gray-100 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="flex justify-end gap-2 mt-3">
                    <button type="button" onClick={onCancel} className="px-4 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300">Cancel</button>
                    <button type="submit" className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                </div>
            </form>
        </div>
    )
}

const Numpad = ({ chartingInfo, onInput, onBopSelect, onClose }) => {
  const { toothId, surface, site, sites, type, teeth } = chartingInfo;
  const [bopSelection, setBopSelection] = useState([]);
  const [showCustomInput, setShowCustomInput] = useState(false);

  // For BOP, we allow selecting bleeding sites for the entire surface at once.
  const toggleBop = (toothIdentifier, siteIdentifier) => {
    const key = `${toothIdentifier}-${siteIdentifier}`;
    setBopSelection(prev => 
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };
  
  const renderContent = () => {
    let title, buttons, infoText;
    
    switch (type) {
      case 'pd':
        title = `Probing Depth (mm)`;
        infoText = `Tooth ${toothId} - ${surface.charAt(0).toUpperCase()} - ${site.toUpperCase()}`;
        buttons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, '+'];
        break;
      case 're':
        title = 'Gingival Margin / Recession (mm)';
        infoText = `Tooth ${toothId} - ${surface.charAt(0).toUpperCase()} - ${site.toUpperCase()}`;
        buttons = [-3, -2, -1, 0, 1, 2, 3, 4, 5, '+'];
        break;
      case 'mgj':
        title = 'Mucogingival Junction (mm)';
        infoText = `Surface: ${surface.toUpperCase()} - Center`;
        buttons = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, '+'];
        break;
      case 'bop':
        // The BOP screen is now for the entire surface.
        return (
          <>
            <h3 className="font-bold text-blue-700 text-lg">Bleeding on Probing?</h3>
            <p className="text-gray-600 text-sm">Select bleeding sites for surface: {surface.toUpperCase()}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
                {teeth.map(tId => (
                    <div key={tId} className="flex flex-col items-center gap-1 p-2 bg-gray-100 rounded-md">
                        <span className="text-sm font-bold">{tId}</span>
                        <div className="flex gap-1">
                        {sites.map(s => {
                            const key = `${tId}-${s}`;
                            return (
                                <button key={key} onClick={() => toggleBop(tId, s)}
                                    className={`w-10 h-8 text-xs rounded uppercase font-bold text-white transition-colors ${bopSelection.includes(key) ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-400 hover:bg-gray-500'}`}>
                                    {s}
                                </button>
                            )
                        })}
                        </div>
                    </div>
                ))}
            </div>
            <div className="mt-4 flex justify-center">
                 <button onClick={() => onBopSelect(bopSelection)} className="w-48 h-12 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold">
                    Continue
                </button>
            </div>
          </>
        );
      default: return null;
    }

    return (
      <>
        <h3 className="font-bold text-blue-700 text-lg">{infoText}</h3>
        <p className="text-gray-600 text-sm">{title}</p>
        <div className="flex justify-center items-center gap-4 mt-4">
          <div className="flex flex-wrap justify-center gap-2">
            {buttons.map((val) => (
              <NumpadButton key={val} value={val}
                onSelect={val === '+' ? () => setShowCustomInput(true) : onInput}
                className={val === '+' ? 'text-blue-600 font-bold border-blue-400' : ''}
              />
            ))}
          </div>
        </div>
        {showCustomInput && <CustomInput title={title} onSave={onInput} onCancel={() => setShowCustomInput(false)} />}
      </>
    );
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-100/80 backdrop-blur-sm border-t border-gray-200 p-4 z-50">
      <div className="max-w-4xl mx-auto text-center relative">
        <button onClick={onClose} className="absolute top-0 right-0 text-gray-400 hover:text-gray-700 font-bold text-2xl leading-none">&times;</button>
        {renderContent()}
      </div>
    </div>
  );
};

export default Numpad;
