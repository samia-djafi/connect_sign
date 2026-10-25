import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSessionStore } from '@/stores/sessionStore';
import { useUiStore } from '@/stores/uiStore';
import {
  ArrowLeftRight,
  BookOpen,
  History,
  Activity,
  Settings,
  ShieldCheck,
  Home,
  HeartHandshake,
  MoreHorizontal,
  Siren,
  Info,
} from 'lucide-react';
import { OfflineBanner } from '@/components/domain/OfflineBanner';
import { TopNavBar } from '@/components/domain/TopNavBar';
import { ToastContainer } from '@/components/ui/Toast';
import { EmergencySheet } from '@/components/domain/EmergencySheet';
import { PrivacySheet } from '@/components/domain/PrivacySheet';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';

export const AppShell: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSession, status } = useSessionStore();
  const { setPrivacySheetOpen, setEmergencySheetOpen } = useUiStore();
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  const isWorkspace = location.pathname.startsWith('/app/workspace/');

  const hasActiveSession = currentSession && status === 'active';

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3.5 py-2.5 rounded-control text-sm font-medium transition-colors select-none ${
      isActive
        ? 'bg-app-primary-soft text-app-primary-strong border-s-4 border-app-primary-strong font-semibold shadow-1'
        : 'text-app-text hover:bg-app-surface-2 hover:text-app-primary-strong'
    }`;

  const mobileTabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center justify-center flex-1 min-h-[44px] min-w-[44px] py-1 text-[11px] font-medium transition-colors ${
      isActive ? 'text-app-primary-strong font-bold' : 'text-app-muted hover:text-app-text'
    }`;

  return (
    <div className="flex h-screen w-full bg-app-bg text-app-text overflow-hidden">
      {/* Skip to Main Content Link for Keyboard A11y */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-app-primary-strong focus:text-white focus:rounded-control focus:shadow-3 focus:outline-none focus:ring-2 focus:ring-white"
      >
        {t('app.skipLink', 'Aller au contenu principal')}
      </a>

      {/* Desktop / Tablet Sidebar (hidden on mobile < 768) */}
      <aside
        aria-label={t('nav.mainNavAria', 'Main navigation')}
        className="hidden md:flex flex-col justify-between w-18 lg:w-64 bg-app-surface border-e border-app-border shrink-0 select-none z-20"
      >
        {/* Top: Logo & Nav sections */}
        <div className="flex flex-col p-4 overflow-y-auto">
          {/* Logo & Brand */}
          <NavLink
            to="/app"
            className="flex items-center gap-3 py-2 px-1 rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary-strong mb-6"
          >
            <img
              src="/icons/logo-mark.png"
              alt="ConnectSign Logo"
              className="w-10 h-10 rounded-control shrink-0 shadow-1 object-cover"
            />
            <div className="hidden lg:flex flex-col">
              <span className="font-bold text-base tracking-tight text-app-text">ConnectSign</span>
              <span className="text-[10px] text-app-muted leading-tight truncate">
                {t('app.tagline', 'Every Hand Has a Voice.')}
              </span>
            </div>
          </NavLink>

          {/* Main Navigation in exact requested order */}
          <nav aria-label={t('nav.pagesNavAria', 'Pages navigation')} className="space-y-1 mb-6">
            {/* 1. Home */}
            <NavLink to="/app" end className={navLinkClass}>
              <Home className="w-5 h-5 shrink-0" />
              <span className="hidden lg:inline">{t('nav.dashboard', 'Accueil')}</span>
            </NavLink>

            {/* 2. Conversation */}
            <NavLink
              to={hasActiveSession ? `/app/workspace/${currentSession.id}` : '/app/new?mode=two_way'}
              className={navLinkClass}
            >
              <div className="relative shrink-0">
                <ArrowLeftRight className="w-5 h-5" />
                {hasActiveSession && (
                  <span className="absolute -top-1 -end-1 w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse ring-2 ring-white" />
                )}
              </div>
              <span className="hidden lg:inline">{t('nav.twoWay', 'Conversation')}</span>
            </NavLink>

            {/* Focused translation modes (Desktop sub-links) */}
            <div className="hidden lg:flex flex-col gap-0.5 my-1 ps-3 border-s-2 border-app-border ms-3">
              <NavLink
                to="/app/sign-to-language"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2.5 py-1 rounded-control text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-app-primary-soft text-app-primary-strong font-bold'
                      : 'text-app-muted hover:text-app-text hover:bg-app-surface-2'
                  }`
                }
              >
                <span>🤟</span>
                <span>{t('mode.signToLang', 'LSA → Texte')}</span>
              </NavLink>
              <NavLink
                to="/app/language-to-sign"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-2.5 py-1 rounded-control text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-app-primary-soft text-app-primary-strong font-bold'
                      : 'text-app-muted hover:text-app-text hover:bg-app-surface-2'
                  }`
                }
              >
                <span>🗣️</span>
                <span>{t('mode.langToSign', 'Texte → LSA')}</span>
              </NavLink>
            </div>

            {/* 3. Phrasebook */}
            <NavLink to="/app/phrasebook" className={navLinkClass}>
              <BookOpen className="w-5 h-5 shrink-0" />
              <span className="hidden lg:inline">{t('nav.phrasebook', 'Phrases rapides')}</span>
            </NavLink>

            {/* 4. Real Stories (with subtle New pill) */}
            <NavLink to="/app/stories" className={navLinkClass}>
              <HeartHandshake className="w-5 h-5 shrink-0 text-app-primary-strong" />
              <span className="hidden lg:inline flex-1">{t('nav.realStories', 'Témoignages')}</span>
              <span className="hidden lg:inline-flex text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-pill bg-app-primary-soft text-app-primary-strong border border-app-primary-strong/30">
                {t('badge.new', 'New')}
              </span>
            </NavLink>

            {/* 5. History */}
            <NavLink to="/app/history" className={navLinkClass}>
              <History className="w-5 h-5 shrink-0" />
              <span className="hidden lg:inline">{t('nav.history', 'Historique')}</span>
            </NavLink>

            {/* 6. Diagnostics */}
            <NavLink to="/app/diagnostics" className={navLinkClass}>
              <Activity className="w-5 h-5 shrink-0" />
              <span className="hidden lg:inline">{t('nav.diagnostics', 'Diagnostic IA')}</span>
            </NavLink>

            {/* 7. Settings */}
            <NavLink to="/app/settings" className={navLinkClass}>
              <Settings className="w-5 h-5 shrink-0" />
              <span className="hidden lg:inline">{t('nav.settings', 'Paramètres')}</span>
            </NavLink>
          </nav>
        </div>

        {/* Footer: Emergency Alert + Accessibility / Help Card */}
        <div className="p-3 border-t border-app-border space-y-2.5">
          {/* Emergency Trigger Button in noticeable Red/Orange */}
          <button
            type="button"
            onClick={() => setEmergencySheetOpen(true)}
            className="w-full flex items-center justify-center lg:justify-start gap-2.5 px-3 py-2.5 rounded-control bg-orange-600 hover:bg-orange-700 text-white shadow-1 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
            aria-label={t('emergency.button', 'Phrases d’urgence')}
          >
            <Siren className="w-4 h-4 shrink-0 text-white animate-pulse" />
            <span className="hidden lg:inline">{t('emergency.button', 'Phrases d’urgence')}</span>
          </button>

          {/* Accessibility / Help Support Card */}
          <button
            type="button"
            onClick={() => setPrivacySheetOpen(true)}
            className="w-full flex items-center gap-3 p-2.5 rounded-control bg-app-surface-2 hover:bg-app-border border border-app-border text-start transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-primary-strong"
            aria-label={t('nav.privacyHelp', 'Confidentialité & Aide')}
          >
            <div className="w-7 h-7 rounded-full bg-app-primary-soft text-app-primary-strong flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="hidden lg:flex flex-col min-w-0">
              <span className="text-xs font-bold text-app-text truncate">
                {t('nav.privacyHelp', 'Accessibilité & Aide')}
              </span>
              <span className="text-[10px] text-app-muted truncate">
                {t('nav.localPrivacySubtitle', 'Support & confidentialité locale')}
              </span>
            </div>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Offline notification banner if network dropped */}
        <OfflineBanner />

        {/* Global Standardized Top Bar across website (except specialized full-bleed workspace) */}
        {!isWorkspace && <TopNavBar />}

        {/* Route views rendered inside scrollable main container with safe area inset */}
        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto outline-none pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0"
        >
          <Outlet />
        </main>

        {/* Mobile Bottom Tab Bar (fixed on screen bottom with safe area insets) */}
        <nav
          aria-label={t('nav.mobileNavAria', 'Mobile navigation')}
          className="md:hidden fixed bottom-0 inset-x-0 h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] bg-app-surface border-t border-app-border flex items-center justify-around z-30 px-2 select-none"
        >
          {/* Home */}
          <NavLink to="/app" end className={mobileTabClass}>
            <Home className="w-5 h-5" />
            <span>{t('nav.dashboard', 'Accueil')}</span>
          </NavLink>

          {/* Phrases */}
          <NavLink to="/app/phrasebook" className={mobileTabClass}>
            <BookOpen className="w-5 h-5" />
            <span>{t('nav.phrasebook', 'Phrases')}</span>
          </NavLink>

          {/* Talk (Emphasized Center Action) */}
          <button
            type="button"
            onClick={() => {
              if (hasActiveSession) {
                navigate(`/app/workspace/${currentSession.id}`);
              } else {
                navigate('/app/new');
              }
            }}
            className="flex flex-col items-center justify-center -mt-5 min-w-[44px] min-h-[44px]"
            aria-label={hasActiveSession ? t('dash.resume', 'Reprendre') : t('dash.start', 'Parler')}
          >
            <div className="w-12 h-12 rounded-full bg-app-primary-strong text-white shadow-2 flex items-center justify-center hover:bg-app-primary-hover active:scale-95 transition-all">
              <ArrowLeftRight className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold text-app-primary-strong mt-0.5">
              {hasActiveSession ? t('dash.resume', 'Reprendre') : t('dash.start', 'Parler')}
            </span>
          </button>

          {/* History */}
          <NavLink to="/app/history" className={mobileTabClass}>
            <History className="w-5 h-5" />
            <span>{t('nav.history', 'Historique')}</span>
          </NavLink>

          {/* More Sheet Trigger */}
          <button
            type="button"
            onClick={() => setMobileMoreOpen(true)}
            className="flex flex-col items-center justify-center flex-1 min-h-[44px] min-w-[44px] py-1 text-[11px] font-medium text-app-muted hover:text-app-text"
            aria-label={t('nav.menu', 'Menu')}
          >
            <MoreHorizontal className="w-5 h-5" />
            <span>{t('nav.menu', 'Menu')}</span>
          </button>
        </nav>
      </div>

      {/* Mobile More Sheet */}
      <Sheet
        isOpen={mobileMoreOpen}
        onClose={() => setMobileMoreOpen(false)}
        title={t('nav.menuAndTools', 'Menu & Outils')}
        maxWidth="sm"
      >
        <div className="space-y-3 text-sm">
          {/* Quick Translation Modes on Mobile */}
          <div className="space-y-1.5 pb-2.5 border-b border-app-border">
            <span className="text-[10px] font-bold uppercase tracking-wider text-app-muted px-1 block">
              {t('newConv.modeLabel', 'Modes de traduction')}
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                data-testid="mobile-sign-to-lang-btn"
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => {
                  setMobileMoreOpen(false);
                  navigate('/app/sign-to-language');
                }}
                className="flex items-center justify-center gap-1.5 font-bold text-xs"
              >
                <span>🤟</span>
                <span>{t('mode.signToLang', 'LSA → Texte')}</span>
              </Button>
              <Button
                data-testid="mobile-lang-to-sign-btn"
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => {
                  setMobileMoreOpen(false);
                  navigate('/app/language-to-sign');
                }}
                className="flex items-center justify-center gap-1.5 font-bold text-xs"
              >
                <span>🗣️</span>
                <span>{t('mode.langToSign', 'Texte → LSA')}</span>
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            fullWidth
            iconStart={<Siren className="w-5 h-5 text-app-warning" />}
            onClick={() => {
              setMobileMoreOpen(false);
              setEmergencySheetOpen(true);
            }}
          >
            {t('emergency.title', 'Phrases d’urgence')}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            iconStart={<Activity className="w-5 h-5 text-app-primary-strong" />}
            onClick={() => {
              setMobileMoreOpen(false);
              navigate('/app/diagnostics');
            }}
          >
            {t('nav.diagnostics', 'Diagnostic IA')}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            iconStart={<Settings className="w-5 h-5" />}
            onClick={() => {
              setMobileMoreOpen(false);
              navigate('/app/settings');
            }}
          >
            {t('nav.settings', 'Paramètres')}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            iconStart={<HeartHandshake className="w-5 h-5 text-app-primary-strong" />}
            onClick={() => {
              setMobileMoreOpen(false);
              navigate('/app/stories');
            }}
          >
            {t('nav.realStories', 'Témoignages')}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            iconStart={<Info className="w-5 h-5" />}
            onClick={() => {
              setMobileMoreOpen(false);
              navigate('/app/about');
            }}
          >
            {t('nav.about', 'À propos de ConnectSign')}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            iconStart={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
            onClick={() => {
              setMobileMoreOpen(false);
              setPrivacySheetOpen(true);
            }}
          >
            {t('nav.privacyHelp', 'Confidentialité & Aide')}
          </Button>
        </div>
      </Sheet>

      {/* Global Modals & Sheets */}
      <ToastContainer />
      <EmergencySheet />
      <PrivacySheet />
    </div>
  );
};
