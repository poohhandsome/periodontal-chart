// src/components/SequenceCustomizer.jsx
import React, { useState, useRef } from 'react';

// Helper to get the color for each quadrant
const getQuadrantColor = (id) => {
    if (id.startsWith('Q1')) return 'bg-blue-500';
    if (id.startsWith('Q2')) return 'bg-green-500';
    if (id.startsWith('Q3')) return 'bg-orange-500';
    if (id.startsWith('Q4')) return 'bg-purple-500';
    return 'bg-gray-400';
};

const SequenceItem = ({ item, onToggleDirection, onDragStart, onDragOver, onDrop, onDragEnd, isDraggedOver }) => {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center justify-between p-2 bg-white border rounded-lg shadow-sm transition-all duration-150 ${isDraggedOver ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-200'}`}
    >
        <div className="flex items-center gap-3">
            {/* Drag Handle */}
            <div className="cursor-move text-gray-400" title="Drag to reorder">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="1"></circle>
                    <circle cx="12" cy="5" r="1"></circle>
                    <circle cx="12" cy="19" r="1"></circle>
                </svg>
            </div>
            {/* Quadrant Color Dot */}
            <div className={`w-3 h-3 rounded-full ${getQuadrantColor(item.id)}`}></div>
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
  const dragItem = useRef(null);
  const dragOverItem = useRef(null);

  const handleToggleDirection = (id) => {
    setLocalSequence(prev =>
      prev.map(item =>
        item.id === id
          ? { ...item, direction: item.direction === 'LR' ? 'RL' : 'LR' }
          : item
      )
    );
  };
  
  const handleDragSort = () => {
    const sequenceClone = [...localSequence];
    const draggedItemContent = sequenceClone.splice(dragItem.current, 1)[0];
    sequenceClone.splice(dragOverItem.current, 0, draggedItemContent);
    dragItem.current = null;
    dragOverItem.current = null;
    setLocalSequence(sequenceClone);
  };

  const handleSave = () => {
    onSequenceChange(localSequence);
    onClose();
  };

  return (
    // Increased z-index to z-60 to appear over the VoiceHUD (z-50)
    <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-60 flex items-center justify-center p-4">
      <div className="bg-gray-50 rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col max-h-[90vh]">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Customize Charting Sequence</h2>
        <p className="text-sm text-gray-600 mb-4">
          Drag and drop to reorder your charting workflow. Use the arrow buttons on the right to change the measurement direction.
        </p>
        {/* Made the list scrollable to ensure buttons are always visible */}
        <div className="space-y-2 overflow-y-auto flex-grow pr-2">
          {localSequence.map((item, index) => (
            <SequenceItem
              key={item.id}
              item={item}
              onToggleDirection={handleToggleDirection}
              onDragStart={() => (dragItem.current = index)}
              onDragEnter={() => (dragOverItem.current = index)}
              onDragEnd={handleDragSort}
              onDragOver={(e) => e.preventDefault()}
              isDraggedOver={dragOverItem.current === index}
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