import React, { useState, useEffect, useRef } from 'react';
import XRayMount from './XRayMount';
import ImageAnalyzer from './ImageAnalyzer';
import { slotConfigurations } from '../../xray-config';
import jsPDF from 'jspdf'; // 2. Import jsPDF
import html2canvas from 'html2canvas'; // 3. Import html2canvas

const TOTAL_SLOTS = 18;

const initialSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
  id: i,
  processedImage: null,
  reports: [],
}));
// Function to load data from localStorage
const loadSavedData = () => {
  try {
    const savedData = localStorage.getItem('xrayMountData');
    return savedData ? JSON.parse(savedData) : initialSlots;
  } catch (error) {
    console.error("Could not load saved X-ray data:", error);
    return initialSlots;
  }
};

const XRayApp = () => {
    // 2. Initialize state by loading saved data
  const [slots, setSlots] = useState(loadSavedData);
  const [activeSlotId, setActiveSlotId] = useState(null);

  // 3. Add this useEffect hook to save data on any change
  useEffect(() => {
    try {
      localStorage.setItem('xrayMountData', JSON.stringify(slots));
    } catch (error) {
      console.error("Could not save X-ray data:", error);
    }
  }, [slots]); // This hook runs whenever the 'slots' state changes

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
  const xrayMountRef = useRef(null);
  const handleExportPDF = () => {
    const mountElement = xrayMountRef.current;
    if (!mountElement) return;

    // Use html2canvas to capture the mount as an image
    html2canvas(mountElement).then(canvas => {
      const imgData = canvas.toDataURL('image/png');
      
      // Create a new PDF document
      // 'l' for landscape, 'mm' for millimeters, 'a4' for size
      const pdf = new jsPDF('l', 'mm', 'a4'); 
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Add the captured image to the PDF
      pdf.addImage(imgData, 'PNG', 10, 10, pdfWidth - 20, 0, undefined, 'FAST');
      
      // Add title and other details
      pdf.setFontSize(18);
      pdf.text('Dental X-Ray Analysis Report', pdfWidth / 2, pdfHeight - 15, { align: 'center' });

      // Save the PDF
      pdf.save("xray-report.pdf");
    });
  };
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center p-4">
        <div className="w-full max-w-7xl">
            <header className="text-center mb-8 relative">
                <a href="#" className="absolute left-0 top-1/2 -translate-y-1/2 text-blue-600 hover:text-blue-800 font-semibold">&larr; Back to Home</a>
                <h1 className="text-4xl font-bold text-blue-700">Dental X-Ray Prognosis Assistant</h1>
                <p className="text-lg text-gray-600 mt-2">Upload, analyze, and diagnose periodontal health based on McGuire & Nunn (1996).</p>
                <button 
                  onClick={handleExportPDF} 
                  className="absolute right-0 top-1/2 -translate-y-1/2 bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                >
                  Export as PDF
                </button>
            </header>
            
            <main className="w-full" ref={xrayMountRef}>
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
