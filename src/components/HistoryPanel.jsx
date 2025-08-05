// src/components/HistoryPanel.jsx
import React, { useState, useEffect } from 'react';

const HistoryItem = ({ item, onLoad, onDelete }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        // Set up an interval to update the countdown every second
        const timer = setInterval(() => {
            const expirationDate = new Date(item.date);
            expirationDate.setDate(expirationDate.getDate() + 7);
            const now = new Date();
            const difference = expirationDate - now;

            if (difference <= 0) {
                // This item has expired. The parent component's cleanup will handle removal on next app load.
                setTimeLeft('Expired');
                clearInterval(timer); // Stop the timer for this item
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
            const minutes = Math.floor((difference / 1000 / 60) % 60);
            const seconds = Math.floor((difference / 1000) % 60);

            setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
        }, 1000);

        // Cleanup function to clear the interval when the component unmounts
        return () => clearInterval(timer);
    }, [item.date]);

    // Function to determine the color of the countdown timer based on time remaining
    const getCountdownColor = () => {
        const expirationDate = new Date(item.date);
        expirationDate.setDate(expirationDate.getDate() + 7);
        const now = new Date();
        const difference = expirationDate - now;
        const daysLeft = difference / (1000 * 60 * 60 * 24);

        if (daysLeft < 2) return 'text-red-500'; // Less than 2 days left
        if (daysLeft < 4) return 'text-yellow-500'; // Less than 4 days left
        return 'text-green-500'; // 4 or more days left
    };

    // Format the display name for the history item
    const displayName = `${item.patientHN || 'NoHN'} - ${item.patientName || 'NoName'} - ${new Date(item.date).toLocaleString()}`;

    return (
        <div className="flex justify-between items-center p-2 rounded-lg bg-gray-50 hover:bg-gray-100">
            <div className="flex-grow overflow-hidden">
                <span className="font-semibold text-gray-700 block truncate" title={displayName}>{displayName}</span>
                <span className={`text-xs font-mono ${getCountdownColor()}`}>
                    Deletes in: {timeLeft}
                </span>
            </div>
            <div className="space-x-2 flex-shrink-0 ml-4">
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
    );
};


const HistoryPanel = ({ history, onLoad, onDelete }) => {
  if (!history || history.length === 0) {
    return (
      <div className="mt-6 bg-white p-4 rounded-xl shadow-lg text-center">
        <h3 className="text-xl font-bold text-blue-700 mb-2">Chart History</h3>
        <p className="text-gray-500">No charts have been saved yet. Click "Save Chart" to start a history.</p>
      </div>
    );
  }

  // Sort history to show the newest entries first
  const sortedHistory = [...history].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="mt-6 bg-white p-4 rounded-xl shadow-lg">
      <h3 className="text-xl font-bold text-blue-700 mb-3 border-b pb-2">Chart History</h3>
      <div className="space-y-2 max-h-60 overflow-y-auto">
        {sortedHistory.map(item => (
          <HistoryItem key={item.id} item={item} onLoad={onLoad} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
};

export default HistoryPanel;
