import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { registry } from '@/services/registry';
import { SignClip, SpokenLang, UiLang } from '@/types/domain';
import { SignPlayer } from './SignPlayer';
import { SEED_PHRASES } from '@/data/phrasebook';
import { Button } from '@/components/ui/Button';
import {
  Sparkles,
  HelpCircle,
  AlertCircle,
  SearchX,
  X,
  MessageSquarePlus,
  Loader2,
  CheckCircle2,
  Layers,
} from 'lucide-react';

export interface TextToSignPanelProps {
  currentLang?: SpokenLang;
  onAddToConversation?: (text: string, gloss: string[]) => Promise<void> | void;
  className?: string;
  autoFocus?: boolean;
  prominentMode?: boolean;
  externalClips?: SignClip[];
}

interface ExampleItem {
  id: string;
  text: Record<SpokenLang, string>;
  isSupported: boolean;
  gloss?: string[];
}

const EXAMPLES: ExampleItem[] = [
  {
    id: 'ex_hello',
    text: {
      en: 'Hello.',
      fr: 'Bonjour.',
      ar: 'مرحبًا.',
    },
    isSupported: true,
    gloss: ['HELLO'],
  },
  {
    id: 'ex_thank_you',
    text: {
      en: 'Thank you.',
      fr: 'Merci.',
      ar: 'شكرًا.',
    },
    isSupported: true,
    gloss: ['THANK-YOU'],
  },
  {
    id: 'ex_need_help',
    text: {
      en: 'I need help.',
      fr: "J'ai besoin d'aide.",
      ar: 'أحتاج إلى مساعدة.',
    },
    isSupported: true,
    gloss: ['NEED', 'HELP'],
  },
  {
    id: 'ex_pharmacy',
    text: {
      en: 'Where is the pharmacy?',
      fr: 'Où est la pharmacie ?',
      ar: 'أين هي الصيدلية؟',
    },
    isSupported: false,
  },
  {
    id: 'ex_need_doctor',
    text: {
      en: 'I need a doctor.',
      fr: "J'ai besoin d'un médecin.",
      ar: 'أحتاج إلى طبيب.',
    },
    isSupported: true,
    gloss: ['NEED', 'DOCTOR'],
  },
  {
    id: 'ex_stomach_pain',
    text: {
      en: 'My stomach hurts.',
      fr: "J'ai mal au ventre.",
      ar: 'عندي ألم في البطن.',
    },
    isSupported: true,
    gloss: ['STOMACH', 'PAIN'],
  },
];

type TranslationStatus = 'idle' | 'loading' | 'supported' | 'unsupported' | 'error';

