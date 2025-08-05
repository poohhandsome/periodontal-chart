// src/components/SequenceCustomizer.jsx
import React, { useState } from 'react';

const DraggableItem = ({ item, index, onDragStart, onDragOver, onDrop, onToggleDirection }) => {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, index)}
      className="flex items-center justify-between p-2 bg-white border rounded-lg shadow-sm cursor-grab active:cursor-grabbing"
    >
      <span className="font-semibold text-gray-700">{item.label}</span>
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
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, droppedOnIndex) => {
    e.preventDefault();
    const draggedItem = localSequence[draggedIndex];
    const newSequence = [...localSequence];
    newSequence.splice(draggedIndex, 1);
    newSequence.splice(droppedOnIndex, 0, draggedItem);
    setLocalSequence(newSequence);
    setDraggedIndex(null);
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
          Drag and drop the blocks to reorder your charting workflow. Use the arrow buttons to change the direction for each segment.
        </p>
        <div className="space-y-2">
          {localSequence.map((item, index) => (
            <DraggableItem
              key={item.id}
              item={item}
              index={index}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onToggleDirection={handleToggleDirection}
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
