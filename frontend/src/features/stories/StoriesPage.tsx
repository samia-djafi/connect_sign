import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { STORIES } from '@/data/stories';
import { downloadFile } from '@/lib/download';
import {
  HeartHandshake,
  ShieldCheck,
  MapPin,
  MessageSquare,
  Sparkles,
  Trash2,
  Info,
  ChevronDown,
  ChevronUp,
  Download,
  AlertCircle,
  FileText,
  CheckCircle2,
  Loader2,
  Send,
} from 'lucide-react';

interface LocalFeedbackEntry {
  id: string;
  authorName: string;
  authorRole: 'deaf' | 'family' | 'healthcare' | 'other' | 'supporter';
  message: string;
  contact?: string;
  createdAt: number;
}

const LOCAL_FEEDBACK_KEY = 'connectsign-local-feedback';
const LEGACY_LOCAL_FEEDBACK_KEY = 'cs-legacy-local-feedback';

// Google Form constants
export const GOOGLE_FORM_VIEW_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeMpIBUVY6hPLnryGdDBlT1ocNUVaYx4-Ss59wRw9qDZGJo-g/viewform';
export const GOOGLE_FORM_SHORT_URL = 'https://forms.gle/ecHfLfLVqgFRW8Bw9';
export const GOOGLE_FORM_RESPONSE_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSeMpIBUVY6hPLnryGdDBlT1ocNUVaYx4-Ss59wRw9qDZGJo-g/formResponse';

export const FORM_ENTRY_IDS = {
  name: 'entry.380116650',
  profile: 'entry.1143297058',
  feedback: 'entry.1482854505',
  contact: 'entry.1478387733',
} as const;

export const PROFILE_FORM_VALUES: Record<'deaf' | 'family' | 'healthcare' | 'other', string> = {
  deaf: 'Deaf or hard of hearing person',
  family: 'Family member or friend',
  healthcare: 'Healthcare professional',
  other: 'Someone else',
};

export interface FeedbackSubmissionData {
  name?: string;
  profile: 'deaf' | 'family' | 'healthcare' | 'other';
  feedback: string;
  contact?: string;
}

