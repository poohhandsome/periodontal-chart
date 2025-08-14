import React, { useState, useEffect, useRef } from 'react';
import XRayMount from './XRayMount';
import ImageAnalyzer from './ImageAnalyzer';
import ReportSummary from './ReportSummary';
import { slotConfigurations } from '../../xray-config';
import Dropdown from '../Dropdown';
import HistoryPanel from '../HistoryPanel';
import PatientInfo from '../PatientInfo';
// Import the new PDF exporter
import { exportXRayReportAsPdf } from '../../utils/xray-pdf-exporter';

const TOTAL_SLOTS = 18;

// ... (keep all the IndexedDB helper functions the same)
const DB_NAME = 'xray-db';
const DB_VERSION = 1;
const KV_STORE = 'kv';
const HISTORY_STORE = 'history';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
      if (!db.objectStoreNames.contains(HISTORY_STORE)) db.createObjectStore(HISTORY_STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSetKV(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(KV_STORE).put(value, key);
  });
}

async function idbGetKV(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(KV_STORE, 'readonly');
    tx.onerror = () => reject(tx.error);
    const req = tx.objectStore(KV_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPutHistory(entry) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(HISTORY_STORE).put(entry);
  });
}

async function idbDeleteHistory(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.objectStore(HISTORY_STORE).delete(id);
  });
}

async function idbGetAllHistory() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_STORE, 'readonly');
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore(HISTORY_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}


const freshState = () => ({
  slots: Array.from({ length: TOTAL_SLOTS }, (_, i) => ({ id: i, processedImage: null, reports: [] })),
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

async function loadInitialState() {
  const fromIDB = await idbGetKV('currentState');
  if (fromIDB) return fromIDB;
  try {
    const legacy = localStorage.getItem('xrayCurrentState');
    if (legacy) {
      const parsed = JSON.parse(legacy);
      await idbSetKV('currentState', parsed);
      return parsed;
    }
  } catch {}
  return freshState();
}

async function loadInitialHistory() {
  const all = await idbGetAllHistory();
  if (all && all.length) return all.sort((a, b) => b.id - a.id);
  try {
    const legacy = localStorage.getItem('xrayHistory');
    if (legacy) {
      const parsed = JSON.parse(legacy) || [];
      for (const entry of parsed) {
        await idbPutHistory(entry);
      }
      return parsed.sort((a, b) => b.id - a.id);
    }
  } catch {}
  return [];
}


const XRayApp = () => {
  const [appState, setAppState] = useState(freshState());
  const [history, setHistory] = useState([]);
  const [activeSlotId, setActiveSlotId] = useState(null);
  const [viewVersion, setViewVersion] = useState(0); 
  const [infoBanner, setInfoBanner] = useState('');
  const [isExporting, setIsExporting] = useState(false); // State for loading indicator
  const persistTimer = useRef(null);

  const { slots, summaryFindings, patientHN, patientName } = appState;

  useEffect(() => {
    (async () => {
      const st = await loadInitialState();
      setAppState(st);
      const hist = await loadInitialHistory();
      setHistory(hist);
    })();
  }, []);

  useEffect(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(async () => {
      try {
        await idbSetKV('currentState', appState);
      } catch (e) {
        console.error('Failed to persist current state to IndexedDB', e);
        setInfoBanner('Could not save current work to device storage.');
      }
    }, 400);
    return () => persistTimer.current && clearTimeout(persistTimer.current);
  }, [appState]);

  const handleSlotClick = (id) => setActiveSlotId(id);
  const handleCloseAnalyzer = () => setActiveSlotId(null);

  const handleSaveReport = (updatedSlotData) => {
    const newSlots = slots.map((slot) => (slot.id === updatedSlotData.id ? { ...slot, ...updatedSlotData } : slot));
    setAppState((prev) => ({ ...prev, slots: newSlots }));
    setActiveSlotId(null);
  };

  const handleUpdateBoneLossType = (toothNumber, side, type) => {
    const reportId = `${toothNumber}${side}`;
    setAppState(prev => {
        const newSlots = prev.slots.map(slot => ({
            ...slot,
            reports: (slot.reports || []).map(report => {
                if (report.id === reportId) {
                    return { ...report, boneLossType: type };
                }
                return report;
            })
        }));
        return { ...prev, slots: newSlots };
    });
  };

  // --- (keep handleSaveDraft, handleLoadDraft, handleDeleteDraft, handleClearChart, handleDownload, handleUpload the same) ---
  const handleSaveDraft = async () => {
    const draftTitle = `${patientHN || 'NoHN'} - ${patientName || 'NoName'}`;
    const entry = {
      id: Date.now(),
      date: new Date().toISOString(),
      draftTitle,
      patientHN: patientHN || '',
      patientName: patientName || '',
      data: appState,
    };
    try {
      await idbPutHistory(entry);
      setHistory((prev) => [entry, ...prev]);
      setInfoBanner('Draft saved to device (IndexedDB).');
    } catch (e) {
      console.error('Failed to save draft to IndexedDB', e);
      setInfoBanner('Failed to save draft to device storage.');
    }
  };

  const handleLoadDraft = async (id) => {
    try {
      const all = await idbGetAllHistory();
      const draft = all.find((d) => d.id === id);
      if (draft) {
        setAppState(draft.data);
        setViewVersion((v) => v + 1);
        setInfoBanner('Draft loaded from device.');
      }
    } catch (e) {
      console.error('Failed to load draft', e);
      setInfoBanner('Failed to load draft.');
    }
  };

  const handleDeleteDraft = async (id) => {
    if (!window.confirm('Are you sure you want to delete this draft?')) return;
    try {
      await idbDeleteHistory(id);
      setHistory((prev) => prev.filter((i) => i.id !== id));
      setInfoBanner('Draft deleted.');
    } catch (e) {
      console.error('Failed to delete draft', e);
      setInfoBanner('Failed to delete draft.');
    }
  };

  const handleClearChart = () => {
    if (window.confirm('Clear the current chart? Saved history remains.')) {
      setAppState(freshState());
      setViewVersion((v) => v + 1);
      setInfoBanner('Chart cleared.');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
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
    reader.onload = async (e) => {
      try {
        const loadedData = JSON.parse(e.target.result);
        const hasCore =
          loadedData && loadedData.slots && loadedData.summaryFindings && 'patientHN' in loadedData && 'patientName' in loadedData;
        if (!hasCore) {
          alert('Invalid X-Ray analysis file format.');
          return;
        }

        setAppState(loadedData);
        setViewVersion((v) => v + 1);
        try { await idbSetKV('currentState', loadedData); } catch {}
        setInfoBanner('File loaded.');
      } catch (error) {
        console.error('Error parsing uploaded file:', error);
        alert('Error reading or parsing the file.');
      }
    };

    reader.readAsText(file);
    event.target.value = null; 
  };


  // --- UPDATED PDF EXPORT HANDLER ---
  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportXRayReportAsPdf(appState);
    } catch (error) {
      console.error("PDF Export failed:", error);
      alert("An error occurred while generating the PDF. See the console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  const activeSlot = activeSlotId !== null ? slots.find((s) => s.id === activeSlotId) : null;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center p-4">
      {isExporting && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-xl text-center">
            <p className="font-semibold text-lg">Generating PDF Report...</p>
            <p className="text-sm text-gray-600">This may take a moment.</p>
          </div>
        </div>
      )}
      <div className="w-full max-w-7xl">
        {infoBanner && (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {infoBanner}
          </div>
        )}

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
              <button onClick={handleExportPDF} disabled={isExporting} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                {isExporting ? 'Exporting...' : 'Export as PDF'}
              </button>
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
