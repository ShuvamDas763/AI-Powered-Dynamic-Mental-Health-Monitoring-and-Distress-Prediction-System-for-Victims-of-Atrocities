import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Area, AreaChart, ReferenceDot,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { api } from './api.js';
import { IconClock, IconAlert } from './GovernmentBranding.jsx';

const BAND_CLASS = { low: 'band-low', moderate: 'band-moderate', elevated: 'band-elevated', high: 'band-high' };
const STAGE_LABELS = { investigation: 'Investigation', trial_active: 'Trial (active)', trial_pending: 'Trial (pending)', chargesheet_filed: 'Chargesheet filed', post_compensation: 'Post-compensation' };
const BAND_COLORS = { low: '#4a7c59', moderate: '#a0722e', elevated: '#c45d3a', high: '#8b2e23' };

/**
 * Custom dot that flags non-comparable segments. When channel or locale changed
 * between consecutive check-ins, the dot shows a warning indicator so the
 * counsellor knows the score change may reflect a different measurement context,
 * not a real change in the person's state.
 */
const ComparabilityDot = (props) => {
  const { cx, cy, payload } = props;
  if (payload?.comparable) {
    return (
      <circle cx={cx} cy={cy} r={5} fill="#1a3a42" stroke="#fff" strokeWidth={2} />
    );
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#fff" stroke="#a0722e" strokeWidth={2} strokeDasharray="3 2" />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={10} fill="#a0722e" fontWeight={700}>≠</text>
    </g>
  );
};

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

const LIFECYCLE_STAGES = [
  { id: 'registration', label: 'Registration', desc: 'FIR & Portal Onboarding' },
  { id: 'investigation', label: 'Investigation', desc: 'DySP Inquiry & Evidence' },
  { id: 'trial', label: 'Trial', desc: 'Special Court Hearings' },
  { id: 'compensation', label: 'Compensation', desc: 'Statutory Relief Disbursal' },
  { id: 'rehabilitation', label: 'Rehabilitation', desc: 'Socio-economic Support' },
  { id: 'closure', label: 'Closure', desc: 'Resolution & Monitoring End' },
];

function getStageIndex(stage) {
  switch (stage) {
    case 'registration': return 0;
    case 'investigation': return 1;
    case 'chargesheet_filed':
    case 'trial_pending':
    case 'trial_active': return 2;
    case 'post_compensation': return 3;
    case 'rehabilitation': return 4;
    case 'closure': return 5;
    default: return 1;
  }
}

