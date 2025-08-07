// src/components/PeriodontalChartApp.jsx

import React, { useState, useMemo, useEffect } from 'react';
import ToothChart from './ToothChart';
import Numpad from './Numpad';
import ChartSummary from './ChartSummary';
import HistoryPanel from './HistoryPanel';
import PatientInfo from './PatientInfo';
import ChartingModeSelector from './ChartingModeSelector';
import SequenceCustomizer from './SequenceCustomizer';
import Dropdown from './Dropdown'; // Import the new Dropdown component
import { createChartingOrder, INITIAL_CHART_DATA } from '../chart.config';

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

export default function PeriodontalChartApp() {
  const [chartData, setChartData] = useState(INITIAL_CHART_DATA);
  const [missingTeeth, setMissingTeeth] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [history, setHistory] = useState([]);
  const [patientHN, setPatientHN] = useState('');
  const [patientName, setPatientName] = useState('');
  const [chartingModes, setChartingModes] = useState({
    pd: true,
    re: true,
    bop: true,
    mgj: true,
  });
  const [customSequence, setCustomSequence] = useState(DEFAULT_SEQUENCE);
  const [showCustomizer, setShowCustomizer] = useState(false);

  useEffect(() => {
    // Load saved sequence from localStorage
    const savedSequence = localStorage.getItem('periodontalChartSequence');
    if (savedSequence) {
        setCustomSequence(JSON.parse(savedSequence));
    }

    const savedHistory = localStorage.getItem('periodontalChartHistory');
    if (savedHistory) {
      const parsedHistory = JSON.parse(savedHistory);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const stillValidHistory = parsedHistory.filter(item => new Date(item.date) > sevenDaysAgo);
      setHistory(stillValidHistory);
      if (stillValidHistory.length < parsedHistory.length) {
        localStorage.setItem('periodontalChartHistory', JSON.stringify(stillValidHistory));
        alert(`${parsedHistory.length - stillValidHistory.length} expired chart(s) have been removed.`);
      }
    }
  }, []);

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
    const { toothId, site, type } = activeChartingInfo;
    setChartData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (type === 'pd') newData[toothId].pd[site] = value;
      else if (type === 're') newData[toothId].re[site] = value;
      else if (type === 'mgj') newData[toothId].mgj.b = value;
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
    const newHistoryEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      chartData: chartData,
      missingTeeth: missingTeeth,
      patientHN: patientHN,
      patientName: patientName,
    };
    const updatedHistory = [newHistoryEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('periodontalChartHistory', JSON.stringify(updatedHistory));
    alert('Chart draft saved to history successfully!');
  };

  const handleLoadChart = (id) => {
    const chartToLoad = history.find(item => item.id === id);
    if (chartToLoad) {
      setChartData(chartToLoad.chartData);
      setMissingTeeth(chartToLoad.missingTeeth);
      setPatientHN(chartToLoad.patientHN || '');
      setPatientName(chartToLoad.patientName || '');
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

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4 font-sans">
      <div className="w-full mx-auto px-2 sm:px-4 md:px-6 pb-64">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <a href="#" className="text-blue-600 hover:text-blue-800 font-semibold">&larr; Back to Home</a>
              <h1 className="text-3xl font-bold text-blue-700">Periodontal Chart</h1>
            </div>
            <div className="space-x-2 flex items-center">
                <Dropdown label="Save">
                  <a href="#" onClick={handleSaveChart} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Save Draft</a>
                  <a href="#" onClick={handleDownload} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download</a>
                  <label className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer">
                    Upload
                    <input type="file" accept=".json" className="hidden" onChange={handleUpload} />
                  </label>
                </Dropdown>

                <Dropdown label="Settings">
                  <a href="#" onClick={() => setShowCustomizer(true)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Customize Flow</a>
                  <a href="#" onClick={() => setIsEditMode(!isEditMode)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{isEditMode ? 'Finish Editing' : 'Remove Teeth'}</a>
                </Dropdown>
            </div>
        </div>

        <PatientInfo patientHN={patientHN} setPatientHN={setPatientHN} patientName={patientName} setPatientName={setPatientName} />

        <ChartingModeSelector modes={chartingModes} onModeChange={handleModeChange} />

        <ToothChart data={chartData} onSiteClick={handleToothClick} activeSite={activeChartingInfo} missingTeeth={missingTeeth} isEditMode={isEditMode} />

        <ChartSummary chartData={chartData} missingTeeth={missingTeeth} />

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
    </div>
  );
}