/**
 * Application shell — Phase 1 scaffold.
 *
 * At this stage this screen exists to prove the stack is wired end to end and
 * that the two-tier boundary is enforced by the SERVER, not by this component.
 * Phases 4-6 replace the placeholder panels with the real check-in flow and
 * dashboards.
 *
 * Note what this component does NOT do: it never decides what the user may see.
 * It asks the server who it is talking to and renders whatever the server was
 * willing to return. The "probe" button below deliberately calls a Tier 1
 * endpoint regardless of role so you can watch the server refuse it.
 */

import { useCallback, useEffect, useState } from 'react';

/** Small fetch helper. `credentials: same-origin` keeps the role session cookie. */
async function api(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, body };
}

export default function App() {
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [probe, setProbe] = useState(null);
  const [busy, setBusy] = useState(false);

  const refreshUser = useCallback(async () => {
    const { body } = await api('/auth/me');
    setUser(body.user ?? null);
  }, []);

  useEffect(() => {
    api('/health').then(({ body }) => setHealth(body));
    refreshUser();
  }, [refreshUser]);

  async function signIn(username) {
    setBusy(true);
    setProbe(null);
    await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, passcode: 'demo' }),
    });
    await refreshUser();
    setBusy(false);
  }

  async function signOut() {
    setBusy(true);
    setProbe(null);
    await api('/auth/logout', { method: 'POST' });
    await refreshUser();
    setBusy(false);
  }

  /**
   * Ask for Tier 1 (individual-level) data as whatever role is currently
   * signed in. As a counsellor this reaches the endpoint. As an administrator
   * the server returns 403 and no case data at all.
   */
  async function probeIdentifiedTier() {
    const result = await api('/counsellor/cases');
    setProbe(result);
  }

  return (
    <main
      style={{
        maxWidth: '46rem',
        margin: '0 auto',
        padding: '3rem 1.5rem 5rem',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.75rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          margin: 0,
        }}
      >
        SIH26094 &middot; Prototype &middot; Phase 1 scaffold
      </p>

      <h1 style={{ fontSize: '1.9rem', margin: '0.5rem 0 0.75rem' }}>
        Well-being Support &amp; Monitoring
      </h1>

      <p style={{ color: 'var(--ink-soft)', maxWidth: '38rem' }}>
        A well-being check-in and support-monitoring layer for complainants and
        victims registered under the SC/ST (Prevention of Atrocities) Act, 1989.
        This build uses synthetic demonstration data only.
      </p>

      <Panel title="Server">
        {health ? (
          <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.25rem 1rem' }}>
            <dt style={dtStyle}>Status</dt>
            <dd style={ddStyle}>{health.status}</dd>
            <dt style={dtStyle}>Analysis mode</dt>
            <dd style={ddStyle}>
              {health.llmMode === 'live'
                ? 'Live model calls'
                : 'Cached responses (no API key set, or fallback forced)'}
            </dd>
            <dt style={dtStyle}>Model</dt>
            <dd style={ddStyle}>{health.model}</dd>
          </dl>
        ) : (
          <p style={{ margin: 0, color: 'var(--ink-muted)' }}>Contacting server&hellip;</p>
        )}
      </Panel>

      <Panel title="Role session">
        {user ? (
          <>
            <p style={{ marginTop: 0 }}>
              Signed in as <strong>{user.displayName}</strong>
              <br />
              <span style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
                role <code>{user.role}</code> &middot; data tier{' '}
                <code>{user.dataTier ?? 'self only'}</code>
              </span>
            </p>
            <button style={buttonStyle} onClick={signOut} disabled={busy}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <p style={{ marginTop: 0, color: 'var(--ink-soft)' }}>
              The role is decided by the server and stored in the session. The
              browser cannot choose its own privileges.
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button style={buttonStyle} onClick={() => signIn('counsellor')} disabled={busy}>
                Sign in as welfare officer
              </button>
              <button style={buttonStyle} onClick={() => signIn('admin')} disabled={busy}>
                Sign in as administrator
              </button>
            </div>
          </>
        )}
      </Panel>

      <Panel title="Two-tier boundary check">
        <p style={{ marginTop: 0, color: 'var(--ink-soft)' }}>
          This asks the server for individual-level case data using whatever
          role is signed in. A welfare officer reaches the endpoint. An
          administrator is refused outright and receives no case data — not a
          redacted version of it.
        </p>
        <button style={buttonStyle} onClick={probeIdentifiedTier} disabled={!user}>
          Request individual-level data
        </button>
        {!user && (
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
            Sign in first to try this.
          </p>
        )}
        {probe && (
          <pre
            style={{
              marginTop: '1rem',
              padding: '0.85rem',
              background: 'var(--surface-sunken)',
              border: '1px solid var(--line)',
              borderRadius: 'var(--radius)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
            }}
          >
            HTTP {probe.status}
            {'\n'}
            {JSON.stringify(probe.body, null, 2)}
          </pre>
        )}
      </Panel>

      <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', marginTop: '2.5rem' }}>
        Prototype for evaluation. Not a diagnostic tool and not a clinically
        validated predictor. All escalation is reviewed by a person.
      </p>
    </main>
  );
}

function Panel({ title, children }) {
  return (
    <section
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-soft)',
        padding: '1.25rem 1.4rem',
        marginTop: '1.5rem',
      }}
    >
      <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>{title}</h2>
      {children}
    </section>
  );
}

const dtStyle = { color: 'var(--ink-muted)', fontSize: '0.9rem' };
const ddStyle = { margin: 0, fontSize: '0.9rem' };

const buttonStyle = {
  font: 'inherit',
  fontSize: '0.9rem',
  padding: '0.5rem 0.9rem',
  borderRadius: 'var(--radius)',
  border: '1px solid var(--accent)',
  background: 'var(--accent)',
  color: '#fff',
  cursor: 'pointer',
};
