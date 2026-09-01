/**
 * Dev-only persona switcher — testing utility for signing in as any of the
 * 8 personas (or counsellor/admin) during rehearsal.
 *
 * SECURITY: This component only renders when the server's /api/health
 * endpoint returns isDev: true. In production (NODE_ENV=production),
 * the dev router is not mounted, the health endpoint returns isDev: false,
 * and this component never renders. The public login page stays exactly
 * as it is — 2 clean complainant cards — no judge or evaluator will
 * ever see this panel.
 */

import { useEffect, useState } from 'react';

const STAGE_LABELS = {
  investigation: 'Investigation',
  trial_active: 'Trial Active',
  trial_pending: 'Trial Pending',
  post_compensation: 'Post-Compensation',
  chargesheet_filed: 'Chargesheet Filed',
};

const LOCALE_LABELS = { en: 'English', hi: 'Hindi' };

const TAG_ICONS = {
  grave_offence: '⚖️',
  witness_intimidation: '👁️',
  sexual_assault: '🔒',
  caste_violence_family: '👨‍👩‍👧',
  sc_st_act_beneficiary: '📋',
};

export default function DevPersonaSwitcher({ onSignIn, onDevLogin, busy: parentBusy }) {
  const [isDev, setIsDev] = useState(false);
  const [personas, setPersonas] = useState([]);
  const [roles, setRoles] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * Dev login bypasses the standard auth route. The dev endpoint accepts
   * persona keys (A–H) and role names directly — no username mapping needed.
   */
  async function devSignIn(key) {
    if (busy || parentBusy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/dev/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key }),
      });
      if (res.ok) {
        if (onDevLogin) await onDevLogin();
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * Login as counsellor, then navigate to a specific case detail.
   * This lets you jump straight to any persona's case data.
   */
  async function viewCase(caseId) {
    if (busy || parentBusy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/dev/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'counsellor' }),
      });
      if (res.ok && onDevLogin) {
        await onDevLogin();
        // Small delay for React to process the new user state
        await new Promise((r) => setTimeout(r, 100));
        // Navigate to case detail via custom event
        window.dispatchEvent(new CustomEvent('dev-navigate', { detail: { page: 'caseDetail', caseId } }));
      }
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((data) => {
        setIsDev(data.isDev === true);
        if (data.isDev) {
          return fetch('/api/dev/personas');
        }
        return null;
      })
      .then((r) => r?.json())
      .then((data) => {
        if (data) {
          setPersonas(data.personas ?? []);
          setRoles(data.roles ?? []);
        }
      })
      .catch(() => {});
  }, []);

  if (!isDev) return null;

  return (
    <div style={{ marginTop: '2rem' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'block',
          width: '100%',
          padding: '0.6rem 1rem',
          background: 'none',
          border: '1px dashed var(--ink-faint, #ccc)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--ink-muted, #888)',
          fontSize: '0.78rem',
          cursor: 'pointer',
          textAlign: 'center',
          letterSpacing: '0.03em',
        }}
      >
        {expanded ? '▾ Hide' : '▸'} Dev testing panel — all 8 personas
      </button>

      {expanded && (
        <div style={{ marginTop: '0.75rem' }}>
          {/* Non-victim roles */}
          <div style={{ marginBottom: '1rem' }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', margin: '0 0 0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              System Roles
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {roles.map((r) => (
                <button
                  key={r.key}
                  onClick={() => devSignIn(r.key)}
                  disabled={busy}
                  style={{
                    padding: '0.4rem 0.8rem',
                    border: '1px solid var(--ink-faint, #ccc)',
                    borderRadius: 'var(--radius-sm)',
                    background: r.role === 'admin' ? 'var(--warm-muted, #fdf0e6)' : 'var(--accent-muted, #e8f4f0)',
                    cursor: busy ? 'default' : 'pointer',
                    fontSize: '0.78rem',
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {r.role === 'admin' ? '📊' : '🩺'} {r.pseudonym}
                </button>
              ))}
            </div>
          </div>

          {/* All 8 personas */}
          <div>
            <p style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', margin: '0 0 0.4rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Complainant Personas
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '0.75rem' }}>
              {personas.map((p) => (
                <button
                  key={p.key}
                  onClick={() => devSignIn(p.key)}
                  disabled={busy}
                  className="card card-elevated"
                  style={{
                    cursor: busy ? 'default' : 'pointer',
                    textAlign: 'left',
                    opacity: busy ? 0.5 : 1,
                    transition: 'border-color 0.15s',
                    padding: '1rem',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent, #2d6a4f)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = ''; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 'var(--radius)',
                      background: 'var(--accent)', display: 'flex',
                      alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.1rem', flexShrink: 0,
                    }}>
                      💬
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '0.95rem' }}>{p.pseudonym}</h3>
                      <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                        {LOCALE_LABELS[p.locale] ?? p.locale} · {p.key} · {STAGE_LABELS[p.caseStage] ?? p.caseStage}
                      </p>
                    </div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                    {p.monthsSinceRegistration}mo · {p.checkInCount} check-ins · {p.priorityTags.map((t) => TAG_ICONS[t] ?? '•').join(' ')}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--accent)', fontWeight: 500 }}>
                      Sign in as this persona →
                    </span>
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); viewCase(p.caseId); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); viewCase(p.caseId); } }}
                      style={{ fontSize: '0.7rem', color: 'var(--warm, #b5651d)', fontWeight: 500, cursor: 'pointer' }}
                    >
                      View case details →
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
