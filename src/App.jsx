// src/App.jsx

import React, { useState, useMemo, useEffect } from 'react';
import ToothChart from './components/ToothChart';
import Numpad from './components/Numpad';
import ChartSummary from './components/ChartSummary';
import HistoryPanel from './components/HistoryPanel'; // <-- Import new component
import { createChartingOrder, INITIAL_CHART_DATA } from './chart.config';

export default function App() {
  const [chartData, setChartData] = useState(INITIAL_CHART_DATA);
  const [missingTeeth, setMissingTeeth] = useState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  const [history, setHistory] = useState([]); // <-- New state for history

  // Load history from localStorage when the app starts
  useEffect(() => {
    const savedHistory = localStorage.getItem('periodontalChartHistory');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  const CHARTING_ORDER = useMemo(() => createChartingOrder(missingTeeth), [missingTeeth]);
  const [chartingState, setChartingState] = useState({
    isActive: false, orderIndex: 0, siteIndex: 0, mode: 'pd',
  });
  const activeChartingInfo = useMemo(() => {
    if (!chartingState.isActive || CHARTING_ORDER.length === 0) return null;
    const { orderIndex } = chartingState;
    if (orderIndex >= CHARTING_ORDER.length) return null;
    const surfaceInfo = CHARTING_ORDER[orderIndex];
    const site = surfaceInfo.sites[chartingState.siteIndex];
    return { ...surfaceInfo, site };
  }, [chartingState, CHARTING_ORDER]);
  
  // ... (handleToothClick, toggleMissingTooth, and other handlers are the same)
  const toggleMissingTooth = (toothId) => {
    setMissingTeeth(prev => prev.includes(toothId) ? prev.filter(t => t !== toothId) : [...prev, toothId]);
  };
  const handleToothClick = (toothId, surface, site) => {
    if (isEditMode) toggleMissingTooth(toothId);
    else {
      const orderIndex = CHARTING_ORDER.findIndex(item => item.toothId === toothId && item.surface === surface);
      if (orderIndex !== -1) {
        const siteIndex = CHARTING_ORDER[orderIndex].sites.indexOf(site);
        setChartingState({ isActive: true, orderIndex, siteIndex, mode: 'pd' });
      }
    }
  };
  const stopCharting = () => setChartingState({ ...chartingState, isActive: false });
  const advanceState = () => {
    let { orderIndex, siteIndex, mode } = { ...chartingState };
    if (!CHARTING_ORDER[orderIndex]) { stopCharting(); return; }
    const surfaceInfo = CHARTING_ORDER[orderIndex];
    if (mode === 'pd') mode = 're';
    else if (mode === 're') {
      if (siteIndex < surfaceInfo.sites.length - 1) { siteIndex++; mode = 'pd'; } else { mode = 'bop'; }
    } else if (mode === 'bop') {
      if (surfaceInfo.surface === 'buccal') mode = 'mgj';
      else { orderIndex++; siteIndex = 0; mode = 'pd'; }
    } else if (mode === 'mgj') { orderIndex++; siteIndex = 0; mode = 'pd'; }
    if (orderIndex >= CHARTING_ORDER.length) { stopCharting(); } else {
      setChartingState({ isActive: true, orderIndex, siteIndex, mode });
    }
  };
  const handleNumpadInput = (value) => {
    const { toothId, site } = activeChartingInfo;
    setChartData((prev) => {
      const newData = JSON.parse(JSON.stringify(prev));
      if (chartingState.mode === 'pd') newData[toothId].pd[site] = value;
      else if (chartingState.mode === 're') newData[toothId].re[site] = value;
      else if (chartingState.mode === 'mgj') newData[toothId].mgj.b = value;
      return newData;
    });
    advanceState();
  };
  const handleBopInput = (bopSites) => {
    const { toothId, sites } = activeChartingInfo;
    setChartData((prev) => {
        const newData = JSON.parse(JSON.stringify(prev));
        sites.forEach(site => newData[toothId].bleeding[site] = false);
        bopSites.forEach(site => newData[toothId].bleeding[site] = true);
        return newData;
    });
    advanceState();
  };

  // --- New functions for managing history ---

  const handleSaveChart = () => {
    const newHistoryEntry = {
      id: Date.now(),
      date: new Date().toISOString(),
      chartData: chartData,
      missingTeeth: missingTeeth,
    };

    const updatedHistory = [newHistoryEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('periodontalChartHistory', JSON.stringify(updatedHistory));
    alert('Chart saved successfully!');
  };

  const handleLoadChart = (id) => {
    const chartToLoad = history.find(item => item.id === id);
    if (chartToLoad) {
      setChartData(chartToLoad.chartData);
      setMissingTeeth(chartToLoad.missingTeeth);
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

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4 font-sans">
      <div className="w-full mx-auto px-2 sm:px-4 md:px-6 pb-64">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold text-blue-700">Periodontal Chart</h1>
            <div className="space-x-2">
                <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`px-4 py-2 rounded-lg font-semibold text-white transition-colors ${
                        isEditMode ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-500 hover:bg-gray-600'
                    }`}
                >
                    {isEditMode ? 'Finish Editing' : 'Remove Teeth'}
                </button>
                 <button
                    onClick={handleSaveChart}
                    className="px-4 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                    Save Chart
                </button>
            </div>
        </div>

        <ToothChart 
            data={chartData} 
            onSiteClick={handleToothClick}
            activeSite={activeChartingInfo}
            missingTeeth={missingTeeth}
            isEditMode={isEditMode}
        />
        
        <ChartSummary chartData={chartData} missingTeeth={missingTeeth} />

        {/* --- New History Panel --- */}
        <HistoryPanel history={history} onLoad={handleLoadChart} onDelete={handleDeleteChart} />
      </div>

      {chartingState.isActive && activeChartingInfo && (
        <Numpad
          key={`${chartingState.orderIndex}-${chartingState.siteIndex}-${chartingState.mode}`}
          chartingInfo={activeChartingInfo}
          mode={chartingState.mode}
          onInput={handleNumpadInput}
          onBopSelect={handleBopInput}
          onClose={stopCharting}
        />
      )}
    </div>
  );
}