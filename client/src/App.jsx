/**
 * Application shell — navigation, role-aware views, sign-in/out.
 *
 * No view component decides what the user may see. It asks the server who
 * it is and renders what the server returns. The two-tier boundary is
 * enforced server-side; this component is just the render layer.
 */

import { useCallback, useEffect, useState } from 'react';

import CounsellorDashboard from './CounsellorDashboard.jsx';
import CaseDetail from './CaseDetail.jsx';
import AdminDashboard from './AdminDashboard.jsx';
import CheckinChat from './CheckinChat.jsx';
import LoginPage from './LoginPage.jsx';
import { GovernmentHeader, GovernmentFooter, AshokaChakra, IconCase, IconAlert, IconChart, IconChat } from './GovernmentBranding.jsx';
import { I18nProvider, useI18n } from './i18n.jsx';
import { api } from './api.js';

function parseHash(hash) {
  const clean = (hash || window.location.hash || '').replace(/^#\/?/, '').trim();
  if (!clean || clean === 'home' || clean === 'login') return { page: 'home' };
  if (clean === 'checkin') return { page: 'checkin' };
  if (clean === 'counsellor') return { page: 'counsellor' };
  if (clean === 'alerts') return { page: 'alerts' };
  if (clean === 'admin') return { page: 'admin' };
  if (clean.startsWith('cases/')) {
    const caseId = clean.slice(6).trim();
    return { page: 'caseDetail', caseId };
  }
  return { page: 'home' };
}

function toHash(view) {
  if (!view || view.page === 'home') return '#/';
  if (view.page === 'checkin') return '#/checkin';
  if (view.page === 'counsellor') return '#/counsellor';
  if (view.page === 'alerts') return '#/alerts';
  if (view.page === 'admin') return '#/admin';
  if (view.page === 'caseDetail' && view.caseId) return `#/cases/${view.caseId}`;
  return '#/';
}

function isAuthorizedForView(user, view) {
  if (!user || !view) return false;
  const page = view.page;
  if (page === 'home') return true;
  if (page === 'checkin') return user.role === 'victim';
  if (page === 'counsellor' || page === 'alerts' || page === 'caseDetail') return user.role === 'counsellor';
  if (page === 'admin') return user.role === 'admin';
  return false;
}

export default function App() {
  return (
    <I18nProvider>
      <AppInner />
    </I18nProvider>
  );
}

function AppInner() {
  const { locale, setLocale, t } = useI18n();
  const [user, setUser] = useState(null);
  const [view, setView] = useState(() => parseHash(window.location.hash));
  const [busy, setBusy] = useState(false);

  const refreshUser = useCallback(async () => {
    const { body } = await api('/auth/me');
    setUser(body.user ?? null);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Sync state on browser URL hash changes (back/forward or manual edit)
  useEffect(() => {
    function handleHashChange() {
      setView(parseHash(window.location.hash));
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  function navigate(page, params = {}) {
    const nextView = { page, ...params };
    const targetHash = toHash(nextView);
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash;
    }
    setView(nextView);
  }

  // Dev panel navigation: listen for custom events from DevPersonaSwitcher
  useEffect(() => {
    function handleDevNav(e) {
      const { page, caseId } = e.detail ?? {};
      if (page) navigate(page, caseId ? { caseId } : {});
    }
    window.addEventListener('dev-navigate', handleDevNav);
    return () => window.removeEventListener('dev-navigate', handleDevNav);
  }, []);

  async function signIn(usernameOrPayload, passcode = 'demo') {
    setBusy(true);
    const payload =
      typeof usernameOrPayload === 'object' && usernameOrPayload !== null
        ? usernameOrPayload
        : { username: usernameOrPayload, passcode };

    const res = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      await refreshUser();
    }
    setBusy(false);
    return res;
  }

  async function signOut() {
    setBusy(true);
    window.location.hash = '#/';
    setView({ page: 'home' });
    await api('/auth/logout', { method: 'POST' });
    await refreshUser();
    setBusy(false);
  }

  // Not signed in — show login.
  if (!user) {
    return <LoginPage onSignIn={signIn} onDevLogin={refreshUser} busy={busy} />;
  }

  // Role-based default view and access guard
  const defaultPage =
    user.role === 'counsellor' ? 'counsellor' : user.role === 'admin' ? 'admin' : 'checkin';

  const authorized = isAuthorizedForView(user, view);
  const effectiveView = authorized && view.page !== 'home' ? view : { page: defaultPage };
  const currentPage = effectiveView.page;

  // URL security invariant: if URL hash is unauthorized (e.g. victim typing #/cases/0002),
  // automatically overwrite hash with authoritative route (#/checkin)
  if (!authorized && window.location.hash !== toHash({ page: defaultPage })) {
    window.location.hash = toHash({ page: defaultPage });
  }

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <GovernmentHeader />

      <nav className="top-nav-gov" aria-label="Main navigation">
        <div className="nav-brand-gov" role="banner">
          <div className="nav-brand-logo" aria-hidden="true">
            <span>स</span>
          </div>
          <div className="nav-brand-text">
            <div className="nav-brand-title">
              <span className="nav-brand-hi">सहारा</span>
              <span className="nav-brand-en">Sahara</span>
            </div>
            <span className="nav-brand-sub">
              {locale === 'hi' ? 'कल्याण एवं संबल मंच · SIH 2026' : 'National Distress Monitoring & Well-being Support · SIH 2026'}
            </span>
          </div>
        </div>

        <div className="nav-links" role="tablist">
          {user.role === 'counsellor' && (
            <>
              <button
                className={`nav-icon-btn ${currentPage === 'counsellor' ? 'active' : ''}`}
                onClick={() => navigate('counsellor')}
                role="tab"
                aria-selected={currentPage === 'counsellor'}
              >
                <IconCase size={16} /> {t('nav.cases')}
              </button>
              <button
                className={`nav-icon-btn ${currentPage === 'alerts' ? 'active' : ''}`}
                onClick={() => navigate('alerts')}
                role="tab"
                aria-selected={currentPage === 'alerts'}
              >
                <IconAlert size={16} /> {t('nav.alerts')}
              </button>
            </>
          )}
          {user.role === 'admin' && (
            <button
              className={`nav-icon-btn ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => navigate('admin')}
              role="tab"
              aria-selected={currentPage === 'admin'}
            >
              <IconChart size={16} /> {t('nav.dashboard')}
            </button>
          )}
          {user.role === 'victim' && (
            <button
              className={`nav-icon-btn ${currentPage === 'checkin' ? 'active' : ''}`}
              onClick={() => navigate('checkin')}
              role="tab"
              aria-selected={currentPage === 'checkin'}
            >
              <IconChat size={16} /> {t('nav.checkin')}
            </button>
          )}
        </div>

        <div className="nav-user">
          <button
            onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
            aria-label={locale === 'en' ? 'Switch to Hindi' : 'Switch to English'}
            className="btn btn-secondary btn-sm"
          >
            {locale === 'en' ? 'हिंदी' : 'English'}
          </button>
          <span className="user-role-badge" title={user.displayName}>
            {user.displayName}
          </span>
          <button
            onClick={signOut}
            disabled={busy}
            aria-label={t('nav.signout')}
            className="btn btn-ghost btn-sm"
          >
            {t('nav.signout')}
          </button>
        </div>
      </nav>

      <main className="main-content" id="main-content">
        {currentPage === 'counsellor' && (
          <CounsellorDashboard onSelectCase={(caseId) => navigate('caseDetail', { caseId })} />
        )}
        {currentPage === 'caseDetail' && (
          <CaseDetail caseId={effectiveView.caseId} onBack={() => navigate('counsellor')} />
        )}
        {currentPage === 'alerts' && (
          <CounsellorDashboard
            alertsOnly
            onSelectCase={(caseId) => navigate('caseDetail', { caseId })}
          />
        )}
        {currentPage === 'admin' && user.role === 'admin' && <AdminDashboard />}
        {currentPage === 'checkin' && user.role === 'victim' && <CheckinChat user={user} />}
      </main>

      <GovernmentFooter />
    </div>
  );
}
