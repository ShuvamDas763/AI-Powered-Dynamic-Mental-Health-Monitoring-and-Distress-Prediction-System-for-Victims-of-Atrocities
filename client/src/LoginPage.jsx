import { useState } from 'react';
import DevPersonaSwitcher from './DevPersonaSwitcher.jsx';

export default function LoginPage({ onSignIn, onDevLogin, busy }) {
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username or case ID.');
      return;
    }
    if (!passcode.trim()) {
      setError('Please enter your passcode.');
      return;
    }
    setError('');
    onSignIn(username.trim(), passcode.trim());
  }

  function fillDemoCredentials(user, pass) {
    setUsername(user);
    setPasscode(pass);
    setError('');
  }

  return (
    <div className="app-shell">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content animate-in">
          <div className="hero-badge">SIH26094 · Prototype</div>
          <h1>Well-being Support &amp; Monitoring</h1>
          <p>
            NHAA tracks legal grievances for atrocity victims. Nothing tracks their
            psychological well-being. This is the missing layer.
          </p>
          <p style={{ fontSize: '0.88rem', opacity: 0.7 }}>
            A decision-support triage system for complainants and victims registered
            under the SC/ST (Prevention of Atrocities) Act, 1989.
          </p>
        </div>
      </section>

      {/* Sign-in Section */}
      <main style={{ maxWidth: '48rem', margin: '-1rem auto 3rem', padding: '0 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>

          {/* Complainant Login Form */}
          <div className="card card-elevated animate-in animate-in-delay-1">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius)',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                boxShadow: 'var(--shadow-md)',
              }}>
                💬
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Complainant Sign-In</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                  Well-being Check-in Portal
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div>
                <label htmlFor="login-username" style={{ display: 'block', fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: '0.25rem', fontWeight: 500 }}>
                  Username or Case ID
                </label>
                <input
                  id="login-username"
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setError(''); }}
                  placeholder="e.g. victim, case-c"
                  disabled={busy}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    border: '1px solid var(--ink-faint, #ccc)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.88rem',
                    background: 'var(--surface, #fff)',
                    color: 'var(--ink, #1a1a2e)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label htmlFor="login-passcode" style={{ display: 'block', fontSize: '0.78rem', color: 'var(--ink-muted)', marginBottom: '0.25rem', fontWeight: 500 }}>
                  Passcode
                </label>
                <input
                  id="login-passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => { setPasscode(e.target.value); setError(''); }}
                  placeholder="e.g. demo"
                  disabled={busy}
                  style={{
                    width: '100%',
                    padding: '0.55rem 0.75rem',
                    border: '1px solid var(--ink-faint, #ccc)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.88rem',
                    background: 'var(--surface, #fff)',
                    color: 'var(--ink, #1a1a2e)',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {error && (
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--destructive, #dc2626)' }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                style={{
                  padding: '0.65rem',
                  background: 'var(--accent)',
                  color: 'var(--on-accent, #fff)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  cursor: busy ? 'default' : 'pointer',
                  opacity: busy ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {/* Demo credentials helper */}
            <div style={{
              marginTop: '1rem',
              padding: '0.65rem',
              background: 'var(--surface-sunken)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              color: 'var(--ink-muted)',
              lineHeight: 1.6,
            }}>
              <div style={{ fontWeight: 500, marginBottom: '0.35rem' }}>Demo accounts:</div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('victim', 'demo')}
                  disabled={busy}
                  style={{
                    padding: '0.25rem 0.5rem',
                    border: '1px solid var(--ink-faint, #ccc)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface, #fff)',
                    fontSize: '0.75rem',
                    cursor: busy ? 'default' : 'pointer',
                    color: 'var(--ink-soft)',
                  }}
                >
                  victim / demo
                </button>
                <button
                  type="button"
                  onClick={() => fillDemoCredentials('case-c', 'demo')}
                  disabled={busy}
                  style={{
                    padding: '0.25rem 0.5rem',
                    border: '1px solid var(--ink-faint, #ccc)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--surface, #fff)',
                    fontSize: '0.75rem',
                    cursor: busy ? 'default' : 'pointer',
                    color: 'var(--ink-soft)',
                  }}
                >
                  case-c / demo
                </button>
              </div>
            </div>
          </div>

          {/* Welfare Officer Card */}
          <div className="card card-elevated animate-in animate-in-delay-1" style={{ cursor: 'pointer' }} onClick={() => !busy && onSignIn('counsellor')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius)',
                background: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                boxShadow: 'var(--shadow-md)',
              }}>
                🩺
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Welfare Officer</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                  District Counselling Unit
                </p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              Access individual case records, check-in histories, distress trends,
              and recommended interventions for assigned complainants.
            </p>
            <div style={{
              marginTop: '1.25rem',
              padding: '0.65rem',
              background: 'var(--surface-sunken)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
              fontSize: '0.82rem',
              color: 'var(--ink-muted)',
              fontWeight: 500,
            }}>
              Sign in as welfare officer →
            </div>
          </div>

          {/* Administrator Card */}
          <div className="card card-elevated animate-in animate-in-delay-2" style={{ cursor: 'pointer' }} onClick={() => !busy && onSignIn('admin')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius)',
                background: 'var(--warm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.4rem',
                boxShadow: 'var(--shadow-md)',
              }}>
                📊
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Administrator</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                  National Monitoring Cell
                </p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              View anonymised aggregate data, geographic trends, and cohort
              distributions. Individual case data is never visible at this level.
            </p>
            <div style={{
              marginTop: '1.25rem',
              padding: '0.65rem',
              background: 'var(--surface-sunken)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
              fontSize: '0.82rem',
              color: 'var(--ink-muted)',
              fontWeight: 500,
            }}>
              Sign in as administrator →
            </div>
          </div>
        </div>

        {/* Footer disclaimer */}
        <div className="animate-in animate-in-delay-3" style={{ textAlign: 'center', marginTop: '2.5rem' }}>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', maxWidth: '36rem', margin: '0 auto', lineHeight: 1.7 }}>
            Prototype for evaluation. Not a diagnostic tool and not a clinically
            validated predictor. All escalation is reviewed by a person.
          </p>
          <p style={{ color: 'var(--ink-faint)', fontSize: '0.78rem', maxWidth: '36rem', margin: '0.5rem auto 0', lineHeight: 1.6 }}>
            Integrates with NHAA 14566 — the National Helpline for Atrocity Victims
            under the SC/ST (Prevention of Atrocities) Act, 1989.
          </p>
          <p style={{ color: 'var(--ink-faint)', fontSize: '0.72rem', opacity: 0.7, marginTop: '0.75rem' }}>
            Built for Smart India Hackathon 2026 · Problem Statement SIH26094
          </p>
        </div>

        {/* Dev-only persona switcher — invisible in production */}
        <DevPersonaSwitcher onSignIn={onSignIn} onDevLogin={onDevLogin} busy={busy} />
      </main>
    </div>
  );
}