export const TextToSignPanel: React.FC<TextToSignPanelProps> = ({
  currentLang = 'fr',
  onAddToConversation,
  className = '',
  autoFocus = false,
  prominentMode = false,
  externalClips,
}) => {
  const { t, i18n } = useTranslation();
  const activeLang = (i18n.resolvedLanguage || currentLang || 'fr') as UiLang;

  const [inputText, setInputText] = useState('');
  const [lastSubmittedText, setLastSubmittedText] = useState('');
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [translatedClips, setTranslatedClips] = useState<SignClip[]>([]);
  const [unsupportedTokens, setUnsupportedTokens] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isAddedToConv, setIsAddedToConv] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef<number>(0);

  React.useEffect(() => {
    if (externalClips && externalClips.length > 0) {
      setTranslatedClips(externalClips);
      setStatus('supported');
    }
  }, [externalClips]);

  const handleTranslate = async (textToRun?: string) => {
    const raw = typeof textToRun === 'string' ? textToRun : inputText;
    const text = raw.trim();
    if (!text) return;

    const currentReqId = ++requestIdRef.current;
    setStatus('loading');
    setLastSubmittedText(text);
    setIsAddedToConv(false);

    try {
      const result = await registry.textToSign.sentenceToGloss(text, activeLang);
      if (currentReqId !== requestIdRef.current) return;

      if (result.gloss.length === 0) {
        setTranslatedClips([]);
        setUnsupportedTokens(result.unsupportedTokens || []);
        setSuggestions(result.suggestions || []);
        setStatus('unsupported');
      } else {
        const clips = await registry.signAssets.getClips(result.gloss);
        if (currentReqId !== requestIdRef.current) return;
        setTranslatedClips(clips);
        setUnsupportedTokens([]);
        setSuggestions([]);
        setStatus('supported');
      }
    } catch {
      if (currentReqId !== requestIdRef.current) return;
      setStatus('error');
      setTranslatedClips([]);
    }
  };

  const handleSelectExample = (ex: ExampleItem) => {
    const text = ex.text[activeLang] || ex.text.en;
    setInputText(text);
    handleTranslate(text);
  };

  const handleClear = () => {
    setInputText('');
    setStatus('idle');
    setTranslatedClips([]);
    setUnsupportedTokens([]);
    inputRef.current?.focus();
  };

  const handleAddToConversation = async () => {
    if (!lastSubmittedText || translatedClips.length === 0) return;
    if (onAddToConversation) {
      await onAddToConversation(
        lastSubmittedText,
        translatedClips.map((c) => c.gloss)
      );
      setIsAddedToConv(true);
    }
  };

  return (
    <div data-testid="text-to-sign-panel" className={`flex flex-col space-y-2.5 ${className}`}>
      {/* Header matching Sign → Text visual hierarchy */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-app-border pb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-xl shrink-0" aria-hidden="true">
            🗣️
          </span>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-app-text">
              Text → Sign
            </h3>
          </div>
        </div>
        {status === 'supported' && translatedClips.length > 0 && onAddToConversation && (
          <div className="shrink-0 w-full sm:w-auto flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddToConversation}
              disabled={isAddedToConv}
              iconStart={
                isAddedToConv ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-app-success" />
                ) : (
                  <MessageSquarePlus className="w-3.5 h-3.5 text-app-primary-strong" />
                )
              }
            >
              {isAddedToConv
                ? t('textToSign.addedToConversation', 'Added to conversation')
                : t('textToSign.addToConversation', 'Add to conversation')}
            </Button>
          </div>
        )}
      </div>

      {/* Text Input & Translate Action */}
      <div className="space-y-1.5">
        <label htmlFor="text-to-sign-input" className="sr-only">
          {t('textToSign.title', 'Text to Sign')}
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              id="text-to-sign-input"
              ref={inputRef}
              type="text"
              dir="auto"
              autoFocus={autoFocus}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleTranslate();
                }
              }}
              placeholder={t(
                'textToSign.inputPlaceholder',
                'Enter a word or phrase… (e.g. Hello, Thank you, I have a headache)'
              )}
              className="w-full h-10 px-3.5 pe-9 rounded-control border border-app-border-strong bg-app-surface text-app-text text-sm sm:text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary-strong transition-all"
            />
            {inputText && (
              <button
                type="button"
                onClick={handleClear}
                aria-label={t('textToSign.clearInput', 'Clear input')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-app-muted hover:text-app-text p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary-strong"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={!inputText.trim() || status === 'loading'}
            onClick={() => handleTranslate()}
            iconStart={
              status === 'loading' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )
            }
            className="shrink-0 h-10 font-semibold"
          >
            {status === 'loading'
              ? t('textToSign.translating', 'Translating…')
              : t('textToSign.translateButton', 'Translate')}
          </Button>
        </div>
      </div>

      {/* Central Dedicated Visual Display Box */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-app-muted">
            {t('textToSign.title', 'Sign Display Box')}
          </span>
        </div>

        {/* Display Box States */}
        {status === 'idle' && (
          <div
            role="region"
            aria-label="Zone d'affichage du signe LSA"
            className={`w-full aspect-video rounded-card bg-neutral-900 border border-app-border-strong flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 text-center text-white space-y-3.5 ${
              prominentMode ? 'min-h-[240px] sm:min-h-[340px] md:min-h-[420px]' : 'min-h-[200px] sm:min-h-[260px] md:min-h-[300px]'
            }`}
          >
            <div className="w-14 h-14 rounded-full bg-app-primary-strong/20 border border-app-primary-strong/40 flex items-center justify-center text-app-primary-strong shadow-lg">
              <span className="text-3xl select-none" role="img" aria-hidden="true">
                🤟
              </span>
            </div>
            <div className="space-y-1.5 max-w-md">
              <h3 className="font-bold text-base sm:text-lg text-white">
                {t('textToSign.emptyStateTitle', 'Ready to translate')}
              </h3>
              <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
                {t(
                  'textToSign.emptyStateMessage',
                  'Enter a phrase above or select an example below to view its Algerian Sign Language sign.'
                )}
              </p>
            </div>
          </div>
        )}

        {status === 'loading' && (
          <div
            role="status"
            aria-live="polite"
            className={`w-full aspect-video rounded-card bg-neutral-900 border border-app-border-strong flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 text-center text-white space-y-3 ${
              prominentMode ? 'min-h-[240px] sm:min-h-[340px] md:min-h-[420px]' : 'min-h-[200px] sm:min-h-[260px] md:min-h-[300px]'
            }`}
          >
            <Loader2 className="w-10 h-10 animate-spin text-app-primary-strong" />
            <p className="text-xs sm:text-sm font-medium text-neutral-300">
              {t('textToSign.loadingState', 'Translating phrase and loading LSA assets…')}
            </p>
          </div>
        )}

        {status === 'supported' && translatedClips.length > 0 && (
          <SignPlayer clips={translatedClips} autoPlay />
        )}

        {status === 'unsupported' && (
          <div
            role="region"
            aria-label="Phrase non supportée"
            className={`w-full aspect-video rounded-card bg-neutral-900 border border-amber-500/40 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 text-center text-white space-y-3.5 ${
              prominentMode ? 'min-h-[240px] sm:min-h-[340px] md:min-h-[420px]' : 'min-h-[200px] sm:min-h-[260px] md:min-h-[300px]'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <SearchX className="w-6 h-6" />
            </div>

            <div className="space-y-1 max-w-md">
              <span className="px-2.5 py-0.5 rounded-pill bg-amber-500/20 text-amber-300 text-xs font-semibold border border-amber-500/30">
                {t('textToSign.unsupportedTitle', 'LSA sign not currently available')}
              </span>
              <h4 className="text-sm sm:text-base font-bold text-white pt-1">
                "{lastSubmittedText}"
              </h4>
              <p className="text-xs text-neutral-300 leading-relaxed pt-1">
                {t(
                  'textToSign.unsupportedMessage',
                  "This phrase is outside ConnectSign's current LSA vocabulary. We only display verified signs rather than guessing or displaying inaccurate gestures."
                )}
              </p>
            </div>

            {unsupportedTokens.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                <span className="text-[11px] text-neutral-400">
                  {t('textToSign.unsupportedTokens', 'Unrecognized words:')}
                </span>
                {unsupportedTokens.map((tok, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded bg-black/50 border border-white/10 font-mono text-[11px] text-amber-300"
                  >
                    {tok}
                  </span>
                ))}
              </div>
            )}

            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
                <span className="text-[11px] text-neutral-400">
                  {t('composer.quickSuggestions', 'Suggestions rapides')} :
                </span>
                {suggestions.map((sugId, i) => {
                  const phrase = SEED_PHRASES.find((p) => p.id === sugId);
                  const label = phrase ? (phrase.text[activeLang] || phrase.text.fr) : sugId;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setInputText(label);
                        handleTranslate(label);
                      }}
                      className="px-2 py-0.5 rounded bg-black/40 hover:bg-black/60 border border-white/10 hover:border-app-primary-strong text-[11px] text-app-primary-soft-2 font-medium transition-colors"
                      title={t('composer.suggestions', 'Traduire cette suggestion')}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {status === 'error' && (
          <div
            role="alert"
            className={`w-full aspect-video rounded-card bg-neutral-900 border border-red-500/40 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8 text-center text-white space-y-3 ${
              prominentMode ? 'min-h-[240px] sm:min-h-[340px] md:min-h-[420px]' : 'min-h-[200px] sm:min-h-[260px] md:min-h-[300px]'
            }`}
          >
            <AlertCircle className="w-10 h-10 text-app-error" />
            <p className="text-sm font-semibold text-white">
              {t('textToSign.playbackError', 'Unable to load video recording for this sign.')}
            </p>
            <Button variant="secondary" size="sm" onClick={() => handleTranslate()}>
              {t('textToSign.tryAgain', 'Try again')}
            </Button>
          </div>
        )}
      </div>

      {/* "Try an example" Section */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-app-primary-strong" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-app-text">
            {t('textToSign.tryExampleTitle', 'Try an example')}
          </h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {EXAMPLES.map((ex) => {
            const localized = ex.text[activeLang] || ex.text.en;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => handleSelectExample(ex)}
                className="p-3 rounded-control bg-app-surface border border-app-border hover:border-app-primary-strong hover:bg-app-surface-2 transition-all flex flex-col items-start gap-1.5 text-start shadow-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary-strong group"
              >
                <div className="w-full flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-app-text group-hover:text-app-primary-strong transition-colors truncate">
                    {localized}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 uppercase tracking-wider ${
                      ex.isSupported
                        ? 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30'
                        : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                    }`}
                  >
                    {ex.isSupported
                      ? t('textToSign.supportedBadge', 'Supported')
                      : t('textToSign.plannedBadge', 'Planned')}
                  </span>
                </div>

                {ex.gloss && (
                  <div className="flex items-center gap-1 text-[11px] font-mono text-app-muted">
                    <Layers className="w-3 h-3 text-app-muted" />
                    <span>{ex.gloss.join(' → ')}</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