export default function CaseDetail({ caseId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [interventionsList, setInterventionsList] = useState([]);
  const [actionBusy, setActionBusy] = useState(false);

  const loadInterventions = useCallback(async (cId) => {
    try {
      const { ok, body } = await api(`/counsellor/cases/${cId}/interventions`);
      if (ok && body.interventions) {
        setInterventionsList(body.interventions);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    api(`/counsellor/cases/${caseId}`).then(({ body }) => {
      setData(body);
      setLoading(false);
    });
    loadInterventions(caseId);
  }, [caseId, loadInterventions]);

  async function handleInterventionAction(interventionId, action, params = {}) {
    setActionBusy(true);
    try {
      await api(`/counsellor/cases/${caseId}/interventions/${interventionId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, ...params }),
      });
      await loadInterventions(caseId);
      // Also refresh case detail
      const { body } = await api(`/counsellor/cases/${caseId}`);
      setData(body);
    } catch { /* ignore */ }
    setActionBusy(false);
  }

  // Hooks must be called unconditionally — before any early returns.
  const copySummary = useCallback(() => {
    if (!data?.caseRecord) return;
    const { caseRecord: cr, checkIns: ci, latest: la } = data;
    const esc = la?.escalation ?? {};
    const drvs = la?.explanation?.drivers ?? [];
    const ints = la?.interventions ?? [];
    const lines = [
      `Case: ${cr.pseudonym} (${cr.caseId})`,
      `Score: ${la?.score} (${la?.band})`,
      `Stage: ${STAGE_LABELS[cr.caseStage] ?? cr.caseStage}`,
      `Escalated: ${esc.triggered ? 'Yes' : 'No'}`,
      `Check-ins: ${ci.length}`,
      `Location: ${cr.district}, ${cr.state}`,
    ];
    if (drvs.length > 0) lines.push(`Drivers: ${drvs.map(d => d.label).join(', ')}`);
    if (ints.length > 0) lines.push(`Interventions: ${ints.map(i => i.label).join(', ')}`);
    navigator.clipboard?.writeText(lines.join('\n'));
  }, [data]);

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
  const prediction = latestAssessment?.prediction ?? {};
  const emotions = latestAssessment?.emotions ?? {};
  const explanation = latestAssessment?.explanation ?? {};
  const drivers = explanation.drivers ?? [];
  const interventions = latestAssessment?.interventions ?? [];

  // Flag segments where channel or locale changed — not directly comparable.
  const chartData = trendData.map((p, i) => {
    const prev = i > 0 ? trendData[i - 1] : null;
    const comparable = !prev || (p.channel === prev.channel && p.locale === prev.locale);
    return {
      ...p,
      label: `#${p.checkInNumber}`,
      comparable,
    };
  });

  const nonComparableCount = chartData.filter((p) => !p.comparable).length;

  const completedCount = checkIns.filter((c) => c.status === 'completed').length;
  const missedCount = checkIns.filter((c) => c.status === 'missed').length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button className="back-link animate-in" onClick={onBack}>&larr; Back to cases</button>
        <button className="btn-copy animate-in" onClick={copySummary}>📋 Copy Summary</button>
      </div>

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

      {/* Case Lifecycle Timeline Stepper */}
      <div className="card animate-in animate-in-delay-1" style={{ marginTop: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Statutory Case Lifecycle (SC/ST PoA Act)</h2>
          <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
            Current Stage: <strong style={{ color: 'var(--accent)' }}>{STAGE_LABELS[caseRecord.caseStage] || caseRecord.caseStage}</strong>
          </span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative', overflowX: 'auto', paddingBottom: '0.5rem', gap: '0.5rem' }}>
          {LIFECYCLE_STAGES.map((stg, i) => {
            const currentIdx = getStageIndex(caseRecord.caseStage);
            const isPast = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <div key={stg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, minWidth: 95, textAlign: 'center' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: isPast ? 'var(--risk-low)' : isCurrent ? 'var(--accent)' : 'var(--surface-sunken)',
                  color: isPast || isCurrent ? '#fff' : 'var(--ink-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.4rem',
                  border: isCurrent ? '2px solid var(--surface)' : 'none',
                  boxShadow: isCurrent ? '0 0 0 2px var(--accent)' : 'none',
                }}>
                  {isPast ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: isCurrent ? 700 : 600, color: isCurrent ? 'var(--ink)' : 'var(--ink-soft)' }}>
                  {stg.label}
                </span>
                <span style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', marginTop: '0.15rem', lineHeight: 1.3 }}>
                  {stg.desc}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Emotions — radar chart + detail pills */}
      {emotions.emotions && (
        <div className="card animate-in animate-in-delay-2" style={{ marginTop: '1.25rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.75rem' }}>Emotion Profile</h2>

          {/* Radar chart — all 6 emotions, detected ones highlighted */}
          {(() => {
            const ALL_EMOTIONS = [
              { code: 'fear', label: 'Fear', weight: 0.9 },
              { code: 'anger', label: 'Anger', weight: 0.7 },
              { code: 'sadness', label: 'Sadness', weight: 0.6 },
              { code: 'hopelessness', label: 'Hopelessness', weight: 0.85 },
              { code: 'fatigue', label: 'Fatigue', weight: 0.5 },
              { code: 'withdrawal', label: 'Withdrawal', weight: 0.65 },
            ];
            const detected = emotions.emotions || [];
            const radarData = ALL_EMOTIONS.map((e) => {
              const match = detected.find((d) => d.code === e.code);
              return { emotion: e.label, value: match ? Math.round(match.intensity * 100) : 0 };
            });

            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 280px', minWidth: 280 }}>
                  <ResponsiveContainer width="100%" height={260}>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                      <PolarGrid stroke="var(--line-faint)" />
                      <PolarAngleAxis
                        dataKey="emotion"
                        tick={{ fontSize: 12, fill: 'var(--ink-soft)', fontWeight: 600 }}
                      />
                      <PolarRadiusAxis
                        angle={30}
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: 'var(--ink-faint)' }}
                        axisLine={false}
                      />
                      <Radar
                        name="Emotion"
                        dataKey="value"
                        stroke="var(--accent)"
                        fill="var(--accent)"
                        fillOpacity={0.25}
                        strokeWidth={2}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>

                {/* Detected emotion pills with quotes */}
                <div style={{ flex: '1 1 300px', minWidth: 300 }}>
                  {detected.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                      {detected.map((emotion) => (
                        <div key={emotion.code} style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.65rem 0.85rem', borderRadius: 'var(--radius)',
                          border: '1px solid var(--line-faint)', background: 'var(--surface)',
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.75rem', fontWeight: 700, color: '#fff',
                            background: emotion.intensity > 0.8 ? 'var(--risk-high)'
                              : emotion.intensity > 0.6 ? 'var(--risk-elevated)'
                              : 'var(--risk-moderate)',
                          }}>
                            {Math.round(emotion.intensity * 100)}%
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{emotion.label}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                              "{emotion.matchedText}"
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--ink-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '2rem' }}>
                      No specific emotions detected from this check-in.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {emotions.primaryEmotion && (
            <div style={{
              marginTop: '0.85rem', padding: '0.5rem 0.75rem',
              background: 'var(--accent-pale)', borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 500,
            }}>
              Primary emotion: <strong>{emotions.primaryEmotion}</strong>
            </div>
          )}
        </div>
      )}

      {/* Early-Warning Trajectory Engine */}
      {prediction.predicted && (
        <div className="card animate-in animate-in-delay-2" style={{
          marginTop: '1.25rem',
          borderLeft: `4px solid ${prediction.courtDateRisk || (prediction.projectedWindow?.minDays <= 14) ? 'var(--risk-high)' : 'var(--risk-moderate)'}`,
          background: prediction.courtDateRisk || (prediction.projectedWindow?.minDays <= 14)
            ? 'var(--risk-high-bg)'
            : 'var(--risk-moderate-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
            <div className={`section-icon ${prediction.courtDateRisk || (prediction.projectedWindow?.minDays <= 14) ? 'section-icon-high' : 'section-icon-moderate'}`}>
              <IconClock size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{
                    fontSize: '1.08rem',
                    margin: '0 0 0.25rem',
                    color: prediction.courtDateRisk || (prediction.projectedWindow?.minDays <= 14) ? 'var(--risk-high)' : 'var(--risk-moderate)',
                  }}>
                    Early-Warning Trajectory Projection
                  </h2>
                  <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                    Empirical trajectory model based on {prediction.observationCount || checkIns.length} actual check-in observations over {prediction.observationWindowDays || 30} days
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.74rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
                    background: prediction.evidenceQuality === 'robust' ? 'var(--risk-low-bg)' : prediction.evidenceQuality === 'moderate' ? 'var(--risk-moderate-bg)' : 'var(--accent-pale)',
                    color: prediction.evidenceQuality === 'robust' ? 'var(--risk-low)' : prediction.evidenceQuality === 'moderate' ? 'var(--risk-moderate)' : 'var(--accent)',
                    fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    Evidence: {prediction.evidenceQuality || 'moderate'}
                  </span>
                  <span style={{
                    fontSize: '0.74rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
                    background: 'var(--surface)', color: 'var(--ink)', fontWeight: 600,
                  }}>
                    Confidence: {prediction.confidence || 'medium'}
                  </span>
                </div>
              </div>

              {/* Bounded Window Display */}
              <div style={{ marginTop: '0.85rem', padding: '0.75rem 1rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-faint)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Projected Escalation Window
                    </div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
                      {prediction.projectedWindow?.windowText || `${prediction.estimatedDaysToThreshold} days`}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
                      Estimated Range: {prediction.projectedWindow?.estimatedDateRange || prediction.estimatedDate}
                    </div>
                  </div>

                  {prediction.courtDateRisk && (
                    <div style={{
                      padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)',
                      background: 'var(--risk-high-bg)', border: '1px solid var(--risk-high)',
                      color: 'var(--risk-high)', fontSize: '0.8rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                    }}>
                      <IconAlert size={16} />
                      <span>Court Date Overlap: Scheduled hearing falls within trajectory window!</span>
                    </div>
                  )}
                </div>

                <p style={{ margin: '0.65rem 0 0', fontSize: '0.84rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                  {prediction.reasoning}
                </p>
              </div>

              {/* Institutional Disclaimer */}
              <div style={{ marginTop: '0.65rem', padding: '0.5rem 0.75rem', background: 'rgba(0,0,0,0.03)', borderRadius: 'var(--radius-xs)', fontSize: '0.72rem', color: 'var(--ink-muted)', lineHeight: 1.45 }}>
                ⚠️ <strong>Methodological Disclaimer:</strong> {prediction.disclaimer || 'Empirical trajectory projection based on synthetic demonstration check-ins. This is an operational early-warning heuristic, NOT a psychiatric diagnosis or clinical prognosis.'}
              </div>
            </div>
          </div>
        </div>
      )}

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
                dot={<ComparabilityDot />}
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
          {nonComparableCount > 0 && (
            <div style={{
              marginTop: '0.65rem',
              padding: '0.5rem 0.75rem',
              background: 'var(--warm-pale)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.78rem',
              color: 'var(--ink-soft)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
            }}>
              <span style={{ color: '#a0722e', fontWeight: 700 }}>≠</span>
              <span>
                {nonComparableCount} segment{nonComparableCount > 1 ? 's' : ''} used a different channel or language and are marked as not directly comparable.
              </span>
            </div>
          )}
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

      {/* Closed-Loop Intervention Lifecycle Manager */}
      {(() => {
        const displayList = interventionsList.length > 0 ? interventionsList : interventions;
        if (!displayList || displayList.length === 0) return null;

        const STATUS_BADGE_STYLE = {
          RECOMMENDED: { bg: 'var(--surface-sunken)', color: 'var(--ink-muted)' },
          ACCEPTED: { bg: 'rgba(49, 130, 206, 0.12)', color: '#3182ce' },
          ASSIGNED: { bg: 'rgba(128, 90, 213, 0.12)', color: '#805ad5' },
          CONTACT_ATTEMPTED: { bg: 'rgba(214, 158, 46, 0.12)', color: '#d69e2e' },
          CONTACTED: { bg: 'rgba(49, 151, 149, 0.12)', color: '#319795' },
          IN_PROGRESS: { bg: 'rgba(221, 107, 32, 0.12)', color: '#dd6b20' },
          COMPLETED: { bg: 'rgba(74, 124, 89, 0.14)', color: 'var(--risk-low)' },
          CLOSED: { bg: 'var(--surface-deep)', color: 'var(--ink-muted)' },
        };

        return (
          <div className="card animate-in animate-in-delay-3" style={{ marginTop: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.05rem', margin: '0 0 0.2rem' }}>Closed-Loop Support Interventions</h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                  Traceable human-in-the-loop lifecycle from recommendation to documented outcome
                </span>
              </div>
              {actionBusy && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Updating status…</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {displayList.map((item) => {
                const status = item.status || 'RECOMMENDED';
                const badge = STATUS_BADGE_STYLE[status] || STATUS_BADGE_STYLE.RECOMMENDED;

                return (
                  <div key={item.id || item.code} style={{
                    padding: '0.95rem 1.1rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--line-faint)',
                    borderRadius: 'var(--radius)',
                    borderLeft: item.urgency === 'immediate'
                      ? '4px solid var(--risk-high)'
                      : item.urgency === 'this_week'
                        ? '4px solid var(--risk-moderate)'
                        : '4px solid var(--risk-low)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.92rem' }}>{item.label}</strong>
                        {item.assignedTo && (
                          <span style={{ marginLeft: '0.6rem', fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                            Assigned to: <strong>{item.assignedTo}</strong>
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.55rem',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: badge.bg,
                          color: badge.color,
                        }}>
                          {status.replace(/_/g, ' ')}
                        </span>

                        <span style={{
                          fontSize: '0.7rem',
                          padding: '0.15rem 0.55rem',
                          borderRadius: 'var(--radius-full)',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                          background: item.urgency === 'immediate'
                            ? 'var(--risk-high-bg)'
                            : item.urgency === 'this_week'
                              ? 'var(--risk-moderate-bg)'
                              : 'var(--risk-low-bg)',
                          color: item.urgency === 'immediate'
                            ? 'var(--risk-high)'
                            : item.urgency === 'this_week'
                              ? 'var(--risk-moderate)'
                              : 'var(--risk-low)',
                        }}>
                          {item.urgency === 'immediate' ? 'Immediate' : item.urgency === 'this_week' ? 'This week' : 'Next review'}
                        </span>
                      </div>
                    </div>

                    <p style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                      {item.description}
                    </p>

                    {/* Outcome tag if resolved or completed */}
                    {item.outcome && (
                      <div style={{ marginBottom: '0.65rem', fontSize: '0.76rem', color: 'var(--risk-low)', fontWeight: 600 }}>
                        ✓ Documented Outcome: <span style={{ textTransform: 'capitalize' }}>{item.outcome.replace(/_/g, ' ')}</span>
                      </div>
                    )}

                    {/* Action buttons based on status */}
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', borderTop: '1px dashed var(--line-faint)', paddingTop: '0.55rem' }}>
                      {status === 'RECOMMENDED' && (
                        <>
                          <button
                            className="btn btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id || item.code, 'accept')}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                          >
                            ✓ Accept Action
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id || item.code, 'close', { outcome: 'declined' })}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem', color: 'var(--ink-muted)' }}
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {status === 'ACCEPTED' && (
                        <button
                          className="btn btn-sm"
                          disabled={actionBusy}
                          onClick={() => handleInterventionAction(item.id || item.code, 'assign', { assignedTo: 'District Welfare Officer' })}
                          style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                        >
                          Assign Welfare Officer
                        </button>
                      )}

                      {status === 'ASSIGNED' && (
                        <>
                          <button
                            className="btn btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id || item.code, 'mark_contacted')}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                          >
                            Confirm Contacted
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id || item.code, 'attempt_contact')}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                          >
                            Log Contact Attempt
                          </button>
                        </>
                      )}

                      {(status === 'CONTACTED' || status === 'CONTACT_ATTEMPTED') && (
                        <>
                          <button
                            className="btn btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id || item.code, 'start')}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                          >
                            Begin Support Plan
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id || item.code, 'complete', { outcome: 'stabilized' })}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                          >
                            Mark Stabilized
                          </button>
                        </>
                      )}

                      {status === 'IN_PROGRESS' && (
                        <>
                          <button
                            className="btn btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id || item.code, 'complete', { outcome: 'resolved' })}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem', background: 'var(--risk-low)', borderColor: 'var(--risk-low)' }}
                          >
                            ✓ Mark Resolved
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id || item.code, 'complete', { outcome: 'stabilized' })}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                          >
                            Mark Stabilized
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id || item.code, 'close', { outcome: 'transferred' })}
                            style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                          >
                            Transfer Unit
                          </button>
                        </>
                      )}

                      {status === 'COMPLETED' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={actionBusy}
                          onClick={() => handleInterventionAction(item.id || item.code, 'close', { outcome: item.outcome || 'resolved' })}
                          style={{ fontSize: '0.74rem', padding: '0.2rem 0.6rem' }}
                        >
                          Archive & Close Case Action
                        </button>
                      )}

                      {status === 'CLOSED' && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                          Intervention cycle completed & archived.
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

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

          <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <span>{c.wordCount} words</span>
            <span>{c.responseLatencyHours != null ? `${c.responseLatencyHours}h latency` : 'no reply'}</span>
            {c.surfaceSentimentCarriedForward && <span style={{ color: 'var(--risk-moderate)' }}>(carried forward)</span>}
            {c.consentAcknowledged && <span style={{ color: 'var(--risk-low)' }}>✓ consent</span>}
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
