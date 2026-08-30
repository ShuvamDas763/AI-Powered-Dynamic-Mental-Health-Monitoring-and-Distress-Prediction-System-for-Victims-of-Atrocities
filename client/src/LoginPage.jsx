export default function LoginPage({ onSignIn, busy }) {
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

      {/* Sign-in Cards */}
      <main style={{ maxWidth: '48rem', margin: '-1rem auto 3rem', padding: '0 2rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {/* Victim / Complainant Card */}
          <div className="card card-elevated animate-in animate-in-delay-1" style={{ cursor: 'pointer' }} onClick={() => !busy && onSignIn('victim')}>
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
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Complainant A</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                  Hindi · Well-being Check-in
                </p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              Submit regular well-being check-ins. Your counsellor monitors your
              progress and intervenes when support signals are detected.
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
              Sign in with demo credentials →
            </div>
          </div>

          {/* English Victim Card */}
          <div className="card card-elevated animate-in animate-in-delay-1" style={{ cursor: 'pointer' }} onClick={() => !busy && onSignIn('case-c')}>
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
                <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Complainant C</h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                  English · Well-being Check-in
                </p>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
              Compensation disbursed. Engagement steady. Reported improvement
              over recent months. Test the English check-in flow.
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
              Sign in with demo credentials →
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
              Sign in with demo credentials →
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
              Sign in with demo credentials →
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
      </main>
    </div>
  );
}