export async function submitFeedbackDirectly(
  data: FeedbackSubmissionData
): Promise<{ success: boolean }> {
  const trimmedFeedback = data.feedback ? data.feedback.trim() : '';
  if (!trimmedFeedback) {
    throw new Error('FEEDBACK_EMPTY');
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('NETWORK_OFFLINE');
  }

  const formProfileValue = PROFILE_FORM_VALUES[data.profile] || 'Someone else';

  const formData = new URLSearchParams();
  if (data.name && data.name.trim()) {
    formData.append(FORM_ENTRY_IDS.name, data.name.trim());
  }
  formData.append(FORM_ENTRY_IDS.profile, formProfileValue);
  formData.append(FORM_ENTRY_IDS.feedback, trimmedFeedback);
  if (data.contact && data.contact.trim()) {
    formData.append(FORM_ENTRY_IDS.contact, data.contact.trim());
  }
  formData.append('fvv', '1');
  formData.append('pageHistory', '0');

  // Submit in the background directly without opening Google Forms or redirecting the user
  await fetch(GOOGLE_FORM_RESPONSE_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  return { success: true };
}

export function buildGoogleFormsUrl(data: {
  name?: string;
  profile: 'deaf' | 'family' | 'healthcare' | 'other';
  feedback: string;
  contact?: string;
}): string {
  try {
    const params = new URLSearchParams();
    params.append('usp', 'pp_url');

    if (data.name && data.name.trim()) {
      params.append(FORM_ENTRY_IDS.name, data.name.trim());
    }

    const formProfileValue = PROFILE_FORM_VALUES[data.profile] || 'Someone else';
    params.append(FORM_ENTRY_IDS.profile, formProfileValue);

    if (data.feedback && data.feedback.trim()) {
      params.append(FORM_ENTRY_IDS.feedback, data.feedback.trim());
    }

    if (data.contact && data.contact.trim()) {
      params.append(FORM_ENTRY_IDS.contact, data.contact.trim());
    }

    return `${GOOGLE_FORM_VIEW_URL}?${params.toString()}`;
  } catch {
    return GOOGLE_FORM_SHORT_URL;
  }
}

export const StoriesPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const currentLang = (['en', 'fr', 'ar'].includes(i18n.language) ? i18n.language : 'en') as
    | 'en'
    | 'fr'
    | 'ar';

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [modalState, setModalState] = useState<'form' | 'success'>('form');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  // Form Fields
  const [authorName, setAuthorName] = useState('');
  const [authorRole, setAuthorRole] = useState<'deaf' | 'family' | 'healthcare' | 'other'>('deaf');
  const [authorMessage, setAuthorMessage] = useState('');
  const [authorContact, setAuthorContact] = useState('');

  // Previous local notes (preserved from earlier versions)
  const [savedFeedbacks, setSavedFeedbacks] = useState<LocalFeedbackEntry[]>([]);
  const [showPreviousNotes, setShowPreviousNotes] = useState(false);

  useEffect(() => {
    document.title = `${t('nav.realStories', 'Real Stories')} | ${t('app.name', 'ConnectSign')}`;
    loadLocalFeedback();
  }, [t]);

  const loadLocalFeedback = () => {
    try {
      let raw = localStorage.getItem(LOCAL_FEEDBACK_KEY);
      if (!raw) {
        const legacyRaw = localStorage.getItem(LEGACY_LOCAL_FEEDBACK_KEY);
        if (legacyRaw) {
          raw = legacyRaw;
          try {
            localStorage.setItem(LOCAL_FEEDBACK_KEY, legacyRaw);
            localStorage.removeItem(LEGACY_LOCAL_FEEDBACK_KEY);
          } catch {
            // ignore
          }
        }
      }
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setSavedFeedbacks(parsed);
        }
      }
    } catch {
      // ignore storage errors
    }
  };

  const handleDeleteFeedback = (id: string) => {
    try {
      const updated = savedFeedbacks.filter((item) => item.id !== id);
      localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(updated));
      setSavedFeedbacks(updated);
    } catch {
      // ignore
    }
  };

  const handleExportPreviousNotes = () => {
    if (savedFeedbacks.length === 0) return;
    const content = JSON.stringify(savedFeedbacks, null, 2);
    downloadFile(
      `connectsign_saved_notes_${new Date().toISOString().slice(0, 10)}.json`,
      content,
      'application/json'
    );
  };

  const handleSendFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedMessage = authorMessage.trim();

    if (!trimmedMessage) {
      setValidationError(
        t('stories.feedbackRequiredError', 'Please enter your suggestion or feedback before sending.')
      );
      return;
    }

    setValidationError(null);
    setSubmissionError(null);
    setIsSubmitting(true);

    try {
      await submitFeedbackDirectly({
        name: authorName,
        profile: authorRole,
        feedback: trimmedMessage,
        contact: authorContact,
      });

      // Archive a local record for user reference
      const newEntry: LocalFeedbackEntry = {
        id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        authorName: authorName.trim() || t('stories.profileDeaf', 'Anonymous'),
        authorRole,
        message: trimmedMessage,
        contact: authorContact.trim() || undefined,
        createdAt: Date.now(),
      };
      const updatedList = [newEntry, ...savedFeedbacks];
      setSavedFeedbacks(updatedList);
      try {
        localStorage.setItem(LOCAL_FEEDBACK_KEY, JSON.stringify(updatedList));
      } catch {
        // ignore storage quota errors
      }

      // Reset form fields
      setAuthorName('');
      setAuthorMessage('');
      setAuthorContact('');
      setModalState('success');
    } catch (err: any) {
      console.error('[Feedback] Submission error:', err);
      if (err?.message === 'NETWORK_OFFLINE') {
        setSubmissionError(
          t(
            'stories.feedbackOfflineError',
            'You appear to be offline. Please check your internet connection and try again.'
          )
        );
      } else {
        setSubmissionError(
          t(
            'stories.feedbackErrorDesc',
            'Submission could not be completed. Please check your internet connection and try again.'
          )
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenModal = () => {
    setValidationError(null);
    setSubmissionError(null);
    setIsSubmitting(false);
    setModalState('form');
    setShareModalOpen(true);
  };

  return (
    <div className="flex flex-col min-h-full bg-app-bg text-app-text">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* Header Hero */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-app-border">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-control bg-app-primary-soft text-app-primary-strong flex items-center justify-center shrink-0">
                <HeartHandshake className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-extrabold text-app-text">
                {t('stories.title', 'Témoignages')}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-app-muted max-w-2xl leading-relaxed">
              {t(
                'stories.subtitle',
                'Retours d’expérience réels et récits partagés par notre communauté sourde, les familles et les soignants en Algérie.'
              )}
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            iconStart={<MessageSquare className="w-4 h-4" />}
            onClick={handleOpenModal}
            className="shrink-0"
          >
            {t('stories.shareCta', 'Send feedback')}
          </Button>
        </div>

        {/* Transparency Banner: Honest authentic feedback disclosure */}
        <div
          role="region"
          aria-label={t('stories.transparencyBannerTitle', 'Engagement de transparence & d’authenticité')}
          className="p-4 rounded-card bg-app-surface border border-app-border-strong flex items-start gap-3 shadow-1 text-xs text-app-muted leading-relaxed"
        >
          <ShieldCheck className="w-5 h-5 text-app-primary-strong shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-app-text block">
              {t('stories.transparencyBannerTitle', 'Engagement de transparence & d’authenticité')}
            </span>
            <p>
              {t(
                'stories.transparencyNotice',
                'Ces témoignages représentent des retours réels recueillis auprès de personnes sourdes, de leurs proches et de professionnels de santé en Algérie.'
              )}
            </p>
          </div>
        </div>

        {/* Stories Grid: Responsive Layout (1 col mobile, 2 col tablet, 3 col desktop) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {STORIES.map((story) => {
            const badgeClass =
              story.badge === 'healthcare'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : story.badge === 'family'
                ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300'
                : 'bg-app-primary-soft text-app-primary-strong';

            const badgeLabel =
              story.badge === 'healthcare'
                ? t('stories.healthcarePartner', 'Professionnel de santé')
                : story.badge === 'family'
                ? t('stories.familyCaregiver', 'Proche & Famille')
                : t('stories.verifiedCommunity', 'Communauté sourde');

            return (
              <Card
                key={story.id}
                p={20}
                className="flex flex-col justify-between gap-4 bg-app-surface border border-app-border hover:border-app-border-strong transition-all shadow-1"
              >
                <div className="space-y-3">
                  {/* Category Pill & City Badge */}
                  <div className="flex items-center justify-between text-[11px] gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill font-semibold ${badgeClass}`}
                    >
                      {badgeLabel}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-app-muted font-medium">
                      <MapPin className="w-3.5 h-3.5 text-app-primary-strong shrink-0" />
                      <bdi>{story.location}</bdi>
                    </span>
                  </div>

                  {/* Testimonial Title */}
                  <h3 className="font-bold text-sm sm:text-base text-app-text text-start">
                    {story.title[currentLang] || story.title.en}
                  </h3>

                  {/* Situation with quote styling */}
                  <div className="relative pt-1">
                    <p className="text-xs sm:text-sm text-app-text leading-relaxed italic relative z-10 ps-3 text-start">
                      {story.quote[currentLang] || story.quote.en}
                    </p>
                  </div>
                </div>

                {/* Role and City Footer */}
                <div className="pt-3 border-t border-app-border flex items-center justify-between text-xs gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-app-text block truncate">
                      {story.role[currentLang] || story.role.en}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-app-muted shrink-0">
                    <MapPin className="w-3.5 h-3.5 text-app-primary-strong shrink-0" />
                    <bdi>{story.location}</bdi>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Bottom Callout: Field Trials Participation */}
        <div className="p-5 rounded-card bg-app-surface-2 border border-app-border flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-center sm:text-start">
            <h3 className="text-sm font-bold text-app-text flex items-center gap-2 justify-center sm:justify-start">
              <Sparkles className="w-4 h-4 text-app-primary-strong" />
              <span>{t('stories.fieldTrialTitle', 'Vous souhaitez tester ConnectSign sur le terrain ?')}</span>
            </h3>
            <p className="text-xs text-app-muted max-w-xl">
              {t(
                'stories.fieldTrialDesc',
                'Participez à nos essais pour adapter le vocabulaire médical et quotidien de la LSA aux besoins concrets des échanges en santé en Algérie.'
              )}
            </p>
          </div>
          <Button
            variant="secondary"
            size="md"
            onClick={handleOpenModal}
            className="shrink-0"
          >
            {t('stories.fieldTrialBtn', 'Send feedback')}
          </Button>
        </div>
      </div>

      {/* Google Forms Feedback Modal */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title={t('stories.feedbackTitle', 'Feedback & Suggestions')}
        maxWidth="md"
      >
        <div className="space-y-4">
          {modalState === 'form' ? (
            <>
              {/* Direct Background Submission Information Banner */}
              <div className="p-3.5 rounded-control bg-app-surface-2 border border-app-border flex items-start gap-2.5 text-xs text-app-muted leading-relaxed">
                <Info className="w-4 h-4 text-app-primary-strong shrink-0 mt-0.5" />
                <p className="font-medium text-app-text">
                  {t(
                    'stories.directSubmissionNotice',
                    'Your feedback is submitted directly to our team in the background.'
                  )}
                </p>
              </div>

              {/* Feedback Form */}
              <form onSubmit={handleSendFeedback} className="space-y-4 text-xs sm:text-sm">
                {validationError && (
                  <div
                    role="alert"
                    className="p-3 rounded-control bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-app-error text-xs flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                {submissionError && (
                  <div
                    role="alert"
                    className="p-3 rounded-control bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-app-error text-xs flex items-center gap-2"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{submissionError}</span>
                  </div>
                )}

                {/* 1. Name or Reference (Optional) */}
                <div className="space-y-1.5">
                  <label htmlFor="feedback-author-name" className="block text-xs font-semibold text-app-text">
                    {t('stories.authorNameLabel', 'Name or reference (optional)')}
                  </label>
                  <input
                    id="feedback-author-name"
                    type="text"
                    disabled={isSubmitting}
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder={t('stories.authorNamePlaceholder', 'e.g. El-Biar Pharmacy, Yasmine B.')}
                    className="w-full h-10 px-3 rounded-control border border-app-border bg-app-surface text-app-text text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary-strong disabled:opacity-50"
                  />
                </div>

                {/* 2. Your Profile (4 Options matching Google Form) */}
                <div className="space-y-1.5">
                  <label htmlFor="feedback-author-role" className="block text-xs font-semibold text-app-text">
                    {t('stories.yourProfileLabel', 'Your profile')}
                  </label>
                  <select
                    id="feedback-author-role"
                    disabled={isSubmitting}
                    value={authorRole}
                    onChange={(e) =>
                      setAuthorRole(e.target.value as 'deaf' | 'family' | 'healthcare' | 'other')
                    }
                    className="w-full h-10 px-3 rounded-control border border-app-border bg-app-surface text-app-text text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary-strong disabled:opacity-50"
                  >
                    <option value="deaf">
                      {t('stories.profileDeaf', 'Deaf or hard of hearing person')}
                    </option>
                    <option value="family">
                      {t('stories.profileFamily', 'Family member or friend')}
                    </option>
                    <option value="healthcare">
                      {t('stories.profileHealthcare', 'Healthcare professional')}
                    </option>
                    <option value="other">
                      {t('stories.profileOther', 'Someone else')}
                    </option>
                  </select>
                </div>

                {/* 3. Suggestion / Feedback (Required) */}
                <div className="space-y-1.5">
                  <label htmlFor="feedback-author-message" className="block text-xs font-semibold text-app-text">
                    {t('stories.suggestionLabel', 'Your suggestion or experience feedback *')}
                  </label>
                  <textarea
                    id="feedback-author-message"
                    required
                    disabled={isSubmitting}
                    rows={4}
                    value={authorMessage}
                    onChange={(e) => {
                      setAuthorMessage(e.target.value);
                      if (validationError) setValidationError(null);
                      if (submissionError) setSubmissionError(null);
                    }}
                    placeholder={t(
                      'stories.suggestionPlaceholder',
                      'What worked, what was difficult, which signs are missing, or what should we improve?…'
                    )}
                    className="w-full p-3 rounded-control border border-app-border bg-app-surface text-app-text text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary-strong resize-none disabled:opacity-50"
                  />
                </div>

                {/* 4. Contact Information (Optional) */}
                <div className="space-y-1.5">
                  <label htmlFor="feedback-author-contact" className="block text-xs font-semibold text-app-text">
                    {t('stories.contactLabel', 'Can we contact you about your feedback? (Optional)')}
                  </label>
                  <input
                    id="feedback-author-contact"
                    type="text"
                    disabled={isSubmitting}
                    value={authorContact}
                    onChange={(e) => setAuthorContact(e.target.value)}
                    placeholder={t(
                      'stories.contactPlaceholder',
                      'Email or another contact method. Leave blank if you prefer to remain anonymous.'
                    )}
                    className="w-full h-10 px-3 rounded-control border border-app-border bg-app-surface text-app-text text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary-strong disabled:opacity-50"
                  />
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex items-center justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShareModalOpen(false)}
                  >
                    {t('common.cancel', 'Cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    disabled={isSubmitting}
                    iconStart={
                      isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {isSubmitting
                      ? t('stories.submittingFeedback', 'Sending feedback...')
                      : t('stories.sendFeedbackBtn', 'Send feedback')}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            /* Success State: Confirmed programmatic background submission */
            <div className="p-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30 shadow-1">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h3 className="font-extrabold text-base sm:text-lg text-app-text">
                  {t('stories.feedbackSuccessTitle', 'Thank you for your feedback!')}
                </h3>
                <p className="text-xs sm:text-sm text-app-muted max-w-md mx-auto leading-relaxed">
                  {t(
                    'stories.feedbackSuccessDesc',
                    'Your feedback has been received and directly submitted to the ConnectSign team.'
                  )}
                </p>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setValidationError(null);
                    setSubmissionError(null);
                    setModalState('form');
                  }}
                >
                  {t('stories.sendAnotherFeedback', 'Send another feedback')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShareModalOpen(false)}
                >
                  {t('common.close', 'Close')}
                </Button>
              </div>
            </div>
          )}

          {/* Preserved Local Notes Recovery Section (Shown only if user had notes from previous version) */}
          {savedFeedbacks.length > 0 && (
            <div className="pt-3 border-t border-app-border space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPreviousNotes(!showPreviousNotes)}
                  className="text-xs font-semibold text-app-muted hover:text-app-text flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5 text-app-primary-strong" />
                  <span>
                    {t('stories.previousNotesTitle', {
                      count: savedFeedbacks.length,
                      defaultValue: `Previous local notes (${savedFeedbacks.length})`,
                    })}
                  </span>
                  {showPreviousNotes ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleExportPreviousNotes}
                  className="text-xs text-app-primary-strong hover:underline flex items-center gap-1 font-semibold"
                >
                  <Download className="w-3 h-3" />
                  <span>{t('stories.exportLocalNotesBtn', 'Export previous notes')}</span>
                </button>
              </div>

              {showPreviousNotes && (
                <div className="max-h-56 overflow-y-auto space-y-2 pe-1 pt-1">
                  {savedFeedbacks.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-control bg-app-surface-2 border border-app-border text-xs space-y-1 relative group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-app-text">{item.authorName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-app-muted font-mono">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFeedback(item.id);
                            }}
                            className="text-app-muted hover:text-app-error p-1 rounded transition-colors"
                            aria-label={t('stories.deleteNoteAria', 'Delete this note')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-app-text whitespace-pre-wrap">{item.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
