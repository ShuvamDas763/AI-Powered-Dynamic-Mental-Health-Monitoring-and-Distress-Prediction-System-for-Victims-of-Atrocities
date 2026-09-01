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
import { api } from './api.js';

export default function App() {
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
      <nav className="top-nav">
        <span className="nav-brand">Well-being Monitor</span>

        <div className="nav-links">
          {user.role === 'counsellor' && (
            <>
              <button
                className={currentPage === 'counsellor' ? 'active' : ''}
                onClick={() => navigate('counsellor')}
              >
                Cases
              </button>
              <button
                className={currentPage === 'alerts' ? 'active' : ''}
                onClick={() => navigate('alerts')}
              >
                Alerts
              </button>
            </>
          )}
          {user.role === 'admin' && (
            <button
              className={currentPage === 'admin' ? 'active' : ''}
              onClick={() => navigate('admin')}
            >
              Admin
            </button>
          )}
          {user.role === 'victim' && (
            <button
              className={currentPage === 'checkin' ? 'active' : ''}
              onClick={() => navigate('checkin')}
            >
              Check-in
            </button>
          )}
        </div>

        <div className="nav-user">
          <span className="user-role">{user.displayName}</span>
          <button onClick={signOut} disabled={busy}>
            Sign out
          </button>
        </div>
      </nav>

      <main className="main-content">
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
    </div>
  );
}
