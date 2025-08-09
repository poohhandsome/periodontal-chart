// src/components/SequenceCustomizer.jsx
import React, { useState } from 'react';

// Helper to get the color for each quadrant
const getQuadrantColor = (id) => {
    if (id.startsWith('Q1')) return 'bg-blue-500';
    if (id.startsWith('Q2')) return 'bg-green-500';
    if (id.startsWith('Q3')) return 'bg-orange-500';
    if (id.startsWith('Q4')) return 'bg-purple-500';
    return 'bg-gray-400';
};

const SequenceItem = ({ item, onToggleDirection, onMove, isFirst, isLast }) => {
  return (
    <div
      className="flex items-center justify-between p-2 bg-white border border-gray-200 rounded-lg shadow-sm select-none"
    >
        <div className="flex items-center gap-3">
            {/* --- NEW, TOUCH-FRIENDLY MOVER BUTTONS (SIDE-BY-SIDE) --- */}
            <div className="flex items-center gap-2">
                {/* UP Button */}
                <button
                    onClick={() => onMove('up')}
                    disabled={isFirst}
                    className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Up"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transform rotate-90">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                {/* DOWN Button */}
                 <button
                    onClick={() => onMove('down')}
                    disabled={isLast}
                    className="p-2 rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Down"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transform -rotate-90">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
            </div>
            {/* Quadrant Color Dot */}
            <div className={`w-3 h-3 rounded-full ${getQuadrantColor(item.id)}`}></div>
            <span className="font-semibold text-gray-700">{item.label}</span>
        </div>
      {/* Direction Toggle Button */}
      <button
        onClick={() => onToggleDirection(item.id)}
        className="p-1 rounded-full hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
        title={`Toggle direction (current: ${item.direction === 'LR' ? 'Left-to-Right' : 'Right-to-Left'})`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-300 ${item.direction === 'RL' ? 'transform rotate-180' : ''}`}
        >
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </svg>
      </button>
    </div>
  );
};

const SequenceCustomizer = ({ sequence, onSequenceChange, onClose }) => {
  const [localSequence, setLocalSequence] = useState(sequence);

  const handleMove = (index, direction) => {
    const newSequence = [...localSequence];
    const item = newSequence[index];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newSequence.length) return;
    newSequence.splice(index, 1);
    newSequence.splice(newIndex, 0, item);
    setLocalSequence(newSequence);
  };

  const handleToggleDirection = (id) => {
    setLocalSequence(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, direction: item.direction === 'LR' ? 'RL' : 'LR' }
          : item
      )
    );
  };

  const handleSave = () => {
    onSequenceChange(localSequence);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-60 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col max-h-[90vh]">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Customize Charting Sequence</h2>
        <p className="text-sm text-gray-600 mb-4">
          Use the arrows to reorder your charting workflow. Use the arrow buttons on the right to change the measurement direction.
        </p>
        <div className="space-y-2 overflow-y-auto flex-grow pr-2">
          {localSequence.map((item, index) => (
            <SequenceItem
              key={item.id}
              item={item}
              onToggleDirection={handleToggleDirection}
              onMove={(direction) => handleMove(index, direction)}
              isFirst={index === 0}
              isLast={index === localSequence.length - 1}
            />
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg font-semibold bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Save Sequence
          </button>
        </div>
      </div>
    </div>
  );
};

export default SequenceCustomizer;