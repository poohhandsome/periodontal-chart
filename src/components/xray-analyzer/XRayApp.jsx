import React, { useState } from 'react';
import XRayMount from './XRayMount';
import ImageAnalyzer from './ImageAnalyzer';
import { slotConfigurations } from '../../xray-config';

const TOTAL_SLOTS = 18;

const initialSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
  id: i,
  processedImage: null,
  reports: [],
}));

const XRayApp = () => {
  const [slots, setSlots] = useState(initialSlots);
  const [activeSlotId, setActiveSlotId] = useState(null);

  const handleSlotClick = (id) => {
    setActiveSlotId(id);
  };

  const handleCloseAnalyzer = () => {
    setActiveSlotId(null);
  };

  const handleSaveReport = (updatedSlotData) => {
    setSlots(prevSlots =>
      prevSlots.map(slot =>
        slot.id === updatedSlotData.id ? { ...slot, ...updatedSlotData } : slot
      )
    );
    setActiveSlotId(null);
  };

  const activeSlot = activeSlotId !== null ? slots.find(s => s.id === activeSlotId) : null;
  const initialAnalyzerData = activeSlot?.processedImage ? {
      processedImage: activeSlot.processedImage,
      reports: activeSlot.reports
  } : undefined;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center p-4">
        <div className="w-full max-w-7xl">
            <header className="text-center mb-8 relative">
                <a href="#" className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 font-semibold">&larr; Back to Home</a>
                <h1 className="text-4xl font-bold text-blue-700">Dental X-Ray Prognosis Assistant</h1>
                <p className="text-lg text-gray-600 mt-2">Upload, analyze, and diagnose periodontal health based on McGuire & Nunn (1996).</p>
            </header>
            
            <main className="w-full">
                <XRayMount slots={slots} onSlotClick={handleSlotClick} />
            </main>

            <footer className="text-center mt-8 text-gray-600 text-sm">
                <p>This tool is for educational and illustrative purposes only. Not for clinical diagnosis.</p>
                <p>Prognosis based on simplified CAL % from McGuire, M. K., & Nunn, M. E. (1996).</p>
            </footer>
        </div>

        {activeSlotId !== null && (
            <ImageAnalyzer
                slotId={activeSlotId}
                isVertical={slotConfigurations[activeSlotId].isVertical}
                initialData={initialAnalyzerData}
                onClose={handleCloseAnalyzer}
                onSave={handleSaveReport}
            />
        )}
    </div>
  );
};

export default XRayApp;
