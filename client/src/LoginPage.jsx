import { useState } from 'react';
import { GovernmentHeader, GovernmentFooter, IconPhone, IconShield, IconLock, IconCheckCircle, IconUser } from './GovernmentBranding.jsx';
import { useI18n } from './i18n.jsx';
import DevPersonaSwitcher from './DevPersonaSwitcher.jsx';

const DEMO_ACCOUNTS = [
  { user: 'victim', labelHi: 'शिकायतकर्ता A', labelEn: 'Complainant A', desc: 'Hindi · Investigation · Baseline monitor' },
  { user: 'case-b', labelHi: 'शिकायतकर्ता B', labelEn: 'Complainant B', desc: 'English · Trial · Intimidation risk' },
  { user: 'case-c', labelHi: 'शिकायतकर्ता C', labelEn: 'Complainant C', desc: 'English · Post-compensation · Resolving' },
  { user: 'case-d', labelHi: 'शिकायतकर्ता D', labelEn: 'Complainant D', desc: 'English · Chargesheet · Consent opt-out' },
  { user: 'case-e', labelHi: 'शिकायतकर्ता E', labelEn: 'Complainant E', desc: 'English · Trial pending · Deflection signal' },
  { user: 'case-f', labelHi: 'शिकायतकर्ता F', labelEn: 'Complainant F', desc: 'English · Investigation · Acute crisis trigger' },
  { user: 'case-g', labelHi: 'शिकायतकर्ता G', labelEn: 'Complainant G', desc: 'English · Investigation · Recovery trajectory' },
  { user: 'case-h', labelHi: 'शिकायतकर्ता H', labelEn: 'Complainant H', desc: 'English · Chargesheet · Outreach continuity' },
];

export default function LoginPage({ onSignIn, onDevLogin, busy }) {
  const { locale, t } = useI18n();
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) {
      setError(locale === 'hi' ? 'कृपया अपना उपयोगकर्ता नाम या केस आईडी दर्ज करें।' : 'Please enter your username or Case ID.');
      return;
    }
    if (!passcode.trim()) {
      setError(locale === 'hi' ? 'कृपया अपना पासकोड दर्ज करें।' : 'Please enter your passcode.');
      return;
    }
    setError('');
    onSignIn(username.trim(), passcode.trim());
  }

  function fillDemo(user) {
    setUsername(user);
    setPasscode('demo');
    setError('');
  }

  return (
    <div className="app-shell">
      <GovernmentHeader />

      <main className="main-content" style={{ maxWidth: '54rem', padding: '2rem 1.25rem 3.5rem' }}>
        {/* Statutory Trust Banner */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          padding: '0.65rem 1.15rem',
          background: 'var(--surface-sunken)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.75rem',
          border: '1px solid var(--line)',
        }}>
          <IconLock size={16} color="var(--secondary)" />
          <span style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--ink-secondary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}>
            {t('sahara.safety')}
          </span>
        </div>

        {/* Hero Section & Immediate Helpline Access */}
        <div style={{ textAlign: 'center', marginBottom: '2.25rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            padding: '0.3rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            background: 'var(--accent-pale)',
            color: 'var(--accent)',
            fontSize: '0.78rem',
            fontWeight: 700,
            marginBottom: '0.85rem',
          }}>
            <span>🌱</span> {t('sahara.freeSupport')}
          </div>

          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(1.5rem, 3.2vw, 2.1rem)',
            fontWeight: 700,
            color: 'var(--accent)',
            margin: '0 0 0.65rem',
            lineHeight: 1.25,
          }}>
            {t('sahara.heroTitle')}
          </h1>

          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--ink-muted)',
            margin: '0 0 1.25rem',
            lineHeight: 1.6,
            maxWidth: '38rem',
            marginLeft: 'auto',
            marginRight: 'auto',
          }}>
            {t('sahara.heroDesc1')}
          </p>

          {/* 24/7 National Emergency Helplines Strip */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.75rem 1.35rem',
            background: 'var(--surface)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--line)',
            boxShadow: 'var(--shadow-sm)',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            <IconPhone size={20} color="var(--accent)" />
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('sahara.helpline')}
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--accent)', letterSpacing: '-0.01em' }}>
                14566 &nbsp;<span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--ink-muted)' }}>| Tele-MANAS: 14416 (24x7)</span>
              </div>
            </div>
            <a
              href="tel:14566"
              className="btn btn-secondary btn-sm"
              style={{ fontWeight: 700 }}
              aria-label="Call national helpline 14566 directly"
            >
              {t('sahara.callDirect')}
            </a>
          </div>
        </div>

        {/* Priority 1: Complainant / Citizen Safe Entry Banner */}
        <div className="card card-hero animate-in" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
          borderLeft: '5px solid var(--accent)',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: 260, flex: 1 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'var(--accent-pale)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--accent)',
            }}>
              <IconShield size={24} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                {locale === 'hi' ? 'नागरिक संबल प्रवेश' : 'Citizen Sanctuary & Direct Entry'}
              </div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                {t('sahara.citizenTitle')}
              </h2>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                {t('sahara.citizenDesc')}
              </p>
            </div>
          </div>
          <button
            onClick={() => onSignIn('victim', 'demo')}
            disabled={busy}
            className="btn"
            style={{ padding: '0.7rem 1.4rem', fontSize: '0.9375rem', fontWeight: 700, flexShrink: 0 }}
          >
            {t('sahara.citizenCta')}
          </button>
        </div>

        {/* Professional Casework & Oversight Access (Dual Cards) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
          {/* Tier 1: Counsellor */}
          <div className="card card-elevated" style={{ borderTop: '4px solid var(--accent)', position: 'relative' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
              {t('sahara.tier1')}
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.45rem' }}>
              {t('sahara.tier1Title')}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
              {t('sahara.tier1Desc')}
            </p>
            <button
              onClick={() => onSignIn('counsellor', 'demo')}
              disabled={busy}
              className="btn btn-secondary"
              style={{ width: '100%', fontWeight: 700 }}
            >
              {t('sahara.tier1Cta')}
            </button>
          </div>

          {/* Tier 2: Admin */}
          <div className="card card-elevated" style={{ borderTop: '4px solid var(--secondary)', position: 'relative' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>
              {t('sahara.tier2')}
            </div>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.45rem' }}>
              {t('sahara.tier2Title')}
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', margin: '0 0 1rem', lineHeight: 1.5 }}>
              {t('sahara.tier2Desc')}
            </p>
            <button
              onClick={() => onSignIn('admin', 'demo')}
              disabled={busy}
              className="btn btn-secondary"
              style={{ width: '100%', fontWeight: 700 }}
            >
              {t('sahara.tier2Cta')}
            </button>
          </div>
        </div>

        {/* Quick Demo Access Accordion */}
        <div style={{
          padding: '1.15rem 1.35rem',
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--line-strong)',
          background: 'var(--surface)',
          marginBottom: '1.5rem',
        }}>
          <button
            onClick={() => setShowDemo(!showDemo)}
            style={{
              background: 'none',
              border: 'none',
              width: '100%',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              padding: 0,
              font: 'inherit',
            }}
            aria-expanded={showDemo}
          >
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--ink-soft)' }}>
              🧪 {t('sahara.demoAccess')}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
              {showDemo ? '▴ Hide personas' : '▾ View all 8 personas'}
            </span>
          </button>

          {showDemo && (
            <div style={{
              marginTop: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
              gap: '0.65rem',
            }}>
              {DEMO_ACCOUNTS.map(({ user, labelHi, labelEn, desc }) => (
                <button
                  key={user}
                  onClick={() => fillDemo(user)}
                  disabled={busy}
                  className="login-demo-btn"
                >
                  <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--ink)' }}>
                    {locale === 'hi' ? labelHi : labelEn}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                    {desc}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 600, marginTop: '0.15rem' }}>
                    {user} / demo
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manual Sign-In Card */}
        <form
          onSubmit={handleSubmit}
          className="card"
          style={{
            padding: '1.5rem',
            marginBottom: '1.75rem',
          }}
        >
          <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '0.75rem' }}>
            {t('sahara.manualLogin')}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div>
              <label htmlFor="login-username" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('sahara.manualUsername')}
              </label>
              <input
                id="login-username"
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); setError(''); }}
                placeholder="e.g. counsellor, admin, victim, case-b"
                disabled={busy}
                className="login-input"
              />
            </div>

            <div>
              <label htmlFor="login-passcode" style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '0.3rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {t('sahara.manualPasscode')}
              </label>
              <input
                id="login-passcode"
                type="password"
                value={passcode}
                onChange={(e) => { setPasscode(e.target.value); setError(''); }}
                placeholder="demo"
                disabled={busy}
                className="login-input"
              />
            </div>

            {error && (
              <div role="alert" style={{ padding: '0.65rem 0.95rem', background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high-border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--risk-high)', fontWeight: 600 }}>
                ⚠ {error}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn btn-primary-lg">
              {busy ? t('login.signing') : t('sahara.manualCta')}
            </button>
          </div>
        </form>

        {/* Development Persona Switcher Integration */}
        <DevPersonaSwitcher onSignIn={onSignIn} onDevLogin={onDevLogin} busy={busy} />

        {/* Core Trust Pillars */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1.75rem' }}>
          {[
            { icon: '🛡️', title: t('sahara.trustPrivacy'), desc: t('sahara.trustPrivacyDesc') },
            { icon: '🤝', title: t('sahara.trustHuman'), desc: t('sahara.trustHumanDesc') },
            { icon: '🕊️', title: t('sahara.trustPace'), desc: t('sahara.trustPaceDesc') },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ padding: '1.15rem', borderRadius: 'var(--radius-md)', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column', gap: '0.35rem', border: '1px solid var(--line-faint)' }}>
              <div style={{ fontSize: '1.35rem' }}>{icon}</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>{title}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', lineHeight: 1.45 }}>{desc}</div>
            </div>
          ))}
        </div>
      </main>

      <GovernmentFooter />
    </div>
  );
}
