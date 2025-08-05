// src/components/ChartingModeSelector.jsx
import React from 'react';

const Checkbox = ({ label, value, checked, onChange }) => (
  <label className="flex items-center space-x-2 cursor-pointer text-sm font-medium text-gray-700">
    <input
      type="checkbox"
      value={value}
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
    />
    <span>{label}</span>
  </label>
);

const ChartingModeSelector = ({ modes, onModeChange }) => {
  return (
    <div className="mb-4 bg-white p-4 rounded-xl shadow-lg">
      <h3 className="text-lg font-semibold text-gray-800 mb-2">Charting Modes</h3>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Checkbox
          label="Probing Depth (PD)"
          value="pd"
          checked={modes.pd}
          onChange={onModeChange}
        />
        <Checkbox
          label="Recession (RE)"
          value="re"
          checked={modes.re}
          onChange={onModeChange}
        />
        <Checkbox
          label="Bleeding on Probing (BOP)"
          value="bop"
          checked={modes.bop}
          onChange={onModeChange}
        />
        <Checkbox
          label="Mucogingival Junction (MGJ)"
          value="mgj"
          checked={modes.mgj}
          onChange={onModeChange}
        />
      </div>
    </div>
  );
};

export default ChartingModeSelector;
