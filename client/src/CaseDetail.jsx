import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { api } from './api.js';

const BAND_CLASS = { low: 'band-low', moderate: 'band-moderate', elevated: 'band-elevated', high: 'band-high' };
const STAGE_LABELS = { investigation: 'Investigation', trial_active: 'Trial (active)', trial_pending: 'Trial (pending)', chargesheet_filed: 'Chargesheet filed', post_compensation: 'Post-compensation' };
const BAND_COLORS = { low: '#4a7c59', moderate: '#a0722e', elevated: '#c45d3a', high: '#8b2e23' };

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e0d6',
      borderRadius: 12,
      padding: '0.65rem 0.85rem',
      boxShadow: '0 8px 24px rgba(15, 20, 25, 0.10)',
    }}>
      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: '0.25rem' }}>Check-in #{data.checkInNumber}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Georgia, serif' }}>{data.score}</div>
      <div style={{ fontSize: '0.78rem', color: BAND_COLORS[data.band] ?? '#0f1419', textTransform: 'capitalize' }}>{data.band}</div>
    </div>
  );
};

export default function CaseDetail({ caseId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    api(`/counsellor/cases/${caseId}`).then(({ body }) => {
      setData(body);
      setLoading(false);
    });
  }, [caseId]);

  if (loading) {
    return (
      <div>
        <button className="back-link" onClick={onBack}>&larr; Back to cases</button>
        <div className="loading-shimmer" style={{ height: 200, marginBottom: '1rem' }} />
        <div className="loading-shimmer" style={{ height: 300, marginBottom: '1rem' }} />
        <div className="loading-shimmer" style={{ height: 200 }} />
      </div>
    );
  }

  if (!data || !data.caseRecord) return <p>Case not found.</p>;

  const { caseRecord, checkIns, trendData, latest } = data;
  const latestAssessment = latest;
  const escalation = latestAssessment?.escalation ?? {};
  const explanation = latestAssessment?.explanation ?? {};
  const drivers = explanation.drivers ?? [];
  const interventions = latestAssessment?.interventions ?? [];

  const chartData = trendData.map((p) => ({
    ...p,
    label: `#${p.checkInNumber}`,
  }));

  const completedCount = checkIns.filter((c) => c.status === 'completed').length;
  const missedCount = checkIns.filter((c) => c.status === 'missed').length;

  return (
    <div>
      <button className="back-link animate-in" onClick={onBack}>&larr; Back to cases</button>

      {/* Case Header — Hero card */}
      <div className="card card-elevated animate-in animate-in-delay-1" style={{
        position: 'relative',
        overflow: 'hidden',
        background: latestAssessment?.escalated
          ? 'var(--risk-high-bg)'
          : 'var(--surface)',
      }}>
        {latestAssessment?.escalated && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: 'var(--risk-high)',
          }} />
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', margin: '0 0 0.3rem' }}>{caseRecord.pseudonym}</h1>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
              {caseRecord.caseId} · {caseRecord.district}, {caseRecord.state}
            </p>
          </div>
          {latestAssessment && (
            <div style={{ textAlign: 'right' }}>
              <span className={`band-badge ${BAND_CLASS[latestAssessment.band] ?? ''}`} style={{ fontSize: '0.82rem', padding: '0.3rem 0.85rem' }}>
                {latestAssessment.band}
              </span>
              <div style={{ fontSize: '2.2rem', fontWeight: 700, marginTop: '0.15rem', lineHeight: 1 }}>
                {latestAssessment.score}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Distress Score
              </div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="stats-row" style={{ marginTop: '1.25rem' }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--accent)' }}>{checkIns.length}</div>
            <div className="stat-label">Check-ins</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{caseRecord.monthsSinceRegistration}mo</div>
            <div className="stat-label">Since Registration</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ fontSize: '1rem' }}>
              {STAGE_LABELS[caseRecord.caseStage] ?? caseRecord.caseStage}
            </div>
            <div className="stat-label">Case Stage</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: escalation.triggered ? 'var(--risk-high)' : 'var(--risk-low)' }}>
              {escalation.triggered ? 'Yes' : 'No'}
            </div>
            <div className="stat-label">Escalated</div>
          </div>
        </div>

        {caseRecord.contextNote && (
          <p style={{ margin: '1.25rem 0 0', fontSize: '0.9rem', color: 'var(--ink-soft)', fontStyle: 'italic', padding: '0.75rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)' }}>
            {caseRecord.contextNote}
          </p>
        )}
      </div>

      {/* Trend Chart */}
      {chartData.length >= 2 && (
        <div className="card animate-in animate-in-delay-2" style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem' }}>Distress Trend</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1a3a42" stopOpacity={0.2}/>
                  <stop offset="95%" stopColor="#1a3a42" stopOpacity={0.02}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line-faint)" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={31} stroke="#a0722e" strokeDasharray="6 4" strokeWidth={1.5} />
              <ReferenceLine y={50} stroke="#c45d3a" strokeDasharray="6 4" strokeWidth={1.5} />
              <ReferenceLine y={70} stroke="#8b2e23" strokeDasharray="6 4" strokeWidth={1.5} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#1a3a42"
                strokeWidth={3}
                fill="url(#scoreGradient)"
                dot={{ r: 5, fill: '#1a3a42', stroke: '#fff', strokeWidth: 2 }}
                activeDot={{ r: 7, stroke: '#1a3a42', strokeWidth: 2, fill: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Low', color: '#4a7c59' },
              { label: 'Moderate', color: '#a0722e' },
              { label: 'Elevated', color: '#c45d3a' },
              { label: 'High', color: '#8b2e23' },
            ].map(({ label, color }) => (
              <span key={label} style={{ fontSize: '0.75rem', color, fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ width: 12, height: 3, background: color, borderRadius: 2, display: 'inline-block' }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Escalation */}
      {escalation.triggered && (
        <div className="card animate-in animate-in-delay-3" style={{
          marginTop: '1.25rem',
          borderLeft: '4px solid var(--risk-high)',
          background: 'var(--risk-high-bg)',
        }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.65rem', color: 'var(--risk-high)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>⚠</span> Escalation Reasons
          </h2>
          <ul style={{ margin: '0 0 0.65rem', paddingLeft: '1.2rem' }}>
            {(escalation.triggerReasons ?? []).map((r) => (
              <li key={r.code} style={{ marginBottom: '0.35rem', fontSize: '0.9rem', lineHeight: 1.5 }}>{r.label}</li>
            ))}
          </ul>
          <div style={{ padding: '0.6rem 0.85rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
            Priority-adjusted score: <strong style={{ color: 'var(--ink)' }}>{escalation.priorityAdjustedScore}</strong> (threshold: {escalation.threshold}).
            Priority weight: <strong style={{ color: 'var(--ink)' }}>{escalation.priorityLabel}</strong>.
          </div>
        </div>
      )}

      {/* Interventions */}
      {interventions.length > 0 && (
        <div className="card animate-in animate-in-delay-3" style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>Recommended Interventions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {interventions.map((intervention) => (
              <div key={intervention.code} style={{
                padding: '0.85rem 1rem',
                background: 'var(--surface)',
                border: '1px solid var(--line-faint)',
                borderRadius: 'var(--radius)',
                borderLeft: intervention.urgency === 'immediate'
                  ? '3px solid var(--risk-high)'
                  : intervention.urgency === 'this_week'
                    ? '3px solid var(--risk-moderate)'
                    : '3px solid var(--risk-low)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <strong style={{ fontSize: '0.9rem' }}>{intervention.label}</strong>
                  <span style={{
                    fontSize: '0.72rem',
                    padding: '0.15rem 0.55rem',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    background: intervention.urgency === 'immediate'
                      ? 'var(--risk-high-bg)'
                      : intervention.urgency === 'this_week'
                        ? 'var(--risk-moderate-bg)'
                        : 'var(--risk-low-bg)',
                    color: intervention.urgency === 'immediate'
                      ? 'var(--risk-high)'
                      : intervention.urgency === 'this_week'
                        ? 'var(--risk-moderate)'
                        : 'var(--risk-low)',
                  }}>
                    {intervention.urgency === 'immediate' ? 'Immediate' : intervention.urgency === 'this_week' ? 'This week' : 'Next review'}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  {intervention.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Explainability */}
      {drivers.length > 0 && (
        <div className="card animate-in animate-in-delay-3" style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.5rem' }}>What drove this score</h2>
          <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: 'var(--ink-soft)' }}>
            {explanation.headline}
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {drivers.map((d, i) => (
              <div key={d.component} className="driver-card" style={{ animationDelay: `${i * 0.05}s` }}>
                <div className="driver-header">
                  <strong>{d.label}</strong>
                  <span className="driver-value">{d.contribution} pts ({d.sharePct}%)</span>
                </div>
                <p className="driver-detail">{d.detail}</p>
              </div>
            ))}
          </div>

          {/* Signal Phrases */}
          {(explanation.signalPhrases ?? []).length > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'var(--warm-pale)', borderRadius: 'var(--radius)', border: '1px solid rgba(184, 134, 11, 0.12)' }}>
              <p style={{ margin: '0 0 0.4rem', fontSize: '0.75rem', color: 'var(--ink-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Person's own words
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {explanation.signalPhrases.map((phrase, i) => (
                  <span key={i} className="phrase-tag">"{phrase}"</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Check-in History */}
      <div className="card animate-in animate-in-delay-4" style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Check-in History</h2>
          <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
            <span>✓ {completedCount} completed</span>
            {missedCount > 0 && <span style={{ color: 'var(--risk-moderate)' }}>✗ {missedCount} missed</span>}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {checkIns.map((c) => (
            <CheckInCard key={c.id} checkIn={c} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckInCard({ checkIn: c }) {
  const [expanded, setExpanded] = useState(false);
  const isMissed = c.status === 'missed';
  const assessment = c.assessment;

  return (
    <div
      style={{
        padding: '0.85rem 1rem',
        border: `1px solid ${isMissed ? 'var(--line)' : 'var(--line-faint)'}`,
        borderRadius: 'var(--radius)',
        background: isMissed ? 'var(--surface-sunken)' : 'var(--surface)',
        cursor: 'pointer',
        transition: 'all var(--duration) var(--ease-out)',
        borderLeft: assessment?.escalation?.triggered ? '3px solid var(--risk-high)' : undefined,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: isMissed ? 'var(--surface-deep)' : 'var(--accent-pale)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: isMissed ? 'var(--ink-muted)' : 'var(--accent)',
          }}>
            {isMissed ? '—' : c.sequence}
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              {c.channel} · {c.locale === 'hi' ? 'Hindi' : 'English'}
            </span>
            {isMissed && (
              <span style={{ fontSize: '0.75rem', color: 'var(--risk-moderate)', fontWeight: 600, marginLeft: '0.5rem' }}>
                Missed
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {assessment && (
            <span className={`band-badge ${BAND_CLASS[assessment.band] ?? ''}`} style={{ fontSize: '0.72rem', padding: '0.15rem 0.55rem' }}>
              {assessment.score}
            </span>
          )}
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
            {new Date(c.occurredAt).toLocaleDateString()}
          </span>
          <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
            {expanded ? '▾' : '▸'}
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--line-faint)' }}>
          {c.turns && c.turns.length > 0 && (
            <div style={{ marginBottom: '0.85rem' }}>
              {c.turns.map((t, i) => (
                <div key={i} className={`chat-bubble ${t.speaker === 'system' ? 'system' : 'person'}`} style={{ marginBottom: '0.4rem', maxWidth: '100%' }}>
                  {t.text}
                </div>
              ))}
            </div>
          )}

          {c.signals && c.signals.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Signals: </span>
              {c.signals.map((s) => (
                <span key={s} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', background: 'var(--accent-pale)', borderRadius: 'var(--radius-full)', marginRight: '0.3rem', color: 'var(--accent)' }}>
                  {s.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}

          {c.signalPhrases && c.signalPhrases.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Own words: </span>
              {c.signalPhrases.map((p, i) => (
                <span key={i} className="phrase-tag" style={{ marginRight: '0.3rem' }}>"{p}"</span>
              ))}
            </div>
          )}

          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', display: 'flex', gap: '0.75rem' }}>
            <span>{c.wordCount} words</span>
            <span>{c.responseLatencyHours != null ? `${c.responseLatencyHours}h latency` : 'no reply'}</span>
            {c.surfaceSentimentCarriedForward && <span style={{ color: 'var(--risk-moderate)' }}>(carried forward)</span>}
          </div>

          {assessment?.explanation?.drivers && (
            <div style={{ marginTop: '0.65rem', padding: '0.6rem 0.75rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}>
              <strong style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Drivers: </strong>
              {assessment.explanation.drivers.map((d, i) => (
                <span key={d.component}>
                  {d.label} ({d.contribution} pts){i < assessment.explanation.drivers.length - 1 ? ' · ' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
