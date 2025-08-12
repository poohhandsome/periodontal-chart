import React, { useState, useEffect, useRef } from 'react';
import XRayMount from './XRayMount';
import ImageAnalyzer from './ImageAnalyzer';
import ReportSummary from './ReportSummary'; // Import the new component
import { slotConfigurations } from '../../xray-config';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const TOTAL_SLOTS = 18;

const initialSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
  id: i,
  processedImage: null,
  reports: [],
}));

const initialFindings = {
    furcationInvolvement: [],
    wideningPDL: [],
    caries: [],
    defectiveRestoration: [],
    calculus: [],
    rootProximity: [],
    periapicalLesion: [],
    other: [],
};

// Function to load data from localStorage
const loadSavedData = (key, initialData) => {
  try {
    const savedData = localStorage.getItem(key);
    return savedData ? JSON.parse(savedData) : initialData;
  } catch (error) {
    console.error(`Could not load saved data for ${key}:`, error);
    return initialData;
  }
};

const XRayApp = () => {
    const [slots, setSlots] = useState(() => loadSavedData('xrayMountData', initialSlots));
    const [summaryFindings, setSummaryFindings] = useState(() => loadSavedData('xraySummaryFindings', initialFindings));
    const [activeSlotId, setActiveSlotId] = useState(null);
    const [view, setView] = useState('mount'); // 'mount' or 'summary'

    useEffect(() => {
        try {
            localStorage.setItem('xrayMountData', JSON.stringify(slots));
        } catch (error) {
            console.error("Could not save X-ray data:", error);
        }
    }, [slots]);

    useEffect(() => {
        try {
            localStorage.setItem('xraySummaryFindings', JSON.stringify(summaryFindings));
        } catch (error) {
            console.error("Could not save summary findings:", error);
        }
    }, [summaryFindings]);

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

    const handleUpdateBoneLossType = (toothNumber, type) => {
        setSlots(prevSlots => prevSlots.map(slot => ({
            ...slot,
            reports: slot.reports.map(report => 
                report.toothNumber === toothNumber ? { ...report, boneLossType: type } : report
            )
        })));
    };

    const activeSlot = activeSlotId !== null ? slots.find(s => s.id === activeSlotId) : null;
    const initialAnalyzerData = activeSlot?.processedImage ? {
        processedImage: activeSlot.processedImage,
        reports: activeSlot.reports
    } : undefined;
    
    const pageRef = useRef(null);
    const handleExportPDF = () => {
        const mountElement = pageRef.current;
        if (!mountElement) return;

        html2canvas(mountElement, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;
            const ratio = canvasWidth / canvasHeight;
            const imgWidth = pdfWidth - 20;
            const imgHeight = imgWidth / ratio;
            let position = 10;
            if (imgHeight > pdfHeight - 40) {
                 position = 5;
            }

            pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
            
            pdf.setFontSize(18);
            const title = view === 'mount' ? 'Dental X-Ray Analysis Report' : 'Radiographic Findings Summary';
            pdf.text(title, pdfWidth / 2, pdfHeight - 15, { align: 'center' });

            pdf.save(`${view}-report.pdf`);
        });
    };

    return (
        <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center p-4">
            <div className="w-full max-w-7xl">
                <header className="text-center mb-8 relative flex justify-between items-center">
                    <button 
                        onClick={() => setView(view === 'mount' ? 'summary' : 'mount')} 
                        className="bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        {view === 'mount' ? 'View Report Summary' : 'View X-Ray Mount'}
                    </button>
                    <div>
                        <h1 className="text-4xl font-bold text-blue-700">Dental X-Ray Prognosis Assistant</h1>
                        <p className="text-lg text-gray-600 mt-2">Upload, analyze, and diagnose periodontal health based on McGuire & Nunn (1996).</p>
                    </div>
                    <button
                        onClick={handleExportPDF}
                        className="bg-green-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
                    >
                        Export as PDF
                    </button>
                </header>

                <main className="w-full" ref={pageRef}>
                    {view === 'mount' ? (
                        <XRayMount slots={slots} onSlotClick={handleSlotClick} />
                    ) : (
                        <ReportSummary 
                            slots={slots} 
                            findings={summaryFindings}
                            onUpdateFindings={setSummaryFindings}
                            onUpdateBoneLossType={handleUpdateBoneLossType}
                        />
                    )}
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
