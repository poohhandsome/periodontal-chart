// src/components/PeriodontalChartApp.jsx

import React, { useState, useMemo, useEffect, useRef } from 'react';
import ExportPDFModal from './ExportPDFModal';
import generatePerioPDF from '../utils/perio-pdf-exporter';
import { exportChartAsPdf } from '../utils/pdf-exporter';
import ToothChart from './ToothChart';
import Numpad from './Numpad';
import ChartSummary from './ChartSummary';
import HistoryPanel from './HistoryPanel';
import PatientInfo from './PatientInfo';
import ChartingModeSelector from './ChartingModeSelector';
import SequenceCustomizer from './SequenceCustomizer';
import Dropdown from './Dropdown';
import ConfirmationModal from './ConfirmationModal';
import EditDataModal from './EditDataModal';
import { createChartingOrder, INITIAL_CHART_DATA } from '../chart.config';
import DxPxModal from './DxPxModal';
import AccountModal from '../auth/AccountModal'; // <-- ADD THIS

import { auth } from '../services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import CloudSyncPanel from './CloudSyncPanel';
import { logOut } from '../auth/auth';
import { listPerioCharts, savePerioChart, getPerioPatient } from '../services/firestore';
import { createShare, redeemShare, revokeShare } from '../services/shares';


const DEFAULT_SEQUENCE = [
    { id: 'Q1B', label: 'Q1 Buccal', direction: 'LR' },
    { id: 'Q2B', label: 'Q2 Buccal', direction: 'LR' },
    { id: 'Q2L', label: 'Q2 Lingual', direction: 'RL' },
    { id: 'Q1L', label: 'Q1 Lingual', direction: 'RL' },
    { id: 'Q3L', label: 'Q3 Lingual', direction: 'RL' },
    { id: 'Q4L', label: 'Q4 Lingual', direction: 'LR' },
    { id: 'Q4B', label: 'Q4 Buccal', direction: 'LR' },
    { id: 'Q3B', label: 'Q3 Buccal', direction: 'RL' },
];

const getInitialState = () => {
    const savedState = localStorage.getItem('periodontalChartCurrentState');
    if (savedState) {
        try {
            return JSON.parse(savedState);
        } catch (e) {
            console.error("Failed to parse saved state:", e);
        }
    }
    return {
        chartData: INITIAL_CHART_DATA,
        missingTeeth: [],
        patientHN: '',
        patientName: '',
    };
};


export default function PeriodontalChartApp({ user }) {
  const [isCloudOpen, setCloudOpen] = useState(false);
  const [authUser, setAuthUser] = useState(user ?? null);
  useEffect(() => setAuthUser(user ?? null), [user]);
  useEffect(() => {const unsub = onAuthStateChanged(auth, setAuthUser);return () => unsub();}, []);
  const effectiveUser = authUser || user;
  const [initialState] = useState(getInitialState);
  const [chartData, setChartData] = useState(initialState.chartData);
  const [missingTeeth, setMissingTeeth] = useState(initialState.missingTeeth);
  const [isEditMode, setIsEditMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [patientHN, setPatientHN] = useState(initialState.patientHN);
  const [patientName, setPatientName] = useState(initialState.patientName);
  const [inspectingTooth, setInspectingTooth] = useState(null);
  const [clinicalNotes, setClinicalNotes] = useState(initialState.clinicalNotes || '');
  const [isAccountModalOpen, setAccountModalOpen] = useState(false);
  const [chartingModes, setChartingModes] = useState({
    pd: true,
    re: true,
    bop: true,
    mgj: true,
    // optional new flags (safe even if your ChartingModeSelector doesn’t show them yet)
    dxpx: false,
    mo:   false,
    f:    false,
  });
  const [customSequence, setCustomSequence] = useState(DEFAULT_SEQUENCE);
  const [showCustomizer, setShowCustomizer] = useState(false);
  const [isClearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [editingTooth, setEditingTooth] = useState(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [isUserMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);
  const handleLogout = async () => {
  try {
    await logOut();
    setUserMenuOpen(false);
    setCloudOpen(false);
  } catch (e) {
    alert('Log out failed: ' + (e?.message || String(e)));
  } finally {
    window.location.reload();
  }
};
useEffect(() => {
  const onDocClick = (e) => {
    if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
      setUserMenuOpen(false);
    }
  };
  if (isUserMenuOpen) document.addEventListener('mousedown', onDocClick);
  return () => document.removeEventListener('mousedown', onDocClick);
}, [isUserMenuOpen]);


  const handleOpenDxPxModal = (toothId) => {
    setInspectingTooth({
      toothId: toothId,
      data: chartData[toothId]
    });
  };
  const handleSaveDxPx = (toothId, dxpxCode, fullPrognosis) => {
    setChartData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (!newData[toothId]) {
          newData[toothId] = {};
      }
      newData[toothId].dxpx = dxpxCode;
      newData[toothId].prognosis = fullPrognosis; // Save the full text for the modal
      return newData;
    });
  };
  useEffect(() => {
    const savedSequence = localStorage.getItem('periodontalChartSequence');
    if (savedSequence) {
        setCustomSequence(JSON.parse(savedSequence));
    }

    const savedHistory = localStorage.getItem('periodontalChartHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    const currentState = { chartData, missingTeeth, patientHN, patientName, clinicalNotes };
    localStorage.setItem('periodontalChartCurrentState', JSON.stringify(currentState));
  }, [chartData, missingTeeth, patientHN, patientName, clinicalNotes]);
  useEffect(() => {
  // After a successful share redemption, ShareRedeemPage stashes { ownerUid, hn }
  const raw = localStorage.getItem('pendingLoad');
  if (!raw || !user) return; // wait for auth to be ready
  try {
    const { ownerUid, hn } = JSON.parse(raw);
    getPerioPatient(ownerUid, hn)
      .then(data => {
        if (!data) return;
        setChartData(data.chartData);
        setMissingTeeth(data.missingTeeth || []);
        setPatientHN(data.patientHN || hn);
        setPatientName(data.patientName || '');
        setClinicalNotes(data.clinicalNotes || '');
        alert(`Loaded "${data.patientHN || hn}" from shared link/code.`);
      })
      .finally(() => {
        localStorage.removeItem('pendingLoad');
      });
  } catch {
    localStorage.removeItem('pendingLoad');
  }
}, [user]);

  const handleSequenceChange = (newSequence) => {
      setCustomSequence(newSequence);
      localStorage.setItem('periodontalChartSequence', JSON.stringify(newSequence));
  };

  const CHARTING_ORDER = useMemo(() => createChartingOrder(missingTeeth, chartingModes, customSequence), [missingTeeth, chartingModes, customSequence]);

  const [chartingState, setChartingState] = useState({
    isActive: false,
    orderIndex: 0,
  });

  const activeChartingInfo = useMemo(() => {
    if (!chartingState.isActive || CHARTING_ORDER.length === 0) return null;
    return CHARTING_ORDER[chartingState.orderIndex];
  }, [chartingState, CHARTING_ORDER]);

  const handleModeChange = (event) => {
    const { value, checked } = event.target;
    setChartingModes(prev => ({ ...prev, [value]: checked }));
  };

  const toggleMissingTooth = (toothId) => {
    setMissingTeeth(prev => prev.includes(toothId) ? prev.filter(t => t !== toothId) : [...prev, toothId]);
  };

  const handleToothClick = (toothId, surface, site) => {
    if (isEditMode) {
      toggleMissingTooth(toothId);
      return;
    }

    let orderIndex = CHARTING_ORDER.findIndex(item =>
        item.toothId === toothId && item.surface === surface && item.site === site
    );

    if (orderIndex === -1) {
        orderIndex = CHARTING_ORDER.findIndex(item =>
            item.toothId === toothId && item.surface === surface
        );
    }

    if (orderIndex !== -1) {
      setChartingState({ isActive: true, orderIndex });
    } else if (Object.values(chartingModes).every(m => !m)) {
        alert("Please select at least one charting mode.");
    } else {
        alert("No active charting sequence for this site with current modes.");
    }
  };

  const stopCharting = () => setChartingState({ ...chartingState, isActive: false });
  
  const advanceState = () => {
    if (chartingState.orderIndex >= CHARTING_ORDER.length - 1) {
      stopCharting();
    } else {
      setChartingState(prev => ({ ...prev, orderIndex: prev.orderIndex + 1 }));
    }
  };

  const handleNumpadInput = (value) => {
  // NOTE: activeChartingInfo comes from createChartingOrder(...)
  // and contains the 'type' as well as the tooth/surface/site context.
  const { toothId, site, type, surface } = activeChartingInfo;

  setChartData((prev) => {
    const newData = JSON.parse(JSON.stringify(prev));

    // Helpers: ensure objects exist and pick the correct side key
    const sideKey = surface === 'lingual' ? 'l' : 'b';
    newData[toothId] ??= {};
    newData[toothId].pd ??= {};
    newData[toothId].re ??= {};
    newData[toothId].mgj ??= { b: null, l: null };
    newData[toothId].mo  ??= { b: null, l: null };
    newData[toothId].f   ??= { b: null, l: null };

    if (type === 'pd') {
      newData[toothId].pd[site] = value;                  // 3-site
    } else if (type === 're') {
      newData[toothId].re[site] = value;                  // 3-site
    } else if (type === 'mgj') {
      newData[toothId].mgj[sideKey] = value;              // single per side
    } else if (type === 'dxpx') {
      newData[toothId].dxpx = value;                      // free text / single value
    } else if (type === 'mo') {
      newData[toothId].mo[sideKey] = value;               // single per side (e.g., lingual)
    } else if (type === 'f') {
      newData[toothId].f[sideKey] = value;                // single per side (e.g., lingual)
    }

    return newData;
  });

  advanceState();
};

  const handleBopInput = (bopSites) => {
    const { toothId, sites } = activeChartingInfo;
    setChartData((prev) => {
        const newData = JSON.parse(JSON.stringify(prev));
        sites.forEach(site => {
            newData[toothId].bleeding[site] = false;
        });
        bopSites.forEach(site => {
            newData[toothId].bleeding[site] = true;
        });
        return newData;
    });
    advanceState();
  };

  const handleSaveChart = () => {
    // This function now only saves to localStorage (the "draft")
    const newHistoryEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      chartData: chartData,
      missingTeeth: missingTeeth,
      patientHN: patientHN,
      patientName: patientName,
      clinicalNotes: clinicalNotes,
    };
    const updatedHistory = [newHistoryEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('periodontalChartHistory', JSON.stringify(updatedHistory));
    alert('Chart draft saved locally!');
};
const handleSyncToCloud = async () => {
    if (!effectiveUser) {
        alert("Please log in first.");
        return;
    }
    if (!patientHN) {
        alert("Please enter a Patient HN before saving to the cloud.");
        return;
    }
    try {
        console.time('savePerioChart');
        console.log('[CLOUD] saving', { uid: effectiveUser.uid, patientHN });
        await savePerioChart(effectiveUser.uid, patientHN, chartData, missingTeeth, clinicalNotes);
        console.timeEnd('savePerioChart');
        alert(`Patient ${patientHN}'s chart saved to the cloud successfully!`);
        setAccountModalOpen(false);
    } catch (error) {
      console.error('[CLOUD] save error', err);
        alert("Error saving to cloud: " + error.message);
    }
};

// NEW function to handle loading from the cloud
const handleLoadFromCloud = async () => {
    if (!effectiveUser) {
        alert("Please log in first.");
        return;
    }
    const hnToLoad = prompt("Enter the Patient HN to load from the cloud:");
    if (!hnToLoad) return;

    try {
      console.time('getPerioPatient');
      console.log('[CLOUD] loading', { uid: effectiveUser.uid, hnToLoad });
      
        const cloudData = await getPerioPatient(effectiveUser.uid, hnToLoad);
        console.timeEnd('getPerioPatient');
        if (cloudData) {
            setChartData(cloudData.chartData);
            setMissingTeeth(cloudData.missingTeeth);
            setPatientHN(cloudData.patientHN);
            setPatientName(cloudData.patientName || '');
            setClinicalNotes(cloudData.clinicalNotes || '');
            alert(`Chart for ${hnToLoad} loaded successfully from the cloud.`);
            setAccountModalOpen(false);
        } else {
          console.error('[CLOUD] load error', err);
            alert(`No cloud data found for Patient HN: ${hnToLoad}`);
        }
    } catch (error) {
        alert("Error loading from cloud: " + error.message);
    }
};

  const handleLoadChart = (id) => {
    const chartToLoad = history.find(item => item.id === id);
    if (chartToLoad) {
      setChartData(chartToLoad.chartData);
      setMissingTeeth(chartToLoad.missingTeeth);
      setPatientHN(chartToLoad.patientHN || '');
      setPatientName(chartToLoad.patientName || '');
      setClinicalNotes(chartToLoad.clinicalNotes || '');
      alert(`Chart from ${new Date(chartToLoad.date).toLocaleString()} loaded.`);
    }
  };

  const handleDeleteChart = (id) => {
    if (window.confirm('Are you sure you want to delete this saved chart?')) {
      const updatedHistory = history.filter(item => item.id !== id);
      setHistory(updatedHistory);
      localStorage.setItem('periodontalChartHistory', JSON.stringify(updatedHistory));
    }
  };

  const handleDownload = () => {
    const dataToSave = { patientHN, patientName, chartData, missingTeeth };
    const blob = new Blob([JSON.stringify(dataToSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileName = `${patientHN || 'NoHN'}-${patientName || 'NoName'}-PeriodontalChart.json`;
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loadedData = JSON.parse(e.target.result);
          if (loadedData.chartData && loadedData.missingTeeth) {
            setChartData(loadedData.chartData);
            setMissingTeeth(loadedData.missingTeeth);
            setPatientHN(loadedData.patientHN || '');
            setPatientName(loadedData.patientName || '');
            alert('Chart data loaded successfully!');
          } else {
            alert('Invalid chart file format.');
          }
        } catch (error) {
          alert('Error reading or parsing the file.');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleClearChart = () => {
    setChartData(INITIAL_CHART_DATA);
    setMissingTeeth([]);
    setPatientHN('');
    setPatientName('');
    setClinicalNotes('');
    setClearConfirmOpen(false);
  };

  const handleOpenEditModal = (toothId, surface) => {
    setEditingTooth({
        id: toothId,
        surface: surface,
        data: chartData[toothId]
    });
  };

  const handleCloseEditModal = () => {
    setEditingTooth(null);
  };

  const handleSaveChanges = (toothId, updatedToothData) => {
    setChartData(prev => ({
        ...prev,
        [toothId]: updatedToothData
    }));
    setEditingTooth(null);
  };
  const handleExportPDF = (exportOptions) => {
    if (!exportOptions) {
      setIsExportModalOpen(true);
      return;
    }

    const summaryData = {
        bopCount: document.querySelectorAll('#chart-summary-pdf .text-red-500').length, 
    };
    const chartArray = Object.entries(chartData).map(([id, data]) => ({ id: String(id), ...data, }));
    
    generatePerioPDF(
      { patientHN, patientName, clinicalNotes }, // Pass notes here
      chartArray,
      missingTeeth,
      summaryData.bopCount,
      exportOptions
    );
    setIsExportModalOpen(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4 font-sans">
      <div className="w-full mx-auto px-2 sm:px-4 md:px-6 pb-64">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <a href="#" className="text-blue-600 hover:text-blue-800 font-semibold">&larr; Back to Home</a>
              <h1 className="text-3xl font-bold text-blue-700">Periodontal Chart</h1>
            </div>
            <div className="space-x-2 flex items-center">
             {effectiveUser && (
    <div ref={userMenuRef} className="relative">
      <button
        type="button"
        onClick={() => setUserMenuOpen((v) => !v)}
        className="max-w-[220px] truncate px-3 py-2 rounded-lg border bg-white text-gray-700 hover:bg-gray-50"
        aria-haspopup="menu"
        aria-expanded={isUserMenuOpen ? 'true' : 'false'}
        title={effectiveUser.email}
      >
        {effectiveUser.email}
      </button>

      {isUserMenuOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-44 rounded-lg border bg-white shadow-lg overflow-hidden"
        >
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-50"
            role="menuitem"
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )}
              <button
    onClick={() => (effectiveUser ? setCloudOpen(true) : setAccountModalOpen(true))}
    className="px-4 py-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors h-10"
  >
    {effectiveUser ? 'EasySync' : 'Login for EasySync'}
  </button>
                {isEditMode && (
                    <button 
                        onClick={() => setIsEditMode(false)}
                        className="px-4 py-2 rounded-lg font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors h-10"
                    >
                        Finish Editing
                    </button>
                )}
                <Dropdown label="Save">
                  <button onClick={handleSaveChart} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Save Local</button>
                  <button onClick={handleDownload} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download JSON</button>
                  <button onClick={() => handleExportPDF(null)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Export PDF</button>
                     <label className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                    Upload JSON
                    <input type="file" accept=".json" className="hidden" onChange={handleUpload} />
                  </label>
                </Dropdown>

                <Dropdown label="Settings">
                  <button onClick={() => setShowCustomizer(true)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Customize Flow</button>
                  <button onClick={() => setIsEditMode(!isEditMode)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{isEditMode ? 'Finish Editing' : 'Remove Teeth'}</button>
                   <div className="my-1 border-t border-gray-200"></div>
                  <button onClick={() => setClearConfirmOpen(true)} className="w-full text-left block px-4 py-2 text-sm text-red-600 hover:bg-red-50">Clear Chart</button>
                </Dropdown>
            </div>
        </div>

        <div id="patient-info-pdf">
          <PatientInfo patientHN={patientHN} setPatientHN={setPatientHN} patientName={patientName} setPatientName={setPatientName} />
        </div>

        <ChartingModeSelector modes={chartingModes} onModeChange={handleModeChange} />

        <div id="tooth-chart-pdf">
          <ToothChart 
            data={chartData} 
            onSiteClick={handleToothClick} 
            activeSite={activeChartingInfo} 
            missingTeeth={missingTeeth} 
            isEditMode={isEditMode} 
            onDataCellClick={handleOpenEditModal}
            onDxPxClick={handleOpenDxPxModal}
          />
        </div>
        
        <div id="chart-summary-pdf">
          <ChartSummary chartData={chartData} missingTeeth={missingTeeth} />
        </div>
        {/* NEW: Add this Clinical Notes section right below it */}
        <div className="mt-6">
            <h2 className="text-xl font-bold text-gray-700 mb-2">Clinical Notes & Impressions</h2>
            <textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Enter any clinical notes, treatment plans, or diagnostic impressions here..."
                className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
        </div>
        <HistoryPanel history={history} onLoad={handleLoadChart} onDelete={handleDeleteChart} />
      </div>

      {showCustomizer && (
          <SequenceCustomizer
            sequence={customSequence}
            onSequenceChange={handleSequenceChange}
            onClose={() => setShowCustomizer(false)}
          />
      )}

      {chartingState.isActive && activeChartingInfo && (
        <Numpad
          key={chartingState.orderIndex}
          chartingInfo={activeChartingInfo}
          onInput={handleNumpadInput}
          onBopSelect={handleBopInput}
          onClose={stopCharting}
        />
      )}

      {editingTooth && (
        <EditDataModal 
            toothId={editingTooth.id}
            surface={editingTooth.surface}
            initialData={editingTooth.data}
            onSave={handleSaveChanges}
            onClose={handleCloseEditModal}
        />
      )}

      <ConfirmationModal
        isOpen={isClearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        onConfirm={handleClearChart}
        title="Clear Chart Data"
      >
        <p>Are you sure you want to clear all patient information and charting data? This action cannot be undone.</p>
      </ConfirmationModal>
      <ExportPDFModal
    isOpen={isExportModalOpen}
    onClose={() => setIsExportModalOpen(false)}
    onExport={handleExportPDF}
    patientInfo={{ patientName, patientHN }}
/>
{inspectingTooth && (
    <DxPxModal 
      tooth={inspectingTooth}
      onClose={() => setInspectingTooth(null)}
      onSave={handleSaveDxPx}
    />
  )}
  {isAccountModalOpen && (
        <AccountModal
            user={effectiveUser}
            onClose={() => setAccountModalOpen(false)}
            onSync={handleSyncToCloud}
            onLoad={handleLoadFromCloud}
        />
        
    )}
    <CloudSyncPanel
  open={isCloudOpen}
  user={effectiveUser}
  onClose={() => setCloudOpen(false)}
  draft={{ patientHN, patientName, chartData, missingTeeth, clinicalNotes }}
  onLoadIntoChart={(cloudData) => {
    setChartData(cloudData.chartData);
    setMissingTeeth(cloudData.missingTeeth || []);
    setPatientHN(cloudData.patientHN || '');
    setPatientName(cloudData.patientName || '');
    setClinicalNotes(cloudData.clinicalNotes || '');
    alert(`Loaded "${cloudData.patientHN}" from cloud.`);
  }}
/>
    </div>
  );
}