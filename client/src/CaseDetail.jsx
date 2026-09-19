/**
 * CaseDetail — Flagship Internal Human Casework Cockpit.
 *
 * Implements Sections 36–42 & Creative Quality Gate:
 * Within 5 seconds, an authorized counsellor understands:
 *   1. WHO?
 *   2. WHY?
 *   3. WHAT CHANGED?
 *   4. WHAT SHOULD I DO?
 *   5. WHEN?
 *
 * Structured Layout:
 * - Top: Case Identity & 5-Second Clarity Triage Ribbon
 * - 3-Column Core:
 *     LEFT: Statutory Case Journey Stepper & Emotion Profile
 *     CENTER: Longitudinal Well-being Trajectory (Human Journey Chart) & History
 *     RIGHT: "Why This Case Is Here" Expandable Explainable Signals
 * - Below: Care Horizon Engine & Support Handoff Thread
 * - Below: Closed-Loop Intervention Workflow (Actual Backend State Machine)
 */

import { useEffect, useState, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Area, AreaChart,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { api } from './api.js';
import {
  IconClock,
  IconAlert,
  IconArrowLeft,
  IconCheck,
  IconShield,
  IconFile,
  IconUser,
  IconCase,
} from './GovernmentBranding.jsx';

const BAND_CLASS = { low: 'band-low', moderate: 'band-moderate', elevated: 'band-elevated', high: 'band-high' };
const STAGE_LABELS = {
  investigation: 'Investigation',
  trial_active: 'Proceedings (active)',
  trial_pending: 'Proceedings (pending)',
  chargesheet_filed: 'Chargesheet filed',
  post_compensation: 'Post-compensation',
};
const BAND_COLORS = { low: '#2D5A46', moderate: '#855208', elevated: '#A34226', high: '#9A1F1F' };

const TRIGGER_LABELS = {
  intimidation_on_witness_case: 'Reported intimidation signal on active witness docket',
  sustained_surface_mismatch: 'Surface reassuring words but declining participation (deflection)',
  threshold_crossed: 'Crossed support-review threshold',
  immediate_review_requested: 'Complainant directly requested counsellor contact',
  rapid_escalation: 'Rapid velocity escalation in distress signals',
};

function formatTriggerReason(r) {
  if (!r) return '';
  if (typeof r === 'object') return r.label || r.code || JSON.stringify(r);
  return TRIGGER_LABELS[r] || r.replace(/_/g, ' ');
}

/**
 * Custom dot that flags non-comparable segments when channel or locale changed.
 */
const ComparabilityDot = (props) => {
  const { cx, cy, payload } = props;
  if (payload?.comparable) {
    return (
      <circle cx={cx} cy={cy} r={5} fill="#8B321D" stroke="#ffffff" strokeWidth={2} />
    );
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill="#ffffff" stroke="#855208" strokeWidth={2} strokeDasharray="3 2" />
      <text x={cx} y={cy - 12} textAnchor="middle" fontSize={10} fill="#855208" fontWeight={700}>≠</text>
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid var(--line)',
      borderRadius: 'var(--radius-md)',
      padding: '0.65rem 0.85rem',
      boxShadow: 'var(--shadow-md)',
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: '0.2rem' }}>
        Check-in #{item.checkInNumber} ({item.channel})
      </div>
      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
        {item.score} <span style={{ fontSize: '0.75rem', fontWeight: 600, color: BAND_COLORS[item.band] || 'var(--ink)' }}>({item.band})</span>
      </div>
    </div>
  );
};

