import { useState, useRef, useCallback, useEffect } from 'react';
import { RecognitionState } from '@/components/domain/RecognitionStatus';
import { LandmarkFrame, RecognitionResult, SpokenLang, Translation } from '@/types/domain';
import { registry } from '@/services/registry';
import { logger } from '@/lib/logger';
import { announceToScreenReader } from '@/lib/a11y';

export interface UseRecognitionMachineProps {
  spokenLang: SpokenLang;
  onRecognized?: (result: RecognitionResult) => void;
}

export function useRecognitionMachine({ spokenLang, onRecognized }: UseRecognitionMachineProps) {
  const [state, setState] = useState<RecognitionState>('camera_ready');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [recognizedResult, setRecognizedResult] = useState<RecognitionResult | null>(null);
  const [proposedSentence, setProposedSentence] = useState<Translation | null>(null);
  const [noHandsWarning, setNoHandsWarning] = useState(false);

  const framesBufferRef = useRef<LandmarkFrame[]>([]);
  const handsAbsentTimerRef = useRef<any>(null);
  const maxUtteranceTimerRef = useRef<any>(null);
  const noHandsTimerRef = useRef<any>(null);
  const isTrackingHandsRef = useRef(false);
  const isFinalizingRef = useRef(false);

  const transitionTo = useCallback((nextState: RecognitionState, announceText?: string) => {
    setState(nextState);
    if (announceText) {
      announceToScreenReader(announceText, 'polite');
    }
  }, []);

  const resetTimers = () => {
    if (handsAbsentTimerRef.current) clearTimeout(handsAbsentTimerRef.current);
    if (maxUtteranceTimerRef.current) clearTimeout(maxUtteranceTimerRef.current);
    if (noHandsTimerRef.current) clearTimeout(noHandsTimerRef.current);
  };

  const finalizeRecognition = useCallback(async () => {
    if (isFinalizingRef.current) return;
    isFinalizingRef.current = true;
    resetTimers();
    transitionTo('processing', 'Interprétation en cours');

    try {
      const result = await registry.ai.recognition.finalize();

      if (!result.signs || result.signs.length === 0 || result.level === 'low' || (result as any).isUncertain) {
        transitionTo('low_confidence', "Reconnaissance incertaine. Veuillez répéter le signe.");
        setRecognizedResult(result);
        return;
      }

      // Generate sentence
      const translation = await registry.languageGeneration.glossToSentence(result.sequence);

      setRecognizedResult(result);
      setProposedSentence(translation);
      transitionTo('recognized', 'Message reconnu avec succès');
      onRecognized?.(result);
      logger.info('Utterance recognized', { sequence: result.sequence, confidence: result.overallConfidence });
    } catch (err: any) {
      setErrorMessage(err.message || 'AI-004');
      transitionTo('error', 'Erreur lors de la reconnaissance');
      logger.error('Recognition finalize failed', err.code || 'AI-004', err);
    } finally {
      isFinalizingRef.current = false;
    }
  }, [transitionTo, onRecognized]);

  const startRecognition = useCallback(async () => {
    framesBufferRef.current = [];
    setRecognizedResult(null);
    setProposedSentence(null);
    setNoHandsWarning(false);
    isTrackingHandsRef.current = false;

    await registry.ai.recognition.start({ lang: spokenLang });
    transitionTo('recognizing', 'Reconnaissance démarrée. Gardez vos mains visibles.');

    // 3s no-hands warning timer
    noHandsTimerRef.current = setTimeout(() => {
      if (!isTrackingHandsRef.current) {
        setNoHandsWarning(true);
        announceToScreenReader('Mains non détectées. Placez-les dans le cadre.', 'polite');
      }
    }, 3000);

    // 12s maximum utterance auto-finalize timer
    maxUtteranceTimerRef.current = setTimeout(() => {
      finalizeRecognition();
    }, 12000);
  }, [spokenLang, transitionTo, finalizeRecognition]);

  const stopRecognition = useCallback(() => {
    if (state === 'recognizing' || state === 'capturing') {
      finalizeRecognition();
    } else {
      resetTimers();
      if ('abort' in registry.ai.recognition) {
        (registry.ai.recognition as any).abort();
      }
      transitionTo('camera_ready');
    }
  }, [state, finalizeRecognition, transitionTo]);

  // Push incoming landmark or webcam image frame from camera/tracking
  const pushFrame = useCallback(
    (frame: LandmarkFrame | any) => {
      if (state !== 'recognizing' && state !== 'capturing') return;

      const isImageFrame = frame && (typeof frame === 'string' || 'image' in frame || 'data' in frame);
      const hasHands = isImageFrame || Boolean(frame.hands && frame.hands.length > 0);

      if (hasHands) {
        isTrackingHandsRef.current = true;
        setNoHandsWarning(false);

        if (state === 'recognizing') {
          transitionTo('capturing');
        }

        framesBufferRef.current.push(frame);
        registry.ai.recognition.push(frame);

        // Auto-finalize once a complete 16-frame gesture window is recorded (~1.6s)
        if (framesBufferRef.current.length >= 16) {
          finalizeRecognition();
          return;
        }

        // Reset absence timer
        if (handsAbsentTimerRef.current) clearTimeout(handsAbsentTimerRef.current);
      } else {
        // Hands absent
        if (state === 'capturing' && framesBufferRef.current.length >= 8) {
          // If absent for >= 800ms, finalize
          if (!handsAbsentTimerRef.current) {
            handsAbsentTimerRef.current = setTimeout(() => {
              finalizeRecognition();
            }, 800);
          }
        }
      }
    },
    [state, transitionTo, finalizeRecognition]
  );

  const resetToReady = useCallback(() => {
    resetTimers();
    if ('abort' in registry.ai.recognition) {
      (registry.ai.recognition as any).abort();
    }
    setRecognizedResult(null);
    setProposedSentence(null);
    setNoHandsWarning(false);
    transitionTo('camera_ready');
  }, [transitionTo]);

  useEffect(() => {
    return () => {
      resetTimers();
      if ('abort' in registry.ai.recognition) {
        (registry.ai.recognition as any).abort();
      }
    };
  }, []);

  return {
    state,
    errorMessage,
    recognizedResult,
    proposedSentence,
    noHandsWarning,
    startRecognition,
    stopRecognition,
    finalizeRecognition,
    pushFrame,
    resetToReady,
    setProposedSentence,
  };
}
