import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { WorkspacePage } from '@/features/workspace/WorkspacePage';
import { AppShell } from '@/app/AppShell';
import { TextToSignPanel } from '@/components/domain/TextToSignPanel';
import { CameraPanel } from '@/components/domain/CameraPanel';
import { useSettingsStore } from '@/stores/settingsStore';
import { sessionRepository } from '@/services/session-repository';
import { registry } from '@/services/registry';
import '@/i18n';

describe('ConnectSign Translation Flow Stability & Mobile Accessibility', () => {
  beforeEach(async () => {
    await sessionRepository.clearAll();
    useSettingsStore.setState({
      settings: {
        ...useSettingsStore.getState().settings,
        defaultSpokenLang: 'fr',
        lastMode: 'two_way',
      },
    });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles successful Text-to-Sign translation request and renders sign output', async () => {
    render(<TextToSignPanel currentLang="fr" />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Bonjour.' } });

    const translateBtn = screen.getByRole('button', { name: /Traduire|Translate/i });
    fireEvent.click(translateBtn);

    await waitFor(() => {
      expect(screen.getByText('HELLO')).toBeInTheDocument();
    });
  });

  it('handles failed Text-to-Sign request and allows user to retry without reloading', async () => {
    const originalSentenceToGloss = registry.textToSign.sentenceToGloss;
    let failOnce = true;
    registry.textToSign.sentenceToGloss = vi.fn().mockImplementation(async (text, lang) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('Service network error');
      }
      return originalSentenceToGloss.call(registry.textToSign, text, lang);
    });

    render(<TextToSignPanel currentLang="fr" />);

    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Bonjour.' } });

    const translateBtn = screen.getByRole('button', { name: /Traduire|Translate/i });
    fireEvent.click(translateBtn);

    // Error state rendered
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Réessayer|Try again/i })).toBeInTheDocument();
    });

    // Retry without page reload
    const retryBtn = screen.getByRole('button', { name: /Réessayer|Try again/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('HELLO')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).toBeNull();
    });

    registry.textToSign.sentenceToGloss = originalSentenceToGloss;
  });

  it('prevents stale prediction results when input changes rapidly', async () => {
    const originalSentenceToGloss = registry.textToSign.sentenceToGloss;
    registry.textToSign.sentenceToGloss = vi.fn().mockImplementation(async (text) => {
      if (text.includes('Slow')) {
        await new Promise((r) => setTimeout(r, 150));
        return { gloss: ['SLOW_SIGN'], unsupportedTokens: [], suggestions: [] };
      }
      return { gloss: ['FAST_SIGN'], unsupportedTokens: [], suggestions: [] };
    });

    render(<TextToSignPanel currentLang="fr" />);

    // Trigger slow request first via Enter key, then immediately fast request via Enter key
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Slow phrase' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    fireEvent.change(input, { target: { value: 'Fast phrase' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('FAST_SIGN')).toBeInTheDocument();
    });

    // Wait for the slow timer to expire and verify it doesn't overwrite FAST_SIGN
    await new Promise((r) => setTimeout(r, 200));
    expect(screen.getByText('FAST_SIGN')).toBeInTheDocument();
    expect(screen.queryByText('SLOW_SIGN')).toBeNull();

    registry.textToSign.sentenceToGloss = originalSentenceToGloss;
  });

  it('renders CameraPanel error state on permission denial and recovers on retry', async () => {
    const handleRetry = vi.fn();
    const videoRef = { current: document.createElement('video') };

    const { rerender } = render(
      <CameraPanel
        videoRef={videoRef}
        cameraStatus="error"
        errorCode="CAM-001"
        onStartCamera={handleRetry}
        mirror={false}
        onToggleMirror={() => {}}
        showTracking={false}
        onToggleTracking={() => {}}
      />
    );

    // Verify error state
    expect(screen.getByText(/CAM-001/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Réessayer|Retry/i });
    expect(retryBtn).toBeInTheDocument();

    fireEvent.click(retryBtn);
    expect(handleRetry).toHaveBeenCalledTimes(1);

    // Rerender as ready
    rerender(
      <CameraPanel
        videoRef={videoRef}
        cameraStatus="ready"
        errorCode={null}
        onStartCamera={handleRetry}
        mirror={false}
        onToggleMirror={() => {}}
        showTracking={false}
        onToggleTracking={() => {}}
      />
    );

    expect(screen.queryByText(/CAM-001/i)).toBeNull();
  });

  it('provides accessible mode switcher in workspace header for mobile and desktop', async () => {
    const session = await sessionRepository.create({
      title: 'Responsive Workspace',
      context: 'healthcare',
      signLanguage: 'LSA',
      spokenLang: 'fr',
      mode: 'two_way',
      status: 'active',
      aiMode: 'demo',
      privacy: 'local',
    });

    render(
      <MemoryRouter initialEntries={[`/app/workspace/${session.id}`]}>
        <Routes>
          <Route path="/app/workspace/:sessionId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('workspace-mode-select')).toBeInTheDocument();
    });

    const modeSelect = screen.getByTestId('workspace-mode-select') as HTMLSelectElement;
    expect(modeSelect.value).toBe('two_way');

    // Switch mode to language_to_sign
    fireEvent.change(modeSelect, { target: { value: 'language_to_sign' } });

    await waitFor(() => {
      expect(screen.getByTestId('language-to-sign-view')).toBeInTheDocument();
      expect(screen.queryByTestId('two-way-view')).toBeNull();
    });

    // Switch mode to sign_to_language
    fireEvent.change(modeSelect, { target: { value: 'sign_to_language' } });

    await waitFor(() => {
      expect(screen.getByTestId('sign-to-language-view')).toBeInTheDocument();
      expect(screen.queryByTestId('two-way-view')).toBeNull();
    });
  });

  it('exposes direct navigation to both translation modes in mobile menu sheet', async () => {
    render(
      <MemoryRouter initialEntries={['/app']}>
        <Routes>
          <Route path="/app" element={<AppShell />} />
          <Route path="/app/sign-to-language" element={<div data-testid="sign-to-lang-target" />} />
          <Route path="/app/language-to-sign" element={<div data-testid="lang-to-sign-target" />} />
        </Routes>
      </MemoryRouter>
    );

    // Open mobile more sheet
    const menuBtn = screen.getByRole('button', { name: /Menu/i });
    fireEvent.click(menuBtn);

    // Verify both mode buttons exist in sheet
    await waitFor(() => {
      expect(screen.getByTestId('mobile-sign-to-lang-btn')).toBeInTheDocument();
      expect(screen.getByTestId('mobile-lang-to-sign-btn')).toBeInTheDocument();
    });

    const signBtn = screen.getByTestId('mobile-sign-to-lang-btn');
    fireEvent.click(signBtn);

    await waitFor(() => {
      expect(screen.getByTestId('sign-to-lang-target')).toBeInTheDocument();
    });
  });

  it('verifies top navigation header layout constraints preventing control overlap', async () => {
    const session = await sessionRepository.create({
      title: 'Layout Constraints Session',
      context: 'healthcare',
      signLanguage: 'LSA',
      spokenLang: 'fr',
      mode: 'two_way',
      status: 'active',
      aiMode: 'demo',
      privacy: 'local',
    });

    render(
      <MemoryRouter initialEntries={[`/app/workspace/${session.id}`]}>
        <Routes>
          <Route path="/app/workspace/:sessionId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('workspace-mode-select')).toBeInTheDocument();
    });

    const modeSelect = screen.getByTestId('workspace-mode-select') as HTMLSelectElement;
    // Check that select has truncate and min-w-0
    expect(modeSelect.className).toContain('truncate');
    expect(modeSelect.className).toContain('min-w-0');

    // Check that mode select container has shrink and max-w constraints
    const modeSelectContainer = modeSelect.parentElement;
    expect(modeSelectContainer?.className).toContain('min-w-0');
    expect(modeSelectContainer?.className).toContain('shrink');
    expect(modeSelectContainer?.className).toContain('max-w-');

    // Action buttons remain visible and in document
    expect(screen.getByTestId('end-session-header-btn')).toBeInTheDocument();
  });

  it('ensures Sign to Text status tags and camera warning occupy non-conflicting layout areas', async () => {
    const session = await sessionRepository.create({
      title: 'Sign Status Test',
      context: 'healthcare',
      signLanguage: 'LSA',
      spokenLang: 'fr',
      mode: 'sign_to_language',
      status: 'active',
      aiMode: 'demo',
      privacy: 'local',
    });

    render(
      <MemoryRouter initialEntries={[`/app/workspace/${session.id}`]}>
        <Routes>
          <Route path="/app/workspace/:sessionId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('sign-recognition-panel')).toBeInTheDocument();
    });

    // Check that camera status warning and disclaimer exist in distinct containers
    const cameraWarning = screen.getByRole('status');
    expect(cameraWarning).toBeInTheDocument();

    const disclaimer = screen.getByText(/Prototype de recherche|Research Prototype/i);
    expect(disclaimer).toBeInTheDocument();

    // Verify disclaimer parent container has wrapping rules and does not collide
    expect(disclaimer.className).toContain('break-words');
  });
});