const LIFECYCLE_STAGES = [
  { id: 'registration', label: 'Registration', desc: 'FIR & Portal Onboarding' },
  { id: 'investigation', label: 'Investigation', desc: 'DySP Inquiry & Witness Protection' },
  { id: 'trial', label: 'Proceedings', desc: 'Special Court Hearings' },
  { id: 'compensation', label: 'Compensation', desc: 'Statutory Relief Disbursal' },
  { id: 'rehabilitation', label: 'Rehabilitation', desc: 'Socio-economic Continuity' },
  { id: 'closure', label: 'Closure', desc: 'Resolution & Long-term Stability' },
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
  const [expandedSignals, setExpandedSignals] = useState({});

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
      const { body } = await api(`/counsellor/cases/${caseId}`);
      setData(body);
    } catch { /* ignore */ }
    setActionBusy(false);
  }

  async function handleResolveAlert(alertId, note = 'Reviewed and addressed by counsellor') {
    try {
      await api(`/counsellor/operational-alerts/${alertId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      const { body } = await api(`/counsellor/cases/${caseId}`);
      setData(body);
    } catch { /* ignore */ }
  }

  const copySummary = useCallback(() => {
    if (!data?.caseRecord) return;
    const { caseRecord: cr, checkIns: ci, latest: la } = data;
    const esc = la?.escalation ?? {};
    const drvs = la?.explanation?.drivers ?? [];
    const ints = la?.interventions ?? [];
    const lines = [
      `Case Docket: ${cr.pseudonym} (${cr.caseId})`,
      `Distress Priority: ${la?.score} (${la?.band})`,
      `Stage: ${STAGE_LABELS[cr.caseStage] ?? cr.caseStage}`,
      `Escalated: ${esc.triggered ? 'Yes' : 'No'}`,
      `Check-ins: ${ci.length}`,
      `District: ${cr.district}, ${cr.state}`,
    ];
    if (drvs.length > 0) lines.push(`Key Signals: ${drvs.map((d) => d.label).join(', ')}`);
    if (ints.length > 0) lines.push(`Interventions: ${ints.map((i) => i.label).join(', ')}`);
    navigator.clipboard?.writeText(lines.join('\n'));
  }, [data]);

  const toggleSignal = (key) => {
    setExpandedSignals((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (loading) {
    return (
      <div>
        <button className="back-link" onClick={onBack}>
          <IconArrowLeft size={16} /> Back to cases
        </button>
        <div className="card" style={{ height: 160, background: 'var(--surface-sunken)', marginBottom: '1.25rem' }} />
        <div className="card" style={{ height: 240, background: 'var(--surface-sunken)' }} />
      </div>
    );
  }

  if (!data || !data.caseRecord) {
    return (
      <div className="empty-state">
        <div className="empty-state-title">Case Docket Not Found</div>
        <div className="empty-state-desc">
          The requested case identifier ({caseId}) does not exist in the active registry.
        </div>
        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={onBack}>
            <IconArrowLeft size={14} /> Return to Casework Queue
          </button>
        </div>
      </div>
    );
  }

  const { caseRecord, checkIns, trendData, latest } = data;
  const latestAssessment = latest;
  const escalation = latestAssessment?.escalation ?? {};
  const prediction = latestAssessment?.prediction ?? {};
  const emotions = latestAssessment?.emotions ?? {};
  const explanation = latestAssessment?.explanation ?? {};
  const drivers = explanation.drivers ?? [];
  const interventions = latestAssessment?.interventions ?? [];
  const trend = latestAssessment?.trend ?? {};
  const mismatch = latestAssessment?.mismatch ?? {};
  const operationalAlerts = data.operationalAlerts ?? [];
  const activeOperationalAlerts = operationalAlerts.filter((a) => a.status === 'active');

  // Chart data with comparability flags
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
      {/* Top Nav: Back to Queue & Copy Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button className="back-link animate-in" onClick={onBack} style={{ margin: 0 }}>
          <IconArrowLeft size={16} /> Back to Casework Queue
        </button>
        <button
          className="btn btn-secondary btn-sm animate-in"
          onClick={copySummary}
          style={{ gap: '0.45rem' }}
        >
          <IconFile size={14} /> Copy Case Docket Summary
        </button>
      </div>

      {/* Case Identity Hero Header */}
      <div className="card card-elevated animate-in animate-in-delay-1" style={{
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `5px solid ${escalation.triggered ? 'var(--risk-high)' : 'var(--accent)'}`,
        background: 'var(--surface)',
        marginBottom: '1.25rem',
        padding: '1.5rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.2rem' }}>
              SC/ST Protection Casework Docket
            </div>
            <h1 style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.1rem)', margin: '0 0 0.35rem', fontFamily: 'var(--font-display)' }}>
              {caseRecord.pseudonym}
            </h1>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
              {caseRecord.caseId} · {caseRecord.district}, {caseRecord.state} · Stage: <strong>{STAGE_LABELS[caseRecord.caseStage] ?? caseRecord.caseStage}</strong> ({caseRecord.monthsSinceRegistration} months active)
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span className={`band-badge ${BAND_CLASS[latestAssessment?.band] ?? ''}`} style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }}>
              {latestAssessment?.band} Support Priority
            </span>
            <div style={{ fontSize: '2.2rem', fontWeight: 700, marginTop: '0.15rem', lineHeight: 1, fontFamily: 'var(--font-display)', color: 'var(--ink)' }}>
              {latestAssessment?.score ?? '—'}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Support Priority Index
            </div>
          </div>
        </div>

        {caseRecord.contextNote && (
          <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--surface-sunken)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--line-faint)' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Docket Note: </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--ink-soft)', fontStyle: 'italic' }}>"{caseRecord.contextNote}"</span>
          </div>
        )}
      </div>

      {/* Active Operational Review Alerts Banner (if any) */}
      {activeOperationalAlerts.length > 0 && (
        <div className="card animate-in" style={{
          marginBottom: '1.25rem',
          borderLeft: '4px solid var(--accent)',
          background: 'var(--surface)',
        }}>
          <h3 style={{ fontSize: '0.96rem', margin: '0 0 0.65rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink)' }}>
            <span>🔔</span> Active Operational Alerts ({activeOperationalAlerts.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
            {activeOperationalAlerts.map((alert) => (
              <div key={alert.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.65rem 0.85rem',
                background: 'var(--surface-sunken)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line-faint)',
                gap: '1rem',
                flexWrap: 'wrap',
              }}>
                <div>
                  <strong style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>{alert.reason ?? 'Case requires operational follow-up'}</strong>
                  <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', marginTop: '0.15rem' }}>
                    Triggered: {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : 'Recent'}
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleResolveAlert(alert.id)}
                >
                  Resolve Alert
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 5-SECOND CLARITY TRIAGE RIBBON (WHO, WHY, WHAT CHANGED, WHAT TO DO, WHEN) ═══ */}
      <div className="card card-elevated animate-in animate-in-delay-1" style={{ marginBottom: '1.5rem', padding: '1.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--line-faint)', paddingBottom: '0.65rem' }}>
          <div>
            <strong style={{ fontSize: '0.98rem', color: 'var(--ink)' }}>Counsellor Triage: 5 Core Decision Factors</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Essential human-in-the-loop answers for immediate decision-support</div>
          </div>
          <span style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '0.2rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            background: escalation.triggered ? 'var(--risk-high-bg)' : 'var(--risk-low-bg)',
            color: escalation.triggered ? 'var(--risk-high)' : 'var(--risk-low)',
            textTransform: 'uppercase',
          }}>
            {escalation.triggered ? 'Action Required' : 'Monitoring Active'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {/* 1. WHO? */}
          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              1. WHO?
            </div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--ink)' }}>{caseRecord.pseudonym}</strong>
            <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginTop: '0.2rem' }}>
              {caseRecord.district}, {caseRecord.state}
            </div>
          </div>

          {/* 2. WHY FLAGGED? */}
          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: escalation.triggered ? 'var(--risk-high)' : 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              2. WHY FLAGGED?
            </div>
            <strong style={{ fontSize: '0.85rem', color: escalation.triggered ? 'var(--risk-high)' : 'var(--ink)' }}>
              {escalation.triggered && escalation.triggerReasons?.length > 0
                ? escalation.triggerReasons.map((r) => formatTriggerReason(r)).join('; ')
                : explanation.headline || 'Routine support check-in.'}
            </strong>
          </div>

          {/* 3. WHAT CHANGED? */}
          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              3. WHAT CHANGED?
            </div>
            <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>
              Trend: <strong style={{ color: trend.direction === 'rising' ? 'var(--risk-high)' : trend.direction === 'improving' ? 'var(--risk-low)' : 'var(--ink)' }}>
                {trend.direction === 'rising' ? 'Concern rising' : trend.direction === 'improving' ? 'Improving' : 'Holding stable'}
              </strong> ({Math.abs(Math.round(trend.delta ?? 0))} pts shift).
            </div>
          </div>

          {/* 4. WHAT SHOULD I DO? */}
          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              4. WHAT TO DO?
            </div>
            {(() => {
              const displayList = interventionsList.length > 0 ? interventionsList : interventions;
              const pending = displayList?.find((i) => i.status === 'RECOMMENDED' || i.status === 'ACCEPTED') || displayList?.[0];
              if (!pending) return <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Continue regular monitoring cadence.</div>;
              return (
                <div style={{ fontSize: '0.82rem', color: 'var(--ink)' }}>
                  <strong>{pending.label}</strong>
                </div>
              );
            })()}
          </div>

          {/* 5. WHEN TO FOLLOW UP? */}
          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: prediction.courtDateRisk ? 'var(--risk-high)' : 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>
              5. WHEN TO FOLLOW UP?
            </div>
            <strong style={{ fontSize: '0.84rem', color: prediction.courtDateRisk ? 'var(--risk-high)' : 'var(--ink)' }}>
              {prediction.courtDateRisk
                ? '⚠️ Prior to Upcoming Court Date'
                : escalation.triggered
                  ? 'Within 24–48 Hours'
                  : 'Next Scheduled Review (Weekly)'}
            </strong>
          </div>
        </div>
      </div>

      {/* ═══ FLAGSHIP 3-COLUMN COCKPIT (JOURNEY / TRAJECTORY / SIGNALS) ═══ */}
      <div className="case-flagship-grid animate-in animate-in-delay-2" style={{ marginBottom: '1.5rem' }}>
        {/* ── LEFT COLUMN: STATUTORY CASE JOURNEY & EMOTION PROFILE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Statutory Case Journey */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.65rem' }}>
              Statutory Case Journey
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {LIFECYCLE_STAGES.map((stg, i) => {
                const currentIdx = getStageIndex(caseRecord.caseStage);
                const isPast = i < currentIdx;
                const isCurrent = i === currentIdx;

                return (
                  <div key={stg.id} style={{ display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      background: isPast ? 'var(--risk-low)' : isCurrent ? 'var(--accent)' : 'var(--surface-sunken)',
                      color: isPast || isCurrent ? '#FFFFFF' : 'var(--ink-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: '0.1rem',
                      boxShadow: isCurrent ? '0 0 0 2px var(--accent-pale)' : 'none',
                    }}>
                      {isPast ? '✓' : i + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: isCurrent ? 700 : 600, color: isCurrent ? 'var(--accent)' : 'var(--ink)' }}>
                        {stg.label} {isCurrent && '← active'}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', lineHeight: 1.3 }}>
                        {stg.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Emotion Profile Radar & Pills */}
          {emotions.emotions && (
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.65rem' }}>
                Expressed Emotion Profile
              </div>

              {(() => {
                const ALL_EMOTIONS = [
                  { code: 'fear', label: 'Fear' },
                  { code: 'anger', label: 'Anger' },
                  { code: 'sadness', label: 'Sadness' },
                  { code: 'hopelessness', label: 'Hopeless' },
                  { code: 'fatigue', label: 'Fatigue' },
                  { code: 'withdrawal', label: 'Isolation' },
                ];
                const detected = emotions.emotions || [];
                const radarData = ALL_EMOTIONS.map((e) => {
                  const match = detected.find((d) => d.code === e.code);
                  return { emotion: e.label, value: match ? Math.round(match.intensity * 100) : 0 };
                });

                return (
                  <div style={{ width: '100%', height: 190 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                        <PolarGrid stroke="var(--line-faint)" />
                        <PolarAngleAxis dataKey="emotion" tick={{ fontSize: 10, fill: 'var(--ink-muted)' }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                        <Radar dataKey="value" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                {(emotions.emotions || []).map((emo) => (
                  <div key={emo.code} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.35rem 0.55rem',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '0.76rem',
                  }}>
                    <span>{emo.label}</span>
                    <strong style={{ color: 'var(--accent)' }}>{Math.round(emo.intensity * 100)}%</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── CENTER COLUMN: LONGITUDINAL WELL-BEING TRAJECTORY (HUMAN JOURNEY) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <div>
                <strong style={{ fontSize: '0.98rem', color: 'var(--ink)' }}>Well-being Trajectory</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Longitudinal observation of check-ins across time</div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.74rem' }}>
                <span style={{ color: 'var(--risk-low)', fontWeight: 600 }}>● Low (0–30)</span>
                <span style={{ color: 'var(--risk-moderate)', fontWeight: 600 }}>● Mod (31–49)</span>
                <span style={{ color: 'var(--risk-high)', fontWeight: 600 }}>● High (70+)</span>
              </div>
            </div>

            {chartData.length >= 2 ? (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="distressGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--line-faint)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--ink-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <ReferenceLine y={31} stroke="var(--risk-moderate)" strokeDasharray="4 4" strokeWidth={1} />
                    <ReferenceLine y={70} stroke="var(--risk-high)" strokeDasharray="4 4" strokeWidth={1.5} />
                    <Area
                      type="monotone"
                      dataKey="score"
                      stroke="var(--accent)"
                      strokeWidth={2.5}
                      fill="url(#distressGradient)"
                      dot={<ComparabilityDot />}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                {nonComparableCount > 0 && (
                  <div style={{
                    marginTop: '0.65rem',
                    padding: '0.45rem 0.65rem',
                    background: 'var(--surface-sunken)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem',
                    color: 'var(--ink-muted)',
                  }}>
                    <strong style={{ color: 'var(--tertiary)' }}>≠ Notice:</strong> {nonComparableCount} check-in(s) used a different channel/locale. Shifts may reflect measurement context rather than change in state.
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--ink-muted)', fontSize: '0.88rem' }}>
                First baseline check-in recorded. Additional check-ins will establish the trajectory line.
              </div>
            )}
          </div>

          {/* Check-in History Accordion */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
              <strong style={{ fontSize: '0.9rem', color: 'var(--ink)' }}>Check-in History ({checkIns.length})</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                <span>✓ {completedCount} completed</span>
                {missedCount > 0 && <span style={{ marginLeft: '0.5rem', color: 'var(--risk-moderate)' }}>✗ {missedCount} missed</span>}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', maxHeight: 320, overflowY: 'auto' }}>
              {checkIns.map((c) => (
                <div key={c.id} style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-sunken)',
                  border: '1px solid var(--line-faint)',
                  borderLeft: c.assessment?.escalation?.triggered ? '3px solid var(--risk-high)' : 'none',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <strong>Check-in #{c.sequence || '1'} ({c.channel})</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{new Date(c.occurredAt).toLocaleDateString()}</span>
                  </div>
                  {c.turns && c.turns.length > 0 && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', marginTop: '0.35rem', fontStyle: 'italic' }}>
                      "{c.turns.find((t) => t.speaker === 'person')?.text || 'Check-in completed'}"
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: "WHY THIS CASE IS HERE" EXPLAINABLE SIGNALS ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card" style={{ padding: '1.35rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.45rem' }}>
              Explainable Signal Convergence
            </div>
            <strong style={{ fontSize: '0.98rem', color: 'var(--ink)', display: 'block', marginBottom: '0.85rem' }}>
              Why this case is here
            </strong>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {drivers.length > 0 ? (
                drivers.map((drv, idx) => {
                  const isExpanded = expandedSignals[drv.component] ?? (idx === 0);

                  return (
                    <div key={drv.component} style={{
                      background: 'var(--surface-sunken)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--line-faint)',
                      overflow: 'hidden',
                    }}>
                      <button
                        onClick={() => toggleSignal(drv.component)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.65rem 0.85rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          textAlign: 'left',
                          font: 'inherit',
                        }}
                      >
                        <strong style={{ fontSize: '0.84rem', color: 'var(--ink)' }}>{drv.label}</strong>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>
                            {drv.contribution} pts ({drv.sharePct}%)
                          </span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--ink-faint)' }}>
                            {isExpanded ? '▴' : '▾'}
                          </span>
                        </div>
                      </button>

                      {isExpanded && (
                        <div style={{ padding: '0 0.85rem 0.65rem', fontSize: '0.78rem', color: 'var(--ink-soft)', lineHeight: 1.45 }}>
                          <p style={{ margin: 0 }}>{drv.detail}</p>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ fontSize: '0.84rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                  Signals are currently within anticipated baseline range.
                </div>
              )}
            </div>

            {/* Person's Own Words */}
            {(explanation.signalPhrases || []).length > 0 && (
              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px dashed var(--line-faint)' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.4rem' }}>
                  Person's Own Words
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {explanation.signalPhrases.map((phrase, i) => (
                    <span key={i} className="phrase-tag">
                      "{phrase}"
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ BELOW 1: CARE HORIZON & SUPPORT HANDOFF THREAD ════════════════ */}
      <div className="card card-elevated animate-in animate-in-delay-3" style={{ marginBottom: '1.5rem', padding: '1.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <strong style={{ fontSize: '0.98rem', color: 'var(--ink)' }}>Care Horizon & Support Handoff</strong>
            <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
              Forward-looking alignment connecting noticed signals to verified welfare action
            </div>
          </div>
          {prediction.courtDateRisk && (
            <span style={{
              fontSize: '0.74rem',
              fontWeight: 700,
              padding: '0.2rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              background: 'var(--risk-high-bg)',
              color: 'var(--risk-high)',
              border: '1px solid var(--risk-high-border)',
            }}>
              ⚠️ Court Hearing Date Alignment
            </span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Next Support Cadence
            </div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--ink)', display: 'block', marginTop: '0.2rem' }}>
              {prediction.courtDateRisk ? 'Within 24–48 Hours' : 'Weekly Check-in Scheduled'}
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Regular contact window</span>
          </div>

          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Upcoming Statutory Milestone
            </div>
            <strong style={{ fontSize: '0.92rem', color: 'var(--ink)', display: 'block', marginTop: '0.2rem' }}>
              Special Court Hearing
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Witness protection vigilance</span>
          </div>

          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Trajectory Projection
            </div>
            <strong style={{ fontSize: '0.92rem', color: trend.direction === 'rising' ? 'var(--risk-high)' : 'var(--ink)', display: 'block', marginTop: '0.2rem' }}>
              {prediction.projectedWindow?.windowText || 'Stable baseline horizon'}
            </strong>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Confidence: {prediction.confidence || 'medium'}</span>
          </div>
        </div>

        {/* Support Handoff Thread Sequence */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          padding: '0.85rem 0.5rem 0',
          borderTop: '1px dashed var(--line-faint)',
          overflowX: 'auto',
          gap: '0.75rem',
        }}>
          {[
            { step: '1', title: 'Signal Noticed', state: 'completed' },
            { step: '2', title: 'Counsellor Review', state: 'active' },
            { step: '3', title: 'Support Assigned', state: 'pending' },
            { step: '4', title: 'Contact Verified', state: 'pending' },
            { step: '5', title: 'Outcome Documented', state: 'pending' },
          ].map(({ step, title, state }) => (
            <div key={title} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: state === 'completed' ? 'var(--risk-low)' : state === 'active' ? 'var(--accent)' : 'var(--surface-sunken)',
                color: state === 'completed' || state === 'active' ? '#FFFFFF' : 'var(--ink-muted)',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {state === 'completed' ? '✓' : step}
              </div>
              <span style={{ fontSize: '0.78rem', fontWeight: state === 'active' ? 700 : 500, color: state === 'active' ? 'var(--accent)' : 'var(--ink)' }}>
                {title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ BELOW 2: CLOSED-LOOP INTERVENTION WORKFLOW (STATE MACHINE) ═══ */}
      {(() => {
        const displayList = interventionsList.length > 0 ? interventionsList : interventions;
        if (!displayList || displayList.length === 0) return null;

        const STATUS_BADGE_STYLE = {
          RECOMMENDED: { bg: 'var(--surface-sunken)', color: 'var(--ink-muted)' },
          ACCEPTED: { bg: 'rgba(49, 130, 206, 0.12)', color: '#3182ce' },
          ASSIGNED: { bg: 'rgba(128, 90, 213, 0.12)', color: '#805ad5' },
          CONTACT_ATTEMPTED: { bg: 'rgba(214, 158, 46, 0.12)', color: '#d69e2e' },
          CONTACTED: { bg: 'rgba(45, 90, 70, 0.12)', color: 'var(--secondary)' },
          IN_PROGRESS: { bg: 'rgba(192, 80, 54, 0.12)', color: 'var(--accent)' },
          COMPLETED: { bg: 'var(--risk-low-bg)', color: 'var(--risk-low)' },
          CLOSED: { bg: 'var(--surface-deep)', color: 'var(--ink-muted)' },
        };

        return (
          <div className="card animate-in animate-in-delay-3" style={{ padding: '1.4rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong style={{ fontSize: '0.98rem', color: 'var(--ink)' }}>Closed-Loop Support Actions</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                  State-backed intervention lifecycle with verifiable outcomes
                </div>
              </div>
              {actionBusy && (
                <span style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>Updating intervention state…</span>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {displayList.map((item) => {
                const status = item.status || 'RECOMMENDED';
                const badge = STATUS_BADGE_STYLE[status] || STATUS_BADGE_STYLE.RECOMMENDED;

                return (
                  <div key={item.id || item.code} style={{
                    padding: '1rem 1.15rem',
                    background: 'var(--surface)',
                    border: '1px solid var(--line-faint)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: item.urgency === 'immediate'
                      ? '4px solid var(--risk-high)'
                      : item.urgency === 'this_week'
                        ? '4px solid var(--risk-moderate)'
                        : '4px solid var(--risk-low)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <div>
                        <strong style={{ fontSize: '0.94rem', color: 'var(--ink)' }}>{item.label}</strong>
                        {(item.assignedOfficer || item.assignedTo) && (
                          <span style={{ marginLeft: '0.65rem', fontSize: '0.76rem', color: 'var(--ink-muted)' }}>
                            Assigned to: <strong>{item.assignedOfficer || item.assignedTo}</strong>
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center' }}>
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
                      </div>
                    </div>

                    <p style={{ margin: '0 0 0.65rem', fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
                      {item.description}
                    </p>

                    {(item.outcomeCode || item.outcomeNote || item.outcome) && (
                      <div style={{ marginBottom: '0.65rem', fontSize: '0.76rem', color: 'var(--risk-low)', fontWeight: 600 }}>
                        ✓ Documented Outcome: <span style={{ textTransform: 'capitalize' }}>{(item.outcomeCode || item.outcome || '').replace(/_/g, ' ')}</span>
                        {item.outcomeNote && ` — ${item.outcomeNote}`}
                      </div>
                    )}

                    {/* Action buttons based on status machine */}
                    <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', borderTop: '1px dashed var(--line-faint)', paddingTop: '0.55rem' }}>
                      {status === 'RECOMMENDED' && (
                        <>
                          <button
                            className="btn btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id, 'accept')}
                          >
                            ✓ Accept Action
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id, 'decline', { outcomeCode: 'declined', outcomeNote: 'Counsellor declined recommendation' })}
                          >
                            Decline
                          </button>
                        </>
                      )}

                      {status === 'ACCEPTED' && (
                        <button
                          className="btn btn-sm"
                          disabled={actionBusy}
                          onClick={() => handleInterventionAction(item.id, 'assign', { assignedOfficer: 'District Protection Cell / DLSA' })}
                        >
                          Assign Protection Cell
                        </button>
                      )}

                      {status === 'ASSIGNED' && (
                        <button
                          className="btn btn-sm"
                          disabled={actionBusy}
                          onClick={() => handleInterventionAction(item.id, 'contact', { outcomeNote: 'Contact initiated with complainant' })}
                        >
                          Confirm Contacted
                        </button>
                      )}

                      {status === 'CONTACTED' && (
                        <>
                          <button
                            className="btn btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id, 'complete', { outcomeCode: 'support_completed', outcomeNote: 'Support delivered successfully' })}
                            style={{ background: 'var(--risk-low)', borderColor: 'var(--risk-low)' }}
                          >
                            ✓ Complete Support
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id, 'follow_up', { outcomeCode: 'follow_up_required', outcomeNote: 'Scheduled follow-up' })}
                          >
                            Schedule Follow-up
                          </button>
                        </>
                      )}

                      {status === 'FOLLOW_UP_DUE' && (
                        <>
                          <button
                            className="btn btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id, 'contact', { outcomeNote: 'Follow-up contact conducted' })}
                          >
                            Record Contact
                          </button>
                          <button
                            className="btn btn-sm"
                            disabled={actionBusy}
                            onClick={() => handleInterventionAction(item.id, 'complete', { outcomeCode: 'support_completed', outcomeNote: 'Follow-up concluded successfully' })}
                            style={{ background: 'var(--risk-low)', borderColor: 'var(--risk-low)' }}
                          >
                            Complete
                          </button>
                        </>
                      )}

                      {(status === 'COMPLETED' || status === 'DECLINED') && (
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={actionBusy}
                          onClick={() => handleInterventionAction(item.id, 'close', { outcomeCode: item.outcomeCode || 'support_completed' })}
                        >
                          Archive & Close Action
                        </button>
                      )}

                      {status === 'CLOSED' && (
                        <span style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                          Intervention cycle completed and archived.
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
    </div>
  );
}
