// src/pages/QRCodePage.jsx
import React from 'react';

const QRCodePage = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Scan to Donate</h1>
        <p className="text-gray-600 mb-6">Your support is greatly appreciated!</p>
        <div className="w-64 h-64 mx-auto border-4 border-gray-200 rounded-lg overflow-hidden">
          <img src="/QR/QR.jpg" alt="Donation QR Code" className="w-full h-full object-contain" />
        </div>
        <a 
          href="#" 
          className="mt-8 inline-block px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition-colors"
        >
          &larr; Back to Home
        </a>
      </div>
    </div>
  );
};

export default QRCodePage;