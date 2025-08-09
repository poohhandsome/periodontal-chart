// src/hooks/useSpeechEngine.js
import { useState, useRef, useEffect, useCallback } from 'react';

export const useSpeechEngine = ({
  onFinal,
  lang = 'th-TH',
  continuous = true,
  interimResults = true,
  continuousSession = false,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  const manualStopRef = useRef(false);

  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setError('This browser does not support the Web Speech API.');
      return;
    }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
      if (continuousSession && !manualStopRef.current) {
        try {
          if (recognitionRef.current) recognition.start();
        } catch (e) {
          console.error("Speech recognition auto-restart failed.", e);
        }
      }
    };

    recognition.onerror = (event) => {
      let errorMessage = event.error || 'speech-error';
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        errorMessage = 'Microphone permission denied.';
      }
      setError(errorMessage);
      setIsListening(false);
    };

    // --- BUG FIX HERE ---
    recognition.onresult = (event) => {
      let interim_transcript = '';
      let final_transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final_transcript += event.results[i][0].transcript;
        } else {
          interim_transcript += event.results[i][0].transcript;
        }
      }
      // Always show the latest interim result. The app will handle accumulation display.
      setTranscript(interim_transcript);

      if (final_transcript) {
        if (onFinalRef.current) onFinalRef.current(final_transcript.trim());
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, [lang, continuous, interimResults, continuousSession]);

  const start = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      manualStopRef.current = false;
      setTranscript('');
      setError(null);
      recognitionRef.current.start();
    }
  }, [isListening]);

  const stop = useCallback(() => {
    if (recognitionRef.current && isListening) {
      manualStopRef.current = true;
      recognitionRef.current.stop();
    }
  }, [isListening]);

  return { isListening, transcript, error, start, stop, setTranscript };
};