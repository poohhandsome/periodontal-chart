// src/components/VoiceHUD.jsx
import React from 'react';

// A small component for the preview data boxes
const DataBox = ({ label, value }) => (
    <div className="flex flex-col items-center">
        <span className="text-[10px] font-semibold text-gray-500 uppercase">{label}</span>
        <div className="w-10 h-8 mt-1 flex items-center justify-center bg-gray-200 text-gray-800 text-lg font-bold rounded">
            {value ?? ''}
        </div>
    </div>
);


const VoiceHUD = ({
  isListening,
  transcript,
  error,
  activeInfo,
  onToggleMic,
  previewData,
  onConfirm,
  onCancel,
  chartingMode,
  mgjData,
  onClose,
}) => {
  const hasPreview = !!previewData;

  let statusText = "Press mic or select a tooth to start.";
  if (chartingMode === 'MGJ') {
    statusText = `Ready for MGJ Q${mgjData.quadrant}. (${mgjData.total} values)`;
    if (isListening) statusText = `Listening for MGJ Q${mgjData.quadrant}... (${mgjData.collected} / ${mgjData.total})`;
  } else { // PD_RE Mode
    if (activeInfo && !isListening) statusText = `Ready to record.`;
    if (isListening) statusText = `Listening...`;
  }
  
  if (hasPreview) statusText = "Please confirm by saying 'OK' or 'Cancel'.";
  if (error) statusText = "Error";
  
  const siteLabels = activeInfo?.sites || [];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-sm border-t border-gray-200 p-6 z-50">
      <div className="max-w-4xl mx-auto relative">
        <button
            onClick={onClose}
            className="absolute -top-2 right-0 text-gray-400 hover:text-gray-700"
            title="Close Voice Panel"
        >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </button>

        {/* --- THIS IS THE FIXED LAYOUT --- */}
        <div className="flex items-center gap-6">
          
          {/* --- LEFT PANEL (Mic, Tooth Info, Data Grid) --- */}
          <div className="flex items-center gap-6 flex-shrink-0">
              {/* Microphone Button */}
              <button
                type="button"
                onClick={onToggleMic}
                className={`flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isListening ? 'bg-red-500 text-white shadow-lg scale-110' : 'bg-blue-500 text-white'
                } ${error ? 'bg-yellow-500' : ''}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              
              {/* Active Tooth Display & Data Grid */}
              {activeInfo && chartingMode === 'PD_RE' && (
                 <div className="flex items-start gap-4">
                    <div className="text-center">
                        <p className="text-xs text-gray-500">Active Tooth</p>
                        <p className="text-5xl font-bold text-blue-700">{activeInfo.toothId}</p>
                        <p className="text-lg font-semibold text-gray-600 uppercase">{activeInfo.surface}</p>
                        <div className="mt-4 flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <span className="w-8 font-bold text-gray-700 text-md">PD</span>
                                <DataBox label={siteLabels[0]} value={previewData?.pd[0]} />
                                <DataBox label={siteLabels[1]} value={previewData?.pd[1]} />
                                <DataBox label={siteLabels[2]} value={previewData?.pd[2]} />
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="w-8 font-bold text-gray-700 text-md">RE</span>
                                <DataBox label={siteLabels[0]} value={previewData?.rec[0]} />
                                <DataBox label={siteLabels[1]} value={previewData?.rec[1]} />
                                <DataBox label={siteLabels[2]} value={previewData?.rec[2]} />
                            </div>
                        </div>
                    </div>
                    <div className="w-24 h-24">
                        <img src={`/teeth/${activeInfo.toothId}.png`} alt={`Tooth ${activeInfo.toothId}`} className="w-full h-full object-contain" />
                    </div>
                </div>
              )}
          </div>
          
          {/* --- RIGHT PANEL (Status, Transcript, Confirmation) --- */}
          <div className="flex-grow">
            <p className={`text-sm font-semibold ${error ? 'text-red-600' : 'text-gray-600'}`}>
              {statusText}
            </p>
            <div className="mt-1 p-2 h-16 bg-gray-100 rounded-md overflow-y-auto text-sm text-gray-800 font-mono">
              {error ? <span className="text-red-600 font-semibold">{error}</span> : (transcript || "...")}
            </div>
            {hasPreview && !error && (
                <div className="flex items-center gap-3 mt-4">
                   <button onClick={onConfirm} className="px-6 py-2 rounded-lg font-bold bg-green-500 text-white hover:bg-green-600">ตกลง (OK)</button>
                   <button onClick={onCancel} className="px-6 py-2 rounded-lg font-bold bg-gray-300 text-gray-800 hover:bg-gray-400">ยกเลิก</button>
                </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default VoiceHUD;