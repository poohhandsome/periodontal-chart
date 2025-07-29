import React from 'react';

const HistoryPanel = ({ history, onLoad, onDelete }) => {
  if (!history || history.length === 0) {
    return (
      <div className="mt-6 bg-white p-4 rounded-xl shadow-lg text-center">
        <h3 className="text-xl font-bold text-blue-700 mb-2">Chart History</h3>
        <p className="text-gray-500">No charts have been saved yet. Click "Save Chart" to start a history.</p>
      </div>
    );
  }

  return (
    <div className="mt-6 bg-white p-4 rounded-xl shadow-lg">
      <h3 className="text-xl font-bold text-blue-700 mb-3 border-b pb-2">Chart History</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {history.map(item => (
          <div key={item.id} className="flex justify-between items-center p-2 rounded-lg bg-gray-50 hover:bg-gray-100">
            <span className="font-semibold text-gray-700">
              {new Date(item.date).toLocaleString()}
            </span>
            <div className="space-x-2">
              <button
                onClick={() => onLoad(item.id)}
                className="px-3 py-1 text-sm font-semibold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Load
              </button>
              <button
                onClick={() => onDelete(item.id)}
                className="px-3 py-1 text-sm font-semibold bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;