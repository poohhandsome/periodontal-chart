// src/hooks/useChartStateMachine.js
import { useState, useMemo } from 'react';
// Import both functions now
import { createChartingOrder, createVoiceChartingOrder } from '../chart.config';

export const useChartStateMachine = (initialConfig) => {
  // Destructure all possible configuration options
  const { missingTeeth, chartingModes, customSequence, customChartingOrderFunction } = initialConfig;
  
  const [currentIndex, setCurrentIndex] = useState(0);

  // --- THIS IS THE FIX ---
  // The hook now intelligently decides which function to use to build its sequence.
  const chartingOrder = useMemo(() => {
    // If a custom function is passed (from the voice component), use it.
    if (customChartingOrderFunction) {
      return customChartingOrderFunction(missingTeeth, customSequence);
    }
    // Otherwise, fall back to the original function for the numpad component.
    return createChartingOrder(missingTeeth, chartingModes, customSequence);
  }, [missingTeeth, chartingModes, customSequence, customChartingOrderFunction]);

  const activeInfo = chartingOrder[currentIndex] || null;
  const isComplete = currentIndex >= chartingOrder.length;

  const dispatch = (action) => {
    switch (action.type) {
      case 'APPLY_DATA':
        setCurrentIndex(prev => prev + 1); 
        break;
      case 'UNDO':
        setCurrentIndex(prev => Math.max(0, prev - 1));
        break;
      case 'REDO':
        setCurrentIndex(prev => Math.min(chartingOrder.length -1, prev + 1));
        break;
      case 'SET_POSITION':
        const newIndex = chartingOrder.findIndex(
            item => item.toothId === action.payload.toothId && item.surface === action.payload.surface
        );
        if (newIndex !== -1) {
            setCurrentIndex(newIndex);
        }
        break;
      case 'RESET':
        setCurrentIndex(0);
        break;
      default:
        break;
    }
  };

  return { activeInfo, isComplete, dispatch };
};