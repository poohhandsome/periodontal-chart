import React, { useState, useEffect } from 'react';
import XRayMount from './XRayMount';
import ImageAnalyzer from './ImageAnalyzer';
import ReportSummary from './ReportSummary';
import { slotConfigurations } from '../../xray-config';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Dropdown from '../Dropdown';
import HistoryPanel from '../HistoryPanel';
import PatientInfo from '../PatientInfo';

const TOTAL_SLOTS = 18;

// --- helpers ---------------------------------------------------------------
const freshState = () => ({
  slots: Array.from({ length: TOTAL_SLOTS }, (_, i) => ({
    id: i,
    processedImage: null,
    reports: [],
  })),
  summaryFindings: {
    furcationInvolvement: [],
    wideningPDL: [],
    caries: [],
    defectiveRestoration: [],
    calculus: [],
    rootProximity: [],
    periapicalLesion: [],
    other: [],
  },
  patientHN: '',
  patientName: '',
});

const getInitialState = () => {
  const savedState = localStorage.getItem('xrayCurrentState');
  if (savedState) {
    try {
      return JSON.parse(savedState);
    } catch (e) {
      console.error('Failed to parse saved X-ray state:', e);
      return freshState();
    }
  }
  return freshState();
};

// --- component ------------------------------------------------------------
const XRayApp = () => {
  const [appState, setAppState] = useState(getInitialState);
  const [history, setHistory] = useState(() => {
    const savedHistory = localStorage.getItem('xrayHistory');
    try { return savedHistory ? JSON.parse(savedHistory) : []; } catch { return []; }
  });
  const [activeSlotId, setActiveSlotId] = useState(null);
  // Bump this to force-remount child components that may keep internal state
  const [viewVersion, setViewVersion] = useState(0);

  const { slots, summaryFindings, patientHN, patientName } = appState;

  // persist current working state
  useEffect(() => {
    localStorage.setItem('xrayCurrentState', JSON.stringify(appState));
  }, [appState]);

  // persist history list
  useEffect(() => {
    localStorage.setItem('xrayHistory', JSON.stringify(history));
  }, [history]);

  const handleSlotClick = (id) => setActiveSlotId(id);
  const handleCloseAnalyzer = () => setActiveSlotId(null);

  const handleSaveReport = (updatedSlotData) => {
    const newSlots = slots.map((slot) =>
      slot.id === updatedSlotData.id ? { ...slot, ...updatedSlotData } : slot
    );
    setAppState((prev) => ({ ...prev, slots: newSlots }));
    setActiveSlotId(null);
  };

  const handleUpdateBoneLossType = (toothNumber, type) => {
    const newSlots = slots.map((slot) => ({
      ...slot,
      reports: slot.reports.map((report) =>
        report.toothNumber === toothNumber ? { ...report, boneLossType: type } : report
      ),
    }));
    setAppState((prev) => ({ ...prev, slots: newSlots }));
  };

  // Auto-draft: uses current HN/Name, no prompt
  const handleSaveDraft = () => {
    const draftTitle = `${patientHN || 'NoHN'} - ${patientName || 'NoName'}`;
    const newHistoryEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      draftTitle,                // human-readable title
      patientHN: patientHN || '',
      patientName: patientName || '',
      data: appState,            // full app snapshot
    };
    setHistory((prev) => [newHistoryEntry, ...prev]);
    alert('Draft saved successfully!');
  };

  const handleLoadDraft = (id) => {
    const draftToLoad = history.find((item) => item.id === id);
    if (draftToLoad) {
      setAppState(draftToLoad.data);
      setViewVersion((v) => v + 1); // ensure children refresh if they hold local state
      alert(`Draft "${draftToLoad.draftTitle || draftToLoad.patientName}" loaded successfully.`);
    }
  };

  const handleDeleteDraft = (id) => {
    if (window.confirm('Are you sure you want to delete this draft?')) {
      setHistory((prev) => prev.filter((item) => item.id !== id));
    }
  };

  const handleClearChart = () => {
    if (
      window.confirm(
        'Are you sure you want to clear the current chart data? This will not affect your saved history.'
      )
    ) {
      setAppState(freshState());
      setViewVersion((v) => v + 1);
      alert('Chart has been cleared.');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${patientHN || 'NoHN'}-${patientName || 'NoName'}-XRayAnalysis.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const loadedData = JSON.parse(e.target.result);
        const required =
          loadedData &&
          loadedData.slots &&
          loadedData.summaryFindings &&
          'patientHN' in loadedData &&
          'patientName' in loadedData;

        if (required) {
          setAppState(loadedData);
          setViewVersion((v) => v + 1); // refresh child components
          alert('X-Ray analysis file loaded successfully!');
        } else {
          alert('Invalid X-Ray analysis file format.');
        }
      } catch (error) {
        console.error('Error parsing uploaded file:', error);
        alert('Error reading or parsing the file.');
      }
    };

    reader.readAsText(file);
    // allow re-uploading the same file
    event.target.value = null;
  };

  const handleExportPDF = async (hn, name) => {
    const section1 = document.getElementById('pdf-section-1');
    const section2 = document.getElementById('pdf-section-2');
    const section3 = document.getElementById('pdf-section-3');

    if (!section1 || !section2 || !section3) {
      alert('Could not find all report sections to export.');
      return;
    }

    const loadingIndicator = document.createElement('div');
    loadingIndicator.innerHTML = 'Generating PDF, please wait... (Page 1 of 3)';
    loadingIndicator.style.cssText =
      'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background: white; border-radius: 10px; box-shadow: 0 0 15px rgba(0,0,0,0.2); z-index: 1000;';
    document.body.appendChild(loadingIndicator);

    try {
      const pdf = new jsPDF('l', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      const contentWidth = pdfWidth - margin * 2;
      const canvasOptions = { scale: 2 };

      const addHeader = (pdfInstance, pageNum, totalPages) => {
        pdfInstance.setFontSize(10);
        pdfInstance.text(`Patient HN: ${hn || 'N/A'}`, margin, margin);
        pdfInstance.text(`Patient Name: ${name || 'N/A'}`, margin, margin + 7);
        pdfInstance.text(`Page ${pageNum} of ${totalPages}`, pdfWidth - margin, margin, { align: 'right' });
      };

      // Page 1
      addHeader(pdf, 1, 3);
      const canvas1 = await html2canvas(section1, canvasOptions);
      const img1Data = canvas1.toDataURL('image/png');
      const img1Props = pdf.getImageProperties(img1Data);
      const pdf1Height = (img1Props.height * contentWidth) / img1Props.width;
      pdf.addImage(img1Data, 'PNG', margin, margin + 14, contentWidth, pdf1Height);

      // Page 2
      loadingIndicator.innerHTML = 'Generating PDF, please wait... (Page 2 of 3)';
      pdf.addPage();
      addHeader(pdf, 2, 3);
      const canvas2 = await html2canvas(section2, canvasOptions);
      const img2Data = canvas2.toDataURL('image/png');
      const img2Props = pdf.getImageProperties(img2Data);
      const pdf2Height = (img2Props.height * contentWidth) / img2Props.width;
      pdf.addImage(img2Data, 'PNG', margin, margin + 14, contentWidth, pdf2Height);

      // Page 3
      loadingIndicator.innerHTML = 'Generating PDF, please wait... (Page 3 of 3)';
      pdf.addPage();
      addHeader(pdf, 3, 3);
      const canvas3 = await html2canvas(section3, canvasOptions);
      const img3Data = canvas3.toDataURL('image/png');
      const img3Props = pdf.getImageProperties(img3Data);
      const pdf3Height = (img3Props.height * contentWidth) / img3Props.width;
      pdf.addImage(img3Data, 'PNG', margin, margin + 14, contentWidth, pdf3Height);

      const fileName = `${hn || 'NoHN'}-${name || 'NoName'}-XRay-Report.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('An error occurred while generating the PDF.');
    } finally {
      document.body.removeChild(loadingIndicator);
    }
  };

  const activeSlot = activeSlotId !== null ? slots.find((s) => s.id === activeSlotId) : null;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center p-4">
      <div className="w-full max-w-7xl">
        <header className="text-center mb-8 relative flex justify-between items-center">
          <a href="#" className="text-blue-600 hover:text-blue-800 font-semibold">&larr; Back to Home</a>
          <div>
            <h1 className="text-4xl font-bold text-blue-700">Dental X-Ray Prognosis Assistant</h1>
            <p className="text-lg text-gray-600 mt-2">Upload, analyze, and diagnose periodontal health based on McGuire & Nunn (1996).</p>
          </div>
          <div className="flex items-center gap-2">
            <Dropdown label="File">
              <button onClick={handleSaveDraft} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Save Draft</button>
              <button onClick={handleDownload} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download JSON</button>
              <label className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                Upload JSON
                <input type="file" accept=".json" className="hidden" onChange={handleUpload} />
              </label>
              <div className="my-1 border-t border-gray-200" />
              <button onClick={() => handleExportPDF(patientHN, patientName)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Export as PDF</button>
              <div className="my-1 border-t border-gray-200" />
              <button onClick={handleClearChart} className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50">Clear Chart</button>
            </Dropdown>
          </div>
        </header>

        <div id="pdf-section-1" key={`sec1-${viewVersion}`}>
          <div className="mb-4">
            <PatientInfo
              patientHN={patientHN}
              setPatientHN={(hn) => setAppState((prev) => ({ ...prev, patientHN: hn }))}
              patientName={patientName}
              setPatientName={(name) => setAppState((prev) => ({ ...prev, patientName: name }))}
            />
          </div>
          <XRayMount slots={slots} onSlotClick={handleSlotClick} key={`mount-${viewVersion}`} />
        </div>

        <main className="w-full mt-8" id="pdf-section-2" key={`sec2-${viewVersion}`}>
          <ReportSummary
            slots={slots}
            findings={summaryFindings}
            onUpdateFindings={(findings) => setAppState((prev) => ({ ...prev, summaryFindings: findings }))}
            onUpdateBoneLossType={handleUpdateBoneLossType}
          />
        </main>

        <div className="mt-8" id="pdf-section-3" key={`sec3-${viewVersion}`}>
          <HistoryPanel history={history} onLoad={handleLoadDraft} onDelete={handleDeleteDraft} />
        </div>

        <footer className="text-center mt-8 text-gray-600 text-sm">
          <p>This tool is for educational and illustrative purposes only. Not for clinical diagnosis.</p>
          <p>Prognosis based on simplified CAL % from McGuire, M. K., & Nunn, M. E. (1996).</p>
        </footer>
      </div>

      {activeSlotId !== null && (
        <ImageAnalyzer
          slotId={activeSlotId}
          isVertical={slotConfigurations[activeSlotId].isVertical}
          initialData={
            activeSlot?.processedImage
              ? { processedImage: activeSlot.processedImage, reports: activeSlot.reports }
              : undefined
          }
          onClose={handleCloseAnalyzer}
          onSave={handleSaveReport}
        />
      )}
    </div>
  );
};

export default XRayApp;
