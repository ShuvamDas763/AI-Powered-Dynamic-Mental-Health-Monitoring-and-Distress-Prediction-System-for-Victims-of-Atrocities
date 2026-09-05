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
  const [view, setView] = useState({ page: 'home' });
  const [busy, setBusy] = useState(false);

  const refreshUser = useCallback(async () => {
    const { body } = await api('/auth/me');
    setUser(body.user ?? null);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Dev panel navigation: listen for custom events from DevPersonaSwitcher
  useEffect(() => {
    function handleDevNav(e) {
      const { page, caseId } = e.detail ?? {};
      if (page) setView({ page, ...(caseId ? { caseId } : {}) });
    }
    window.addEventListener('dev-navigate', handleDevNav);
    return () => window.removeEventListener('dev-navigate', handleDevNav);
  }, []);

  async function signIn(username, passcode = 'demo') {
    setBusy(true);
    await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, passcode }),
    });
    await refreshUser();
    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
    setView({ page: 'home' });
    await api('/auth/logout', { method: 'POST' });
    await refreshUser();
    setBusy(false);
  }

  function navigate(page, params = {}) {
    setView({ page, ...params });
  }

  // Not signed in — show login.
  if (!user) {
    return <LoginPage onSignIn={signIn} onDevLogin={refreshUser} busy={busy} />;
  }

  // Role-based default view.
  const defaultPage =
    user.role === 'counsellor' ? 'counsellor' : user.role === 'admin' ? 'admin' : 'checkin';

  const currentPage = view.page === 'home' ? defaultPage : view.page;

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <GovernmentHeader />

      <nav className="top-nav-gov" aria-label="Main navigation">
        <div className="nav-brand-gov">
          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', fontSize: '0.75rem', fontWeight: 700 }}>स</span>
          </div>
          <div className="nav-brand-text">
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>सहारा</span>
              <span style={{ fontWeight: 600 }}>Sahara</span>
            </span>
            <span className="nav-brand-sub">कल्याण एवं संबल मंच · SIH 2026</span>
          </div>
        </div>

        <div className="nav-links">
          {user.role === 'counsellor' && (
            <>
              <button
                className={`nav-icon-btn ${currentPage === 'counsellor' ? 'active' : ''}`}
                onClick={() => navigate('counsellor')}
              >
                <IconCase size={16} /> {t('nav.cases')}
              </button>
              <button
                className={`nav-icon-btn ${currentPage === 'alerts' ? 'active' : ''}`}
                onClick={() => navigate('alerts')}
              >
                <IconAlert size={16} /> {t('nav.alerts')}
              </button>
            </>
          )}
          {user.role === 'admin' && (
            <button
              className={`nav-icon-btn ${currentPage === 'admin' ? 'active' : ''}`}
              onClick={() => navigate('admin')}
            >
              <IconChart size={16} /> {t('nav.dashboard')}
            </button>
          )}
          {user.role === 'victim' && (
            <button
              className={`nav-icon-btn ${currentPage === 'checkin' ? 'active' : ''}`}
              onClick={() => navigate('checkin')}
            >
              <IconChat size={16} /> {t('nav.checkin')}
            </button>
          )}
        </div>

        <div className="nav-user">
          <button
            onClick={() => setLocale(locale === 'en' ? 'hi' : 'en')}
            aria-label={locale === 'en' ? 'Switch to Hindi' : 'Switch to English'}
            style={{ background: 'var(--surface-sunken)', border: '1px solid var(--line)', color: 'var(--ink-muted)', padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-xs)', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}
          >
            {locale === 'en' ? 'हिंदी' : 'English'}
          </button>
          <span className="user-role" style={{ color: 'var(--ink-muted)' }}>{user.displayName}</span>
          <button onClick={signOut} disabled={busy} aria-label={t('nav.signout')} style={{ background: 'var(--surface-sunken)', border: '1px solid var(--line)', color: 'var(--ink-muted)', padding: '0.35rem 0.75rem', borderRadius: 'var(--radius-xs)', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>
            {t('nav.signout')}
          </button>
        </div>
      </nav>

      <main className="main-content" id="main-content">
        {currentPage === 'counsellor' && (
          <CounsellorDashboard onSelectCase={(caseId) => navigate('caseDetail', { caseId })} />
        )}
        {currentPage === 'caseDetail' && (
          <CaseDetail caseId={view.caseId} onBack={() => navigate('counsellor')} />
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
