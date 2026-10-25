import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@/stores/sessionStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';
import { useDemoStore } from '@/stores/demoStore';
import { useCamera } from '@/hooks/useCamera';
import { useRecognitionMachine } from '@/hooks/useRecognitionMachine';
import { registry } from '@/services/registry';
import { SignClip, SpokenLang, Translation, Phrase } from '@/types/domain';
import { formatDuration } from '@/lib/time';
import { downloadFile } from '@/lib/download';
import { triggerHaptic } from '@/lib/a11y';

// Components
import { CameraPanel } from '@/components/domain/CameraPanel';
import { RecognitionStatus } from '@/components/domain/RecognitionStatus';
import { DetectedSignChip } from '@/components/domain/DetectedSignChip';
import { SentenceCard } from '@/components/domain/SentenceCard';
import { ConversationMessage as MessageItem } from '@/components/domain/ConversationMessage';
import { TextToSignPanel } from '@/components/domain/TextToSignPanel';
import { DemoCoach } from '@/components/domain/DemoCoach';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Sheet } from '@/components/ui/Sheet';
import { Modal } from '@/components/ui/Modal';
import { PhraseCard } from '@/components/domain/PhraseCard';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

import {
  ArrowLeft,
  Pause,
  Play,
  StopCircle,
  Siren,
  Download,
  Trash2,
  Edit2,
  Check,
  Radio,
  BookOpen,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';

export const WorkspacePage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const {
    currentSession,
    messages,
    status,
    activeMs,
    loadSession,
    pauseSession,
    resumeSession,
    endSession,
    addMessage,
    editMessage,
    setSpokenLang,
    setSessionMode,
    updateSessionTitle,
    clearSessionMessages,
  } = useSessionStore();

  const { settings, updateSettings } = useSettingsStore();
  const { addToast, setEmergencySheetOpen, setPrivacySheetOpen } = useUiStore();
  const { isDemoActive, getCurrentStep, nextStep } = useDemoStore();

  // Mobile navigation tabs
  const [mobileTab, setMobileTab] = useState<'sign' | 'speech' | 'conversation'>('sign');
  const [unreadMessages, setUnreadMessages] = useState(false);

  useEffect(() => {
    if (currentSession?.mode === 'language_to_sign') {
      setMobileTab('speech');
    } else if (currentSession?.mode === 'sign_to_language') {
      setMobileTab('sign');
    }
  }, [currentSession?.mode]);

  // Cleanly shut down camera and recognition when switching away to language_to_sign
  useEffect(() => {
    if (currentSession?.mode === 'language_to_sign') {
      if (recognition.state === 'recognizing' || recognition.state === 'capturing') {
        recognition.stopRecognition();
      }
      camera.stopCamera();
    }
  }, [currentSession?.mode]);

  // Comprehensive resource cleanup on unmount
  useEffect(() => {
    return () => {
      camera.stopCamera();
      if (recognition.state === 'recognizing' || recognition.state === 'capturing') {
        recognition.stopRecognition();
      }
      registry.ai.recognition.reset();
      if (sttListening) {
        registry.speech.stt.stop();
      }
    };
  }, []);

  // Modals & Sheets
  const [endConfirmOpen, setEndConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [isClearingMessages, setIsClearingMessages] = useState(false);
  const [phrasePickerOpen, setPhrasePickerOpen] = useState(false);
  const [conversationDrawerOpen, setConversationDrawerOpen] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isEnding, setIsEnding] = useState(false);

  // Right panel (Language composer) state
  const [composerText, setComposerText] = useState('');
  const [sttListening, setSttListening] = useState(false);
  const [translatedClips, setTranslatedClips] = useState<SignClip[]>([]);
  const [composerSuggestions, setComposerSuggestions] = useState<Phrase[]>([]);

  // Refs
  const timelineRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Camera & recognition hooks
  const camera = useCamera();

  const recognition = useRecognitionMachine({
    spokenLang: currentSession?.spokenLang || 'fr',
    onRecognized: () => {
      triggerHaptic(40);
    },
  });

  // Real Webcam frame extraction loop for Live ML Recognition
  useEffect(() => {
    if (recognition.state !== 'recognizing' && recognition.state !== 'capturing') {
      return;
    }

    const videoEl = camera.videoRef.current;
    if (!videoEl) return;

    let canvas: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;

    const intervalId = setInterval(() => {
      if (!videoEl || videoEl.readyState < 2 || videoEl.paused || videoEl.ended) {
        return;
      }

      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 240;
        ctx = canvas.getContext('2d');
      }

      if (ctx) {
        ctx.drawImage(videoEl, 0, 0, 320, 240);
        try {
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          recognition.pushFrame({ image: dataUrl, t: Date.now() });
        } catch {
          // Ignore transient frame capture error
        }
      }
    }, 100);

    return () => {
      clearInterval(intervalId);
    };
  }, [recognition.state, recognition.pushFrame, camera.videoRef]);

  // Load session from DB
  useEffect(() => {
    if (!sessionId) return;
    loadSession(sessionId).then((found) => {
      if (!found) {
        addToast({ message: t('workspace.conversationNotFound', 'Conversation introuvable'), type: 'alert' });
        navigate('/app/history');
      }
    });
  }, [sessionId, loadSession, navigate, addToast, t]);

  // Load context phrases for quick suggestions
  useEffect(() => {
    registry.phrasebook.list().then((list) => {
      const filtered = list.filter((p) => p.contexts.includes(currentSession?.context || 'healthcare'));
      setComposerSuggestions(filtered.slice(0, 3));
    });
  }, [currentSession?.context]);

  // Handle prefilled phrase from URL
  useEffect(() => {
    const phraseId = searchParams.get('phrase');
    if (!phraseId) return;

    registry.phrasebook.list().then((phrases) => {
      const p = phrases.find((item) => item.id === phraseId);
      if (p && currentSession) {
        setComposerText(p.text[currentSession.spokenLang] || p.text.fr);
      }
    });
  }, [searchParams, currentSession]);

  // Handle timeline scroll bottom detection
  const handleTimelineScroll = () => {
    const container = timelineRef.current;
    if (!container) return;
    const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBottom(distanceToBottom > 80);
  };

  const scrollToBottom = () => {
    if (timelineRef.current && typeof timelineRef.current.scrollTo === 'function') {
      timelineRef.current.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'smooth' });
    }
    setShowScrollBottom(false);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages.length]);

  // Right Panel: Translate text to LSA
  const handleTranslateToLsa = async (textToTranslate?: string) => {
    const text = textToTranslate || composerText;
    if (!text.trim() || !currentSession) return;

    const result = await registry.textToSign.sentenceToGloss(text, currentSession.spokenLang);

    if (result.gloss.length === 0) {
      addToast({
        message: t('err.outOfVocab', 'Cette phrase est en dehors du vocabulaire actuel.'),
        type: 'alert',
      });
      return;
    }

    const clips = await registry.signAssets.getClips(result.gloss);
    setTranslatedClips(clips);

    // Auto log message to conversation
    if (settings.privacy.autoLogMessages) {
      await addMessage({
        direction: 'language_to_sign',
        source: currentSession.spokenLang,
        originalInput: text,
        outputs: {
          fr: text,
          ar: text,
          en: text,
        },
        gloss: result.gloss,
        displayLang: currentSession.spokenLang,
        confidence: 1.0,
        level: 'high',
        edited: false,
      });

      addToast({
        message: t('composer.addedToConversation', 'Ajouté à la conversation'),
        type: 'success',
      });
    }

    if (isDemoActive) {
      nextStep();
    }
  };

  // Right Panel: STT Voice input
  const toggleSpeechRecognition = () => {
    if (!currentSession) return;
    const speech = registry.speech;

    if (!speech.stt.isSupported()) {
      addToast({
        message: t('err.micUnsupported', 'La saisie vocale n’est pas disponible sur ce navigateur. Veuillez écrire.'),
        type: 'alert',
      });
      setTimeout(() => document.getElementById('text-to-sign-input')?.focus(), 50);
      return;
    }

    if (sttListening) {
      speech.stt.stop();
      setSttListening(false);
    } else {
      setSttListening(true);
      speech.stt.start({
        lang: currentSession.spokenLang,
        onInterim: (text) => setComposerText(text),
        onFinal: (text) => {
          setComposerText(text);
          setSttListening(false);
          handleTranslateToLsa(text);
        },
        onError: (errCode) => {
          setSttListening(false);
          let msg = t('err.mic', 'Erreur microphone');
          if (errCode === 'MIC-001') {
            msg = t('err.micDenied', 'Accès micro refusé. Veuillez autoriser le microphone dans les paramètres de votre navigateur.');
          } else if (errCode === 'MIC-002') {
            msg = t('err.micUnsupported', 'La saisie vocale n’est pas disponible sur ce navigateur. Veuillez écrire.');
          }
          addToast({ message: msg, type: 'alert' });
          setTimeout(() => document.getElementById('text-to-sign-input')?.focus(), 50);
        },
      });
    }
  };

  // Advertised Workspace Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput =
        activeEl instanceof HTMLInputElement ||
        activeEl instanceof HTMLTextAreaElement ||
        activeEl instanceof HTMLSelectElement ||
        (activeEl instanceof HTMLElement && activeEl.isContentEditable);

      // Escape: Dismiss active modals/sheets or stop speech input
      if (e.key === 'Escape') {
        if (clearConfirmOpen) {
          setClearConfirmOpen(false);
          return;
        }
        if (endConfirmOpen) {
          setEndConfirmOpen(false);
          return;
        }
        if (phrasePickerOpen) {
          setPhrasePickerOpen(false);
          return;
        }
        if (sttListening) {
          toggleSpeechRecognition();
          return;
        }
        if (isInput && activeEl instanceof HTMLElement) {
          activeEl.blur();
          return;
        }
      }

      // Space: Toggle Camera (Only outside input fields and buttons)
      if (e.key === ' ' || e.code === 'Space') {
        if (isInput || activeEl instanceof HTMLButtonElement) {
          return;
        }
        e.preventDefault();
        if (camera.status === 'active') {
          camera.stopCamera();
          addToast({ message: t('workspace.camDisabledToast', 'Caméra désactivée (Espace)'), type: 'status' });
        } else {
          camera.startCamera();
          addToast({ message: t('workspace.camEnabledToast', 'Caméra activée (Espace)'), type: 'status' });
        }
        return;
      }

      // Alt key combinations
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === 'e') {
          e.preventDefault();
          setEmergencySheetOpen(true);
          addToast({ message: t('workspace.emergencyToast', 'Phrases d’urgence (Alt+E)'), type: 'status' });
        } else if (k === 'm') {
          e.preventDefault();
          toggleSpeechRecognition();
        } else if (k === 'p') {
          e.preventDefault();
          setPrivacySheetOpen(true);
          addToast({ message: t('workspace.privacyToast', 'Confidentialité & Aide (Alt+P)'), type: 'status' });
        } else if (k === 'r') {
          e.preventDefault();
          setPhrasePickerOpen((prev) => !prev);
        } else if (k === 't') {
          e.preventDefault();
          setTimeout(() => {
            document.getElementById('text-to-sign-input')?.focus();
          }, 50);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    clearConfirmOpen,
    endConfirmOpen,
    phrasePickerOpen,
    sttListening,
    camera.status,
    camera.startCamera,
    camera.stopCamera,
    setEmergencySheetOpen,
    setPrivacySheetOpen,
    addToast,
    toggleSpeechRecognition,
  ]);

  // Left Panel: Send proposed sentence from LSA
  const handleSendProposed = async (sentence: Translation, displayLang: SpokenLang) => {
    if (!currentSession || !recognition.recognizedResult) return;

    await addMessage({
      direction: 'sign_to_language',
      source: 'lsa',
      originalInput: recognition.recognizedResult.sequence,
      outputs: sentence,
      gloss: recognition.recognizedResult.sequence,
      displayLang,
      confidence: recognition.recognizedResult.overallConfidence,
      level: recognition.recognizedResult.level,
      edited: false,
      interpretation: {
        recognizedSigns: recognition.recognizedResult.signs,
        frames: recognition.recognizedResult.frames,
        latencyMs: recognition.recognizedResult.latencyMs,
        model: recognition.recognizedResult.model.name,
        adapter: registry.ai.adapter,
      },
    });

    // Voice output policy
    if (settings.audio.voiceOutput) {
      registry.speech.tts.speak({
        text: sentence[displayLang],
        lang: displayLang,
      });
    }

    recognition.resetToReady();

    if (isDemoActive) {
      nextStep();
    }
  };

  // Single simulate sign action in demo
  const handleSimulateSign = () => {
    const step = getCurrentStep();
    if (step?.simulatedSigns) {
      registry.mockRecognition.setScriptedResult({
        signs: step.simulatedSigns,
        sequence: step.simulatedSigns.map((s) => s.gloss),
        overallConfidence: 0.95,
        level: 'high',
        frames: 36,
        latencyMs: 320,
        model: { name: 'LSA-Sequence-TCN-Lite', version: '0.1.0-mvp' },
        adapter: 'demo',
      });
    }
    recognition.startRecognition();
    setTimeout(() => {
      recognition.stopRecognition();
    }, 1200);
  };

  const handleAddToConversation = async (text: string, gloss: string[]) => {
    if (!currentSession) return;
    await addMessage({
      direction: 'language_to_sign',
      source: currentSession.spokenLang,
      originalInput: text,
      outputs: {
        fr: text,
        ar: text,
        en: text,
      },
      gloss,
      displayLang: currentSession.spokenLang,
      confidence: 1.0,
      level: 'high',
      edited: false,
    });
    addToast({
      message: t('textToSign.addedToConversation', 'Ajouté à la conversation'),
      type: 'success',
    });
  };

  // Export Session
  const handleExport = async (format: 'txt' | 'json') => {
    if (!sessionId) return;
    const data = await registry.sessions.exportSession(sessionId);

    if (format === 'json') {
      downloadFile(
        `lsa_conversation_${sessionId}.json`,
        JSON.stringify(data, null, 2),
        'application/json'
      );
    } else {
      const lines = data.messages.map(
        (m) =>
          `[${new Date(m.createdAt).toLocaleTimeString()}] ${
            m.direction === 'sign_to_language' ? 'LSA (Signeur)' : 'Interlocuteur'
          }: ${m.outputs[data.session.spokenLang]} (Glose: ${m.gloss.join(' ')})`
      );
      const text = `CONVERSATION CONNECTSIGN\nTitre: ${data.session.title}\nDate: ${new Date(
        data.session.startedAt
      ).toLocaleString()}\n\n${lines.join('\n')}`;
      downloadFile(`connectsign_conversation_${sessionId}.txt`, text, 'text/plain');
    }
  };

  // End session cleanly & navigate home
  const handleEndSession = async () => {
    if (isEnding) return;
    setIsEnding(true);
    try {
      if (recognition.state === 'recognizing' || recognition.state === 'capturing') {
        recognition.stopRecognition();
      }
      camera.stopCamera();
      if (sttListening) {
        toggleSpeechRecognition();
      }
      await endSession();
      addToast({
        message: t('workspace.sessionEndedToast', 'Conversation terminée et enregistrée'),
        type: 'status',
      });
      navigate('/app', { replace: true });
    } catch {
      addToast({
        message: t('err.generic', 'Une erreur est survenue'),
        type: 'alert',
      });
    } finally {
      setIsEnding(false);
      setEndConfirmOpen(false);
    }
  };

  if (!currentSession) {
    return <div className="p-8 text-center text-app-muted">{t('workspace.loadingSession', 'Chargement de la session…')}</div>;
  }

  const role = settings.role;
  const colRatio =
    role === 'sign' ? 'lg:grid-cols-[1.15fr_0.85fr]' : role === 'speech' ? 'lg:grid-cols-[0.85fr_1.15fr]' : 'lg:grid-cols-2';

  const renderSignPanel = (customClassName: string = '') => (
    <Card
      p={16}
      data-testid="sign-recognition-panel"
      className={`flex flex-col justify-between min-h-0 overflow-y-auto ${customClassName}`}
    >
      <div className="space-y-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-app-border pb-2.5">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0 max-w-full sm:max-w-[55%]">
            <span className="text-xl shrink-0 mt-0.5 sm:mt-0" aria-hidden="true">
              🤟
            </span>
            <div className="min-w-0 flex flex-col">
              <h3 className="font-bold text-sm text-app-text leading-snug">
                {t('mode.signToLang', 'Sign to Text (Algerian Sign Language)')}
              </h3>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium leading-normal break-words">
                {t('workspace.aiProtoDisclaimer')}
              </span>
            </div>
          </div>
          <div className="shrink-0 w-full sm:w-auto min-w-0">
            <RecognitionStatus
              state={
                camera.status === 'idle'
                  ? 'permission_needed'
                  : camera.status === 'error'
                  ? 'error'
                  : recognition.state
              }
              errorMessage={
                camera.status === 'error'
                  ? camera.errorCode === 'CAM-001'
                    ? t('err.camBlocked', 'Camera access blocked. Please enable camera permissions.')
                    : t('err.camGeneric', 'Camera hardware error.')
                  : recognition.errorMessage
              }
              className="w-full sm:w-auto"
            />
          </div>
        </div>

        {/* Camera Panel */}
        <CameraPanel
          videoRef={camera.videoRef}
          cameraStatus={camera.status}
          errorCode={camera.errorCode}
          onStartCamera={camera.startCamera}
          facingMode={camera.facingMode}
          onToggleFacingMode={camera.toggleFacingMode}
          mirror={settings.camera.mirror}
          onToggleMirror={() =>
            updateSettings({
              camera: { ...settings.camera, mirror: !settings.camera.mirror },
            })
          }
          showTracking={settings.camera.showTrackingByDefault}
          onToggleTracking={() =>
            updateSettings({
              camera: {
                ...settings.camera,
                showTrackingByDefault: !settings.camera.showTrackingByDefault,
              },
            })
          }
          isRecognizing={
            recognition.state === 'recognizing' || recognition.state === 'capturing'
          }
        />

        {/* Detected signs row */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-app-muted">
            {t('rec.detectedSigns', 'Signes détectés')}
          </span>
          <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-app-surface-2 rounded-control border border-app-border">
            {recognition.recognizedResult?.signs &&
            recognition.recognizedResult.signs.length > 0 ? (
              recognition.recognizedResult.signs.map((sign, idx) => (
                <DetectedSignChip
                  key={idx}
                  gloss={sign.gloss}
                  confidence={sign.confidence}
                  level={sign.level}
                  atMs={sign.atMs}
                />
              ))
            ) : (
              <span className="text-xs text-app-muted italic">
                {t('rec.detectedSignsEmpty', 'Les signes détectés apparaîtront ici')}
              </span>
            )}
          </div>
        </div>

        {/* Proposed Message Card */}
        {recognition.state === 'recognized' && recognition.proposedSentence && (
          <SentenceCard
            sentence={recognition.proposedSentence}
            confidence={recognition.recognizedResult?.overallConfidence}
            level={recognition.recognizedResult?.level}
            spokenLang={currentSession.spokenLang}
            onSend={handleSendProposed}
            onDiscard={recognition.resetToReady}
          />
        )}

        {/* Rejection / Uncertainty Message Banner */}
        {recognition.state === 'low_confidence' && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-control flex items-center justify-between text-xs text-amber-700 dark:text-amber-400">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
              <span className="font-medium">
                {(recognition.recognizedResult as any)?.rejectionMessage || t('rec.low', 'Sign not recognized. Please try again.')}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={recognition.resetToReady}>
              {t('common.dismiss', 'OK')}
            </Button>
          </div>
        )}

        {/* Processing State Indicator */}
        {recognition.state === 'processing' && (
          <div
            role="status"
            aria-live="polite"
            className="p-3 bg-app-surface-2 border border-app-primary-strong/40 rounded-control flex items-center justify-between text-xs text-app-text animate-pulse"
          >
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-app-primary-strong border-t-transparent rounded-full animate-spin shrink-0" />
              <span className="font-medium">
                {t('rec.processing', 'Interprétation en cours…')}
              </span>
            </div>
            <span className="text-[11px] font-mono text-app-muted">
              {registry.ai.adapter === 'live' ? 'Render AI' : 'Mode Démo'}
            </span>
          </div>
        )}

        {/* Error State Banner with Instant Retry */}
        {recognition.state === 'error' && (
          <div
            role="alert"
            className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-control flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-rose-700 dark:text-rose-400"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <div className="space-y-0.5">
                <span className="font-bold block">
                  {t('err.aiUnavailable', 'Erreur de reconnaissance')}
                </span>
                <span className="text-[11px] text-rose-600 dark:text-rose-300">
                  {recognition.errorMessage || t('err.network', 'Une erreur est survenue lors de l’analyse. Veuillez réessayer.')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  recognition.resetToReady();
                  if (camera.status !== 'ready') {
                    const ok = await camera.startCamera();
                    if (!ok) return;
                  }
                  await recognition.startRecognition();
                }}
              >
                {t('common.retry', 'Réessayer')}
              </Button>
              <Button variant="ghost" size="sm" onClick={recognition.resetToReady}>
                {t('common.dismiss', 'Ignorer')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Left Controls Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-app-border mt-2.5">
        <div className="flex items-center gap-2">
          {recognition.state === 'recognizing' || recognition.state === 'capturing' ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={recognition.stopRecognition}
              iconStart={<StopCircle className="w-3.5 h-3.5" />}
            >
              {t('rec.stopRec', 'Arrêter')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={recognition.state === 'processing'}
              onClick={async () => {
                if (camera.status !== 'ready') {
                  const ok = await camera.startCamera();
                  if (!ok) return;
                }
                recognition.startRecognition();
              }}
              iconStart={<Radio className="w-3.5 h-3.5 animate-pulse" />}
            >
              {recognition.state === 'processing'
                ? t('rec.processing', 'Interprétation…')
                : t('rec.startRec', 'Démarrer la reconnaissance')}
            </Button>
          )}

          {/* Simulate sign button in Demo mode */}
          {isDemoActive && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSimulateSign}
              iconStart={<Sparkles className="w-3.5 h-3.5 text-app-warning" />}
            >
              {t('rec.simulateSign', 'Simuler le signe')}
            </Button>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setPhrasePickerOpen(true)}
          iconStart={<BookOpen className="w-3.5 h-3.5" />}
        >
          {t('rec.usePhrases', 'Phrases rapides')}
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="flex flex-col h-full bg-app-bg text-app-text overflow-hidden">
      {/* Workspace Header Chrome */}
      <header className="h-14 bg-app-surface border-b border-app-border px-2.5 sm:px-4 flex items-center justify-between gap-2 shrink-0 select-none z-10">
        {/* Left: Back, Mode Switcher & Title */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await pauseSession();
              navigate('/app');
            }}
            iconStart={<ArrowLeft className="w-4 h-4 rtl:-scale-x-100" />}
            className="shrink-0 px-2 sm:px-3"
          >
            <span className="hidden lg:inline">{t('workspace.homeNav', 'Accueil')}</span>
          </Button>

          {/* Mode selector (visible, accessible, and touch-friendly on both mobile and desktop) */}
          <div className="relative inline-flex items-center min-w-0 shrink max-w-[130px] sm:max-w-[200px] md:max-w-xs">
            <label htmlFor="workspace-mode-select" className="sr-only">
              {t('newConv.modeLabel', 'Mode de traduction')}
            </label>
            <select
              id="workspace-mode-select"
              data-testid="workspace-mode-select"
              aria-label={t('newConv.modeLabel', 'Mode de traduction')}
              value={currentSession.mode}
              onChange={async (e) => {
                const newMode = e.target.value as any;
                await setSessionMode(newMode);
              }}
              className="h-8 w-full min-w-0 ps-2.5 pe-7 text-xs font-semibold rounded-pill bg-teal-500/10 hover:bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 hover:border-teal-500/60 focus:outline-none focus:ring-2 focus:ring-app-primary-strong cursor-pointer transition-all appearance-none truncate"
            >
              <option value="two_way" className="bg-app-surface text-app-text">
                {t('mode.twoWay', 'Double sens')}
              </option>
              <option value="sign_to_language" className="bg-app-surface text-app-text">
                {t('mode.signToLang', 'LSA → Texte')}
              </option>
              <option value="language_to_sign" className="bg-app-surface text-app-text">
                {t('mode.langToSign', 'Texte → LSA')}
              </option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 absolute end-2 pointer-events-none shrink-0" />
          </div>

          {/* Title & Context (Only shown on wider screens to avoid cramping the mode selector on mobile) */}
          <div className="hidden md:flex items-center gap-2 min-w-0 truncate">
            {isEditingTitle ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="px-2 py-0.5 rounded border border-app-border-strong text-xs font-semibold"
                />
                <button
                  type="button"
                  onClick={async () => {
                    await updateSessionTitle(titleInput);
                    setIsEditingTitle(false);
                  }}
                  className="p-1 text-app-success"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setTitleInput(currentSession.title);
                  setIsEditingTitle(true);
                }}
                className="font-bold text-sm text-app-text truncate hover:underline flex items-center gap-1.5"
              >
                <span className="truncate">{currentSession.title}</span>
                <Edit2 className="w-3 h-3 text-app-muted shrink-0" />
              </button>
            )}

            <span className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded-pill bg-app-surface-2 text-[11px] font-medium text-app-muted border border-app-border">
              {t(`contexts.${currentSession.context}`)}
            </span>
          </div>
        </div>

        {/* Right: Timer, Spoken Language Switcher, Emergency, End */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Spoken language selector (hidden on small viewports so header does not crowd) */}
          <div className="hidden lg:flex items-center gap-1 bg-app-surface-2 p-0.5 rounded-control text-xs font-semibold">
            {(['fr', 'ar', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setSpokenLang(l)}
                className={`px-2 py-0.5 rounded-control uppercase transition-all ${
                  currentSession.spokenLang === l
                    ? 'bg-app-surface text-app-primary-strong shadow-1 font-bold'
                    : 'text-app-muted hover:text-app-text'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Active Timer */}
          <div className="px-1.5 sm:px-2 py-1 rounded-control bg-app-surface-2 text-xs font-mono font-bold text-app-text tabular-nums shrink-0">
            {formatDuration(activeMs)}
          </div>

          {/* Emergency Trigger */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEmergencySheetOpen(true)}
            iconStart={<Siren className="w-4 h-4 text-app-warning" />}
            className="border-app-warning/50 hover:bg-amber-500/10 dark:hover:bg-amber-500/15 shrink-0 px-2 sm:px-3"
          >
            <span className="hidden md:inline">{t('emergency.button', 'Urgence')}</span>
          </Button>

          {/* Pause / Resume */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (status === 'active' ? pauseSession() : resumeSession())}
            className="shrink-0 p-1.5 sm:p-2"
          >
            {status === 'active' ? (
              <Pause className="w-4 h-4 text-app-muted" />
            ) : (
              <Play className="w-4 h-4 text-app-primary-strong" />
            )}
          </Button>

          {/* Conversation History Drawer (Desktop) */}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setConversationDrawerOpen(true);
              setUnreadMessages(false);
            }}
            iconStart={<MessageSquare className="w-4 h-4 text-app-primary-strong" />}
            className="hidden md:inline-flex items-center gap-1.5 shrink-0"
            aria-label={t('timeline.title', 'Conversation')}
          >
            <span>{t('timeline.title', 'Conversation')}</span>
            <span className="px-1.5 py-0.5 rounded-pill bg-app-surface-2 text-[11px] font-mono font-bold text-app-muted">
              {messages.length}
            </span>
            {unreadMessages && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
          </Button>

          {/* End session */}
          <Button
            data-testid="end-session-header-btn"
            variant="destructive"
            size="sm"
            disabled={isEnding}
            onClick={handleEndSession}
            className="shrink-0"
          >
            {isEnding ? t('common.loading', 'Fin…') : t('dash.end', 'Terminer')}
          </Button>

          {/* Theme toggle (visible on desktop) */}
          <div className="hidden lg:block shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Demo Coach callout if active */}
      {isDemoActive && (
        <div className="px-4">
          <DemoCoach spokenLang={currentSession.spokenLang} />
        </div>
      )}

      {/* Mobile Mode Segmented Tabs (< 768px) */}
      <div className="md:hidden px-4 pt-2 pb-1 bg-app-surface border-b border-app-border">
        <SegmentedControl
          value={mobileTab}
          onChange={(tab) => {
            setMobileTab(tab);
            if (tab === 'conversation') setUnreadMessages(false);
          }}
          size="sm"
          options={
            currentSession.mode === 'language_to_sign'
              ? [
                  { value: 'speech', label: '🗣️ Texte → LSA' },
                  {
                    value: 'conversation',
                    label: (
                      <span className="flex items-center gap-1">
                        <span>{t('workspace.discussionTab', 'Discussion')}</span>
                        {unreadMessages && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </span>
                    ),
                  },
                ]
              : currentSession.mode === 'sign_to_language'
              ? [
                  { value: 'sign', label: '🤟 LSA' },
                  {
                    value: 'conversation',
                    label: (
                      <span className="flex items-center gap-1">
                        <span>{t('workspace.discussionTab', 'Discussion')}</span>
                        {unreadMessages && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </span>
                    ),
                  },
                ]
              : [
                  { value: 'sign', label: '🤟 LSA' },
                  { value: 'speech', label: '🗣️ Parole' },
                  {
                    value: 'conversation',
                    label: (
                      <span className="flex items-center gap-1">
                        <span>{t('workspace.discussionTab', 'Discussion')}</span>
                        {unreadMessages && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                      </span>
                    ),
                  },
                ]
          }
          className="w-full"
        />
      </div>

      {/* Main Workspace Area (Desktop Grid vs Mobile View) */}
      <div className="flex-1 min-h-0 overflow-hidden p-2 sm:p-3 lg:p-4 w-full max-w-[1720px] mx-auto flex flex-col">
        {currentSession.mode === 'language_to_sign' ? (
          /* Focused Language-to-Sign / Text-to-Sign Experience */
          <div
            data-testid="language-to-sign-view"
            className={`flex-1 min-h-0 overflow-y-auto max-w-4xl w-full mx-auto p-1 sm:p-4 flex flex-col ${
              mobileTab === 'conversation' ? 'hidden md:flex' : 'flex'
            }`}
          >
            <Card
              p={16}
              className="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto"
            >
              <TextToSignPanel
                currentLang={currentSession.spokenLang}
                prominentMode
                autoFocus
                externalClips={translatedClips}
                onAddToConversation={handleAddToConversation}
              />
            </Card>
          </div>
        ) : currentSession.mode === 'sign_to_language' ? (
          /* Focused Sign-to-Language / Sign Recognition Experience */
          <div
            data-testid="sign-to-language-view"
            className={`flex-1 min-h-0 overflow-y-auto max-w-4xl w-full mx-auto p-1 sm:p-4 flex flex-col ${
              mobileTab === 'conversation' ? 'hidden md:flex' : 'flex'
            }`}
          >
            {renderSignPanel('flex-1 min-h-0')}
          </div>
        ) : (
          /* Both modes (two_way) - Two column view */
          <div
            data-testid="two-way-view"
            className={`grid grid-cols-1 ${colRatio} gap-3 sm:gap-4 flex-1 min-h-0 h-full`}
          >
            {renderSignPanel(mobileTab !== 'sign' ? 'hidden md:flex' : 'flex')}

            {/* RIGHT PANEL: Language (Text to Sign) */}
            <Card
              p={16}
              className={`flex flex-col justify-between min-h-0 overflow-y-auto ${
                mobileTab !== 'speech' ? 'hidden md:flex' : 'flex'
              }`}
            >
              <TextToSignPanel
                currentLang={currentSession.spokenLang}
                externalClips={translatedClips}
                onAddToConversation={handleAddToConversation}
              />
            </Card>
          </div>
        )}

        {/* Mobile-Only Conversation Timeline Tab */}
        <Card
          p={16}
          className={`md:hidden flex-1 min-h-0 flex flex-col overflow-hidden ${
            mobileTab !== 'conversation' ? 'hidden' : 'flex'
          }`}
        >
          {/* Timeline Header */}
          <div className="flex items-center justify-between border-b border-app-border pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-app-text">
                {t('timeline.title', 'Conversation')}
              </h3>
              <span className="px-2 py-0.5 rounded-pill bg-app-surface-2 text-xs font-mono font-bold text-app-muted">
                {messages.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleExport('txt')}
                iconStart={<Download className="w-3.5 h-3.5" />}
              >
                Exporter
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setClearConfirmOpen(true)}
                iconStart={<Trash2 className="w-3.5 h-3.5 text-app-muted" />}
              >
                Effacer
              </Button>
            </div>
          </div>

          {/* Timeline Log Region */}
          <div
            ref={timelineRef}
            role="log"
            aria-live="polite"
            onScroll={handleTimelineScroll}
            className="flex-1 overflow-y-auto py-4 px-1 space-y-2 relative"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-app-muted space-y-2">
                <p className="text-sm">{t('timeline.empty', 'Votre conversation apparaîtra ici.')}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 bg-app-surface-2 rounded-control">
                    🤟 Signez à la caméra
                  </span>
                  <span className="px-2.5 py-1 bg-app-surface-2 rounded-control">
                    🗣️ Écrivez ou parlez
                  </span>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  onReplaySigns={async (gloss) => {
                    const clips = await registry.signAssets.getClips(gloss);
                    setTranslatedClips(clips);
                    if (window.innerWidth < 768) {
                      setMobileTab('speech');
                    }
                  }}
                  onEditMessage={editMessage}
                />
              ))
            )}

            {/* Scroll to bottom floating chip */}
            {showScrollBottom && (
              <button
                type="button"
                onClick={scrollToBottom}
                className="sticky bottom-2 start-1/2 -translate-x-1/2 px-3 py-1.5 rounded-pill bg-app-primary-strong text-white text-xs font-semibold shadow-2 flex items-center gap-1.5 hover:bg-app-primary-hover animate-slide-up"
              >
                <span>{t('timeline.newMessage', 'Nouveau message ↓')}</span>
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* Desktop Conversation History Drawer Sheet */}
      <Sheet
        isOpen={conversationDrawerOpen}
        onClose={() => setConversationDrawerOpen(false)}
        title={`${t('timeline.title', 'Conversation')} (${messages.length})`}
        maxWidth="lg"
      >
        <div className="flex flex-col h-[75vh]">
          {/* Timeline Action Header */}
          <div className="flex items-center justify-end gap-2 pb-3 border-b border-app-border shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleExport('txt')}
              iconStart={<Download className="w-3.5 h-3.5" />}
            >
              Exporter
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setClearConfirmOpen(true)}
              iconStart={<Trash2 className="w-3.5 h-3.5 text-app-muted" />}
            >
              Effacer
            </Button>
          </div>

          {/* Timeline Messages List */}
          <div
            role="log"
            aria-live="polite"
            className="flex-1 overflow-y-auto py-4 px-1 space-y-2 relative"
          >
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-app-muted space-y-2">
                <p className="text-sm">{t('timeline.empty', 'Votre conversation apparaîtra ici.')}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 bg-app-surface-2 rounded-control">
                    🤟 Signez à la caméra
                  </span>
                  <span className="px-2.5 py-1 bg-app-surface-2 rounded-control">
                    🗣️ Écrivez ou parlez
                  </span>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  onReplaySigns={async (gloss) => {
                    const clips = await registry.signAssets.getClips(gloss);
                    setTranslatedClips(clips);
                    setConversationDrawerOpen(false);
                  }}
                  onEditMessage={editMessage}
                />
              ))
            )}
          </div>
        </div>
      </Sheet>

      {/* Phrasebook Picker Sheet */}
      <Sheet
        isOpen={phrasePickerOpen}
        onClose={() => setPhrasePickerOpen(false)}
        title={t('workspace.phrasePickerTitle', 'Sélectionner une phrase rapide')}
        maxWidth="lg"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {composerSuggestions.map((phrase) => (
            <PhraseCard
              key={phrase.id}
              phrase={phrase}
              onSendToConversation={(p) => {
                setComposerText(p.text[currentSession.spokenLang] || p.text.fr);
                handleTranslateToLsa(p.text[currentSession.spokenLang] || p.text.fr);
                setPhrasePickerOpen(false);
              }}
            />
          ))}
        </div>
      </Sheet>

      {/* End Session Confirmation Modal */}
      <Modal
        isOpen={endConfirmOpen}
        onClose={() => setEndConfirmOpen(false)}
        title={t('workspace.endModalTitle', 'Terminer la conversation ?')}
        maxWidth="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEndConfirmOpen(false)}>
              {t('workspace.endModalContinue', 'Continuer')}
            </Button>
            <Button
              variant="destructive"
              disabled={isEnding}
              onClick={handleEndSession}
            >
              {isEnding ? t('common.loading', 'Fin…') : t('workspace.endModalConfirm', 'Terminer la session')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-app-muted leading-relaxed">
          {t('workspace.endModalDesc', 'La session sera clôturée et sauvegardée dans votre Historique local. Vous pourrez la relire et l’exporter à tout moment.')}
        </p>
      </Modal>

      {/* Clear Messages Confirmation Modal */}
      <Modal
        isOpen={clearConfirmOpen}
        onClose={() => !isClearingMessages && setClearConfirmOpen(false)}
        title={t('timeline.clearConfirmTitle', 'Effacer les messages ?')}
        maxWidth="sm"
        footer={
          <>
            <Button
              variant="ghost"
              disabled={isClearingMessages}
              onClick={() => setClearConfirmOpen(false)}
            >
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button
              variant="destructive"
              disabled={isClearingMessages}
              onClick={async () => {
                setIsClearingMessages(true);
                try {
                  const success = await clearSessionMessages();
                  if (success) {
                    setClearConfirmOpen(false);
                    addToast({
                      message: t('timeline.messagesCleared', 'Messages effacés avec succès'),
                      type: 'status',
                    });
                  } else {
                    addToast({
                      message: t('timeline.clearFailed', 'Échec de la suppression des messages'),
                      type: 'alert',
                    });
                  }
                } catch {
                  addToast({
                    message: t('timeline.clearFailed', 'Échec de la suppression des messages'),
                    type: 'alert',
                  });
                } finally {
                  setIsClearingMessages(false);
                }
              }}
            >
              {isClearingMessages ? t('common.loading', 'Effacement…') : t('timeline.clearAction', 'Effacer')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-app-muted">
          {t('timeline.clearConfirmDesc', 'Tous les messages de la conversation active seront effacés.')}
        </p>
      </Modal>
    </div>
  );
};
