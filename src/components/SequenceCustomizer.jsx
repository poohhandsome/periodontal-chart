// src/components/SequenceCustomizer.jsx
import React, { useState } from 'react';

const ItemMover = ({ onMove, disabled, direction }) => {
    const isUp = direction === 'up';
    return (
        <button
            onClick={onMove}
            disabled={disabled}
            className="p-1 rounded-full hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
            title={`Move ${isUp ? 'Up' : 'Down'}`}
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
                className={isUp ? 'transform rotate-[-90deg]' : 'transform rotate-90'}
            >
                <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
        </button>
    );
};

const SequenceItem = ({ item, onToggleDirection, onMove, isFirst, isLast }) => {
  return (
    <div
      className="flex items-center justify-between p-2 bg-white border rounded-lg shadow-sm"
    >
        <div className="flex items-center gap-2">
             <div className="flex flex-col">
                <ItemMover onMove={() => onMove('up')} disabled={isFirst} direction="up" />
                <ItemMover onMove={() => onMove('down')} disabled={isLast} direction="down" />
            </div>
            <span className="font-semibold text-gray-700">{item.label}</span>
        </div>
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
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Customize Charting Sequence</h2>
        <p className="text-sm text-gray-600 mb-4">
          Use the arrows to reorder your charting workflow. Use the arrow buttons on the right to change the measurement direction for each segment.
        </p>
        <div className="space-y-2">
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
        <div className="flex justify-end gap-3 mt-6">
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