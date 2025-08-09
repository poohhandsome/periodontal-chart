// src/components/VoiceControlledPeriodontalChartApp.jsx

import React, { useState, useCallback, useEffect, useMemo } from 'react';

import { exportChartAsPdf } from '../utils/pdf-exporter'; // Import the new exporter
import ToothChart from './ToothChart';

import ChartSummary from './ChartSummary';
import PatientInfo from './PatientInfo';
import Dropdown from './Dropdown';
import ConfirmationModal from './ConfirmationModal';
import VoiceHUD from './VoiceHUD';
import HistoryPanel from './HistoryPanel';
import SequenceCustomizer from './SequenceCustomizer';
import { useSpeechEngine } from '../hooks/useSpeechEngine';
import { useChartStateMachine } from '../hooks/useChartStateMachine';
import { thaiNormalize, thaiNumberParser } from '../utils/thai-language-utils';
import { perioInterpreter } from '../utils/perio-interpreter';
import { INITIAL_CHART_DATA, createVoiceChartingOrder, MGJ_CHARTING_QUADRANTS } from '../chart.config.js';

// --- Configuration ---
const DEFAULT_SEQUENCE = [
    { id: 'Q1B', label: 'Q1 Buccal', direction: 'LR' }, { id: 'Q2B', label: 'Q2 Buccal', direction: 'LR' },
    { id: 'Q2L', label: 'Q2 Lingual', direction: 'RL' }, { id: 'Q1L', label: 'Q1 Lingual', direction: 'RL' },
    { id: 'Q3L', label: 'Q3 Lingual', direction: 'RL' }, { id: 'Q4L', label: 'Q4 Lingual', direction: 'LR' },
    { id: 'Q4B', label: 'Q4 Buccal', direction: 'LR' }, { id: 'Q3B', label: 'Q3 Buccal', direction: 'RL' },
];
const CONFIRM_KEYWORDS = ['ok', 'okay', 'ตกลง', 'โอเค', 'ยืนยัน', 'ต่อไป'];
const CANCEL_KEYWORDS = ['cancel', 'ยกเลิก'];
const STOP_KEYWORDS = ['จบ', 'หยุด'];

const getInitialState = () => {
    const savedState = localStorage.getItem('voicePeriodontalChartCurrentState');
    if (savedState) {
        try { return JSON.parse(savedState); }
        catch (e) { console.error("Failed to parse saved voice chart state:", e); }
    }
    return { chartData: INITIAL_CHART_DATA, missingTeeth: [], patientHN: '', patientName: '' };
};

// --- Component ---
export default function VoiceControlledPeriodontalChartApp() {
  const [initialState] = useState(getInitialState);
  const [chartData, setChartData] = useState(initialState.chartData);
  const [missingTeeth, setMissingTeeth] = useState(initialState.missingTeeth);
  const [patientHN, setPatientHN] = useState(initialState.patientHN);
  const [patientName, setPatientName] = useState(initialState.patientName);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isClearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [history, setHistory] = useState([]);
  const [chartingMode, setChartingMode] = useState(null);
  const [isHudVisible, setIsHudVisible] = useState(false);
  const [mgjValues, setMgjValues] = useState([]);
  const [mgjQuadrantIndex, setMgjQuadrantIndex] = useState(0);
  const [customSequence, setCustomSequence] = useState(DEFAULT_SEQUENCE);
  const [showCustomizer, setShowCustomizer] = useState(false);

  useEffect(() => {
    const currentState = { chartData, missingTeeth, patientHN, patientName };
    localStorage.setItem('voicePeriodontalChartCurrentState', JSON.stringify(currentState));
  }, [chartData, missingTeeth, patientHN, patientName]);

  useEffect(() => {
    const savedHistory = localStorage.getItem('periodontalChartHistory');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedSequence = localStorage.getItem('periodontalChartSequence');
    if (savedSequence) setCustomSequence(JSON.parse(savedSequence));
  }, []);

  const stateMachineConfig = {
    missingTeeth,
    customChartingOrderFunction: createVoiceChartingOrder, 
    customSequence: customSequence,
  };
  const { activeInfo, dispatch } = useChartStateMachine(stateMachineConfig);

  const currentMgjQuadrantTeeth = useMemo(() => 
    MGJ_CHARTING_QUADRANTS[mgjQuadrantIndex]?.filter(toothId => !missingTeeth.includes(toothId)) || [],
    [missingTeeth, mgjQuadrantIndex]
  );

  const applyPdReData = useCallback((dataToApply) => {
    if (!dataToApply || !dataToApply.activeInfo) return;
    const { toothId, sites } = dataToApply.activeInfo;
    setChartData(prev => {
      const newData = JSON.parse(JSON.stringify(prev));
      const targetTooth = newData[toothId];
      if (!targetTooth) return prev;
      sites.forEach((site, index) => {
        if (dataToApply.pd[index] !== undefined) targetTooth.pd[site] = dataToApply.pd[index];
        if (dataToApply.rec[index] !== undefined) targetTooth.re[site] = dataToApply.rec[index];
      });
      return newData;
    });
    dispatch({ type: 'APPLY_DATA' });
  }, [dispatch]);

  const applyMgjData = useCallback(() => {
    setChartData(prev => {
        const newData = JSON.parse(JSON.stringify(prev));
        currentMgjQuadrantTeeth.forEach((toothId, index) => {
            if (newData[toothId] && mgjValues[index] !== undefined) {
                newData[toothId].mgj.b = mgjValues[index];
            }
        });
        return newData;
    });
  }, [currentMgjQuadrantTeeth, mgjValues]);

  const handleConfirmPreview = useCallback(() => {
    if (!previewData) return;
    if (chartingMode === 'MGJ') {
      applyMgjData();
      if (mgjQuadrantIndex < 3) {
        setMgjQuadrantIndex(prev => prev + 1);
        setMgjValues([]);
        setTranscript('');
      } else {
        alert("MGJ recording complete!");
        setChartingMode(null);
        setIsHudVisible(false);
        setMgjQuadrantIndex(0);
        setMgjValues([]);
        stopSpeech();
      }
    } else {
      applyPdReData(previewData);
    }
    setPreviewData(null);
  }, [previewData, applyPdReData, applyMgjData, chartingMode, mgjQuadrantIndex]);

  const handleCancelPreview = useCallback(() => {
    setPreviewData(null);
    if (chartingMode === 'MGJ') setMgjValues([]);
  }, [chartingMode]);

  function handleFinalSpeech(finalTranscript) {
    handleSpeechResult(finalTranscript);
  }

  const { isListening, transcript, error, start: startSpeech, stop: stopSpeech, setTranscript } = useSpeechEngine({
    onFinal: handleFinalSpeech,
    continuousSession: chartingMode === 'MGJ',
  });

  const handleSpeechResult = useCallback((text) => {
    if (!text) return;
    const command = text.toLowerCase().trim();
    if (STOP_KEYWORDS.includes(command)) { stopSpeech(); return; }
    if (previewData) {
      if (CONFIRM_KEYWORDS.includes(command)) { handleConfirmPreview(); return; }
      if (CANCEL_KEYWORDS.includes(command)) { handleCancelPreview(); return; }
    }

    if (chartingMode === 'MGJ') {
        const numbers = thaiNumberParser(thaiNormalize(text));
        const newMgjValues = [...mgjValues, ...numbers];
        setMgjValues(newMgjValues);
        if (newMgjValues.length >= currentMgjQuadrantTeeth.length) {
            setPreviewData({ isMgjPreview: true, values: newMgjValues.slice(0, currentMgjQuadrantTeeth.length) });
        }
    } else {
        const interpretation = perioInterpreter(thaiNumberParser(thaiNormalize(text)));
        if (interpretation.isValid && interpretation.consumed > 0) {
            setPreviewData({ ...interpretation, activeInfo });
        } else {
            console.warn("Could not interpret speech:", text);
        }
    }
  }, [previewData, activeInfo, handleConfirmPreview, handleCancelPreview, stopSpeech, chartingMode, mgjValues, currentMgjQuadrantTeeth]);
  
  const handleToothSelect = (toothId, surface) => {
    if (chartingMode === 'MGJ') {
        alert("Cannot select tooth in MGJ mode. Switch to PD & RE mode to select individual teeth.");
        return;
    }
    if (isEditMode) {
      setMissingTeeth(prev => prev.includes(toothId) ? prev.filter(t => t !== toothId) : [...prev, toothId]);
      return;
    }
    setIsHudVisible(true);
    dispatch({ type: 'SET_POSITION', payload: { toothId, surface } });
  };

  const handleToggleMic = () => {
    if (isListening) {
      stopSpeech();
      if (chartingMode === 'MGJ' && mgjValues.length > 0 && mgjValues.length < currentMgjQuadrantTeeth.length) {
        setPreviewData({ isMgjPreview: true, values: mgjValues });
      }
    } else {
      if (chartingMode === 'MGJ' && previewData) {
        handleCancelPreview();
      }
      setTranscript('');
      startSpeech();
    }
  };

  const handleModeChange = (mode) => {
    if (isListening) stopSpeech();
    setChartingMode(mode);
    setIsHudVisible(true);
    setMgjValues([]);
    setMgjQuadrantIndex(0);
    setPreviewData(null);
    setTranscript('');
  };

  const handleCloseHud = () => {
    if (isListening) stopSpeech();
    setIsHudVisible(false);
    setChartingMode(null);
  };
  
  const handleClearChart = () => {
    setChartData(INITIAL_CHART_DATA);
    setMissingTeeth([]);
    setPatientHN('');
    setPatientName('');
    setClearConfirmOpen(false);
    dispatch({ type: 'RESET' });
  };

  const handleSaveChart = () => {
    const newHistoryEntry = { id: Date.now(), date: new Date().toISOString(), chartData, missingTeeth, patientHN, patientName };
    const updatedHistory = [newHistoryEntry, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('periodontalChartHistory', JSON.stringify(updatedHistory));
    alert('Chart draft saved successfully!');
  };

  const handleLoadChart = (id) => {
    const chartToLoad = history.find(item => item.id === id);
    if (chartToLoad) {
      setChartData(chartToLoad.chartData);
      setMissingTeeth(chartToLoad.missingTeeth);
      setPatientHN(chartToLoad.patientHN || '');
      setPatientName(chartToLoad.patientName || '');
      dispatch({ type: 'RESET' });
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
            dispatch({ type: 'RESET' });
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
  
  const handleSequenceChange = (newSequence) => {
      setCustomSequence(newSequence);
      localStorage.setItem('periodontalChartSequence', JSON.stringify(newSequence));
  };

  const handleExportPdf = async () => {
    const patientInfo = document.getElementById('patient-info-pdf');
    const toothChart = document.getElementById('tooth-chart-pdf');
    const chartSummary = document.getElementById('chart-summary-pdf');

    if (!patientInfo || !toothChart || !chartSummary) {
        alert("Could not find all elements to export.");
        return;
    }

    const pdf = new jsPDF('p', 'mm', 'a4', true);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    
    // 1. Add Patient Info
    const patientCanvas = await html2canvas(patientInfo);
    const patientImgData = patientCanvas.toDataURL('image/png');
    const patientImgProps = pdf.getImageProperties(patientImgData);
    const patientPdfWidth = pdfWidth - 20; // with margin
    const patientPdfHeight = (patientImgProps.height * patientPdfWidth) / patientImgProps.width;
    pdf.text("Periodontal Chart Report", 10, 15);
    pdf.addImage(patientImgData, 'PNG', 10, 20, patientPdfWidth, patientPdfHeight);

    // 2. Add Tooth Chart
    const chartCanvas = await html2canvas(toothChart);
    const chartImgData = chartCanvas.toDataURL('image/png');
    const chartImgProps = pdf.getImageProperties(chartImgData);
    const chartPdfWidth = pdfWidth - 20;
    const chartPdfHeight = (chartImgProps.height * chartPdfWidth) / chartImgProps.width;
    pdf.addPage();
    pdf.addImage(chartImgData, 'PNG', 10, 10, chartPdfWidth, chartPdfHeight);

    // 3. Add Chart Summary
    const summaryCanvas = await html2canvas(chartSummary);
    const summaryImgData = summaryCanvas.toDataURL('image/png');
    const summaryImgProps = pdf.getImageProperties(summaryImgData);
    const summaryPdfWidth = pdfWidth - 20;
    const summaryPdfHeight = (summaryImgProps.height * summaryPdfWidth) / summaryImgProps.width;
    pdf.addPage();
    pdf.addImage(summaryImgData, 'PNG', 10, 10, summaryPdfWidth, summaryPdfHeight);

    const fileName = `${patientHN || 'NoHN'}-${patientName || 'NoName'}-Report.pdf`;
    pdf.save(fileName);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 p-4 font-sans">
      <div className="w-full mx-auto px-2 sm:px-4 md:px-6 pb-64">
        <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <a href="#" className="text-blue-600 hover:text-blue-800 font-semibold">&larr; Back to Home</a>
              <h1 className="text-3xl font-bold text-blue-700">Voice Periodontal Chart <span className="text-base align-top bg-blue-100 text-blue-600 p-1 rounded">Beta</span></h1>
            </div>
            <div className="space-x-2 flex items-center">
                <Dropdown label="Save">
                  <button onClick={handleSaveChart} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Save Draft</button>
                  <button onClick={handleDownload} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Download JSON</button>
                  <button onClick={() => exportChartAsPdf(patientHN, patientName)} className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Export PDF</button>
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
        
        <div className="mb-4 bg-white p-4 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Charting Mode</h3>
            <p className="text-sm text-gray-500 mb-3">Select a mode to begin voice charting.</p>
            <div className="flex gap-4">
                <button onClick={() => handleModeChange('PD_RE')} disabled={isListening} className={`px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 ${chartingMode === 'PD_RE' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    PD & RE (Per Tooth)
                </button>
                <button onClick={() => handleModeChange('MGJ')} disabled={isListening} className={`px-4 py-2 rounded-lg font-semibold transition-colors disabled:opacity-50 ${chartingMode === 'MGJ' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                    MGJ (Per Quadrant)
                </button>
            </div>
        </div>

        <div id="tooth-chart-pdf">
          <ToothChart
              data={chartData}
              onSiteClick={handleToothSelect}
              activeSite={chartingMode === 'PD_RE' ? activeInfo : null}
              missingTeeth={missingTeeth}
              isEditMode={isEditMode}
           />
        </div>

        <div id="chart-summary-pdf">
          <ChartSummary chartData={chartData} missingTeeth={missingTeeth} />
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

      {isHudVisible && (
        <VoiceHUD
            isListening={isListening}
            transcript={chartingMode === 'MGJ' ? mgjValues.join(' ') : transcript}
            error={error}
            activeInfo={activeInfo}
            onToggleMic={handleToggleMic}
            previewData={previewData}
            onConfirm={handleConfirmPreview}
            onCancel={handleCancelPreview}
            onClose={handleCloseHud}
            chartingMode={chartingMode}
            mgjData={{ 
                quadrant: mgjQuadrantIndex + 1,
                collected: mgjValues.length, 
                total: currentMgjQuadrantTeeth.length 
            }}
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
    </div>
  );
}