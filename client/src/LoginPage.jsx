import { useState } from 'react';
import { GovernmentHeader, GovernmentFooter } from './GovernmentBranding.jsx';
import { useI18n } from './i18n.jsx';

const DEMO_ACCOUNTS = [
  { user: 'victim', labelHi: 'शिकायतकर्ता A', labelEn: 'Complainant A', desc: 'Hindi · Investigation · Rising distress' },
  { user: 'case-b', labelHi: 'शिकायतकर्ता B', labelEn: 'Complainant B', desc: 'English · Trial · Intimidation risk' },
  { user: 'case-c', labelHi: 'शिकायतकर्ता C', labelEn: 'Complainant C', desc: 'English · Post-compensation · Improving' },
  { user: 'case-d', labelHi: 'शिकायतकर्ता D', labelEn: 'Complainant D', desc: 'English · Chargesheet · Social isolation' },
  { user: 'case-e', labelHi: 'शिकायतकर्ता E', labelEn: 'Complainant E', desc: 'English · Trial pending · Long-pending' },
  { user: 'case-f', labelHi: 'शिकायतकर्ता F', labelEn: 'Complainant F', desc: 'English · Investigation · Edge case' },
  { user: 'case-g', labelHi: 'शिकायतकर्ता G', labelEn: 'Complainant G', desc: 'English · Investigation · Sexual assault' },
  { user: 'case-h', labelHi: 'शिकायतकर्ता H', labelEn: 'Complainant H', desc: 'English · Chargesheet · Financial hardship' },
];

export default function LoginPage({ onSignIn, onDevLogin, busy }) {
  const { locale, t } = useI18n();
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [showDemo, setShowDemo] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) { setError(locale === 'hi' ? 'कृपया अपना उपयोगकर्ता नाम दर्ज करें।' : 'Please enter your username.'); return; }
    if (!passcode.trim()) { setError(locale === 'hi' ? 'कृपया पासकोड दर्ज करें।' : 'Please enter your passcode.'); return; }
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

      <div style={{ maxWidth: '48rem', margin: '0 auto', padding: '1.5rem 1rem' }}>
        {/* Trust Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-lg)', marginBottom: '1.5rem', border: '1px solid var(--line)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--secondary)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--ink-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t('sahara.safety')}</span>
        </div>

        {/* Hero + Helpline */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: 'var(--radius-full)', background: 'var(--accent-pale)', color: 'var(--accent)', fontSize: '0.75rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            ❤️ {t('sahara.freeSupport')}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 600, color: 'var(--accent)', margin: '0 0 0.5rem', lineHeight: 1.25 }}>
            {t('sahara.heroTitle')}
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--ink-muted)', margin: '0 0 1rem', lineHeight: 1.6, maxWidth: '36rem', marginLeft: 'auto', marginRight: 'auto' }}>{t('sahara.heroDesc1')}</p>

          {/* Helpline Card */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.65rem 1.25rem', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--ink-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{t('sahara.helpline')}</div>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--accent)' }}>14566 <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--ink-muted)' }}>({locale === 'hi' ? 'निःशुल्क / 24x7' : 'Toll-free / 24x7'})</span></div>
            </div>
            <a href="tel:14566" style={{ padding: '0.4rem 0.85rem', borderRadius: 'var(--radius-sm)', background: 'var(--surface-sunken)', color: 'var(--accent)', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none', border: '1px solid var(--line)' }}>
              {t('sahara.callDirect')}
            </a>
          </div>
        </div>

        {/* Complainant Banner */}
        <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)', boxShadow: 'var(--shadow-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', border: '1px solid var(--accent-pale)', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--accent-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{t('sahara.citizenTitle')}</h3>
              <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{t('sahara.citizenDesc')}</p>
            </div>
          </div>
          <button onClick={() => onSignIn('victim', 'demo')} disabled={busy} style={{ flexShrink: 0, padding: '0.6rem 1.1rem', borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
            {t('sahara.citizenCta')}
          </button>
        </div>

        {/* Dual Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          {/* Counsellor */}
          <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--line)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--accent)' }} />
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{t('sahara.tier1')}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('sahara.tier1Title')}</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', margin: '0 0 0.75rem', lineHeight: 1.5 }}>{t('sahara.tier1Desc')}</p>
            <button onClick={() => onSignIn('counsellor')} disabled={busy} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', background: 'var(--accent)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              {t('sahara.tier1Cta')}
            </button>
          </div>

          {/* Admin */}
          <div style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--line)', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--secondary)' }} />
            <div style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>{t('sahara.tier2')}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.5rem' }}>{t('sahara.tier2Title')}</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', margin: '0 0 0.75rem', lineHeight: 1.5 }}>{t('sahara.tier2Desc')}</p>
            <button onClick={() => onSignIn('admin')} disabled={busy} style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius)', background: 'var(--secondary)', color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
              {t('sahara.tier2Cta')}
            </button>
          </div>
        </div>

        {/* Demo Access */}
        <div style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--line-strong)', background: 'var(--surface)', marginBottom: '1rem' }}>
          <button onClick={() => setShowDemo(!showDemo)} style={{ background: 'none', border: 'none', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: 0, font: 'inherit' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink-soft)' }}>🧪 {t('sahara.demoAccess')}</span>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>{showDemo ? '▴' : '▾'}</span>
          </button>
          {showDemo && (
            <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.4rem' }}>
              {DEMO_ACCOUNTS.map(({ user, labelHi, labelEn }) => (
                <button key={user} onClick={() => fillDemo(user)} disabled={busy} className="login-demo-btn">
                  <span style={{ fontWeight: 600, fontSize: '0.78rem' }}>{locale === 'hi' ? labelHi : labelEn}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)' }}>{user} / demo</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manual Login */}
        <form onSubmit={handleSubmit} style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)', boxShadow: 'var(--shadow-sm)', border: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--ink)' }}>{t('sahara.manualLogin')}</div>
          <div>
            <label htmlFor="login-username" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--ink-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>{t('sahara.manualUsername')}</label>
            <input id="login-username" type="text" value={username} onChange={(e) => { setUsername(e.target.value); setError(''); }} placeholder="e.g. counsellor, admin, victim" disabled={busy} className="login-input" />
          </div>
          <div>
            <label htmlFor="login-passcode" style={{ display: 'block', fontSize: '0.72rem', color: 'var(--ink-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>{t('sahara.manualPasscode')}</label>
            <input id="login-passcode" type="password" value={passcode} onChange={(e) => { setPasscode(e.target.value); setError(''); }} placeholder="demo" disabled={busy} className="login-input" />
          </div>
          {error && (
            <div style={{ padding: '0.5rem 0.75rem', background: 'var(--risk-high-bg)', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', color: 'var(--risk-high)', fontWeight: 500 }}>⚠ {error}</div>
          )}
          <button type="submit" disabled={busy} className="btn btn-primary-lg">{t('sahara.manualCta')}</button>
        </form>

        {/* Trust Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
          {[
            { icon: '🛡️', title: t('sahara.trustPrivacy'), desc: t('sahara.trustPrivacyDesc') },
            { icon: '🤝', title: t('sahara.trustHuman'), desc: t('sahara.trustHumanDesc') },
            { icon: '🕊️', title: t('sahara.trustPace'), desc: t('sahara.trustPaceDesc') },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface-sunken)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <div style={{ fontSize: '1.3rem' }}>{icon}</div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>{title}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', lineHeight: 1.4 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <GovernmentFooter />
    </div>
  );
}
