// src/components/PlaqueIndex.jsx
import React from 'react';

const PlaqueIndex = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-blue-700">Plaque Index</h1>
        <p className="text-lg text-gray-600 mt-2">This feature is currently under construction.</p>
        <p className="text-gray-500 mt-1">Check back soon for the O'Leary Plaque Index tool!</p>
        <a 
          href="#" 
          className="mt-8 inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
        >
          Back to Home
        </a>
      </div>
    </div>
  );
};

export default PlaqueIndex;