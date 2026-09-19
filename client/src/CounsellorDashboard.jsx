/**
 * CounsellorDashboard — The Sahara Support Queue & Casework Cockpit.
 *
 * Implements Sections 33–35 & Creative Quality Gate:
 * Redesigned around:
 * 1. WHO NEEDS MY ATTENTION?
 * 2. WHY?
 * 3. WHAT CHANGED?
 * 4. WHAT SHOULD I DO?
 * 5. WHEN?
 *
 * Visual hierarchy prioritizes narrative explanation over raw numeric scores.
 * Medium/High operational density, actionable triage queue.
 */

import { useEffect, useState, useMemo } from 'react';
import { api } from './api.js';
import {
  IconCase,
  IconAlert,
  IconClock,
  IconSearch,
  IconCheck,
  IconChat,
  IconShield,
  IconUser,
  IconArrowLeft,
} from './GovernmentBranding.jsx';

const BAND_CLASS = {
  low: 'band-low',
  moderate: 'band-moderate',
  elevated: 'band-elevated',
  high: 'band-high',
};

const BAND_BORDER = {
  low: 'var(--risk-low)',
  moderate: 'var(--risk-moderate)',
  elevated: 'var(--risk-elevated)',
  high: 'var(--risk-high)',
};

const STAGE_LABELS = {
  investigation: 'Investigation',
  trial_active: 'Proceedings (active)',
  trial_pending: 'Proceedings (pending)',
  chargesheet_filed: 'Chargesheet filed',
  post_compensation: 'Post-compensation',
};

const STATUS_LABELS = {
  all: 'All Active Dockets',
  new: 'Needs Review',
  under_review: 'Under Review',
  assigned: 'Assigned to Officer',
  contacted: 'Contacted',
  follow_up_due: 'Follow-up Due',
  resolved: 'Resolved',
};

const TRIGGER_LABELS = {
  high_overall_score: 'Support review threshold reached',
  acute_sentiment_drop: 'Acute drop in expressed well-being',
  cluster_hopelessness: 'Expressed hopelessness / helplessness',
  cluster_fear_anxiety: 'Reported fear / threat to personal safety',
  cluster_trauma_intrusive: 'Intrusive distress memories reported',
  cluster_social_withdrawal: 'Social withdrawal & isolation noted',
  cluster_somatic_distress: 'Severe somatic & physical symptoms',
  sustained_distress_trajectory: 'Longitudinal distress trajectory rising',
  significant_sentiment_drop: 'Significant decrease in well-being',
  repeated_missed_checkins: 'Consecutive missed check-ins requiring welfare review',
  outreach_unresponsive: 'Outreach channel unresponsive',
  urgent_distress_phrase: 'Urgent distress phrasing detected',
  unresolved_safety_barrier: 'Safety barrier or threat reported',
  intimidation_on_witness_case: 'Reported intimidation on active witness docket',
};

function formatTriggerReason(r) {
  if (!r) return 'Support review requested';
  if (typeof r === 'string') return TRIGGER_LABELS[r] || r.replace(/_/g, ' ');
  if (typeof r === 'object') return r.label || TRIGGER_LABELS[r.code] || r.code || 'Support review requested';
  return String(r);
}

function normalizeCase(row) {
  if (!row) return row;
  const cr = row.caseRecord || {};
  return {
    ...row,
    caseId: row.caseId || cr.caseId,
    pseudonym: row.pseudonym || cr.pseudonym,
    district: row.district || cr.district,
    state: row.state || cr.state,
    caseStage: row.caseStage || cr.caseStage,
    priorityTags: row.priorityTags || cr.priorityTags || [],
    contextNote: row.contextNote || cr.contextNote,
    caseRecord: {
      caseId: cr.caseId || row.caseId,
      pseudonym: cr.pseudonym || row.pseudonym,
      district: cr.district || row.district,
      state: cr.state || row.state,
      caseStage: cr.caseStage || row.caseStage,
      priorityTags: cr.priorityTags || row.priorityTags || [],
      contextNote: cr.contextNote || row.contextNote,
    },
  };
}

export default function CounsellorDashboard({ onSelectCase, alertsOnly = false }) {
  const [cases, setCases] = useState([]);
  const [operationalAlerts, setOperationalAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [filterBand, setFilterBand] = useState('all');
  const [triageStatus, setTriageStatus] = useState('all');

  useEffect(() => {
    setLoading(true);
    const url = alertsOnly ? '/counsellor/alerts' : '/counsellor/cases';
    api(url).then(({ body }) => {
      if (alertsOnly) {
        setCases((body.alerts ?? []).map(normalizeCase));
        setOperationalAlerts(body.operationalAlerts ?? []);
      } else {
        setCases((body.cases ?? []).map(normalizeCase));
      }
      setLoading(false);
    });
  }, [alertsOnly]);

  async function handleResolveOpAlert(alertId, note = 'Reviewed by counsellor in triage queue') {
    try {
      await api(`/counsellor/operational-alerts/${alertId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ note }),
      });
      const { body } = await api('/counsellor/alerts');
      setCases((body.alerts ?? []).map(normalizeCase));
      setOperationalAlerts(body.operationalAlerts ?? []);
    } catch { /* ignore */ }
  }

  // Filter and sort cases
  const filteredCases = useMemo(() => {
    let result = [...cases];

    // Search filter
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) =>
        (c.pseudonym || '').toLowerCase().includes(q) ||
        (c.caseId || '').toLowerCase().includes(q) ||
        (c.district || '').toLowerCase().includes(q) ||
        (c.contextNote || '').toLowerCase().includes(q)
      );
    }

    // Band filter
    if (filterBand !== 'all') {
      if (filterBand === 'escalated') {
        result = result.filter((c) => c.assessment?.escalated);
      } else {
        result = result.filter((c) => c.assessment?.band === filterBand);
      }
    }

    // Triage status filter
    if (triageStatus !== 'all') {
      result = result.filter((c) => (c.counsellorStatus || 'new') === triageStatus);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'score': return (b.assessment?.score ?? 0) - (a.assessment?.score ?? 0);
        case 'name': return (a.pseudonym || '').localeCompare(b.pseudonym || '');
        case 'checkins': return (b.checkInCount ?? 0) - (a.checkInCount ?? 0);
        case 'recent': return new Date(b.lastCheckInAt || 0) - new Date(a.lastCheckInAt || 0);
        default: return 0;
      }
    });

    return result;
  }, [cases, search, sortBy, filterBand, triageStatus]);

  const escalated = filteredCases.filter((c) => c.assessment?.escalated);
  const stable = filteredCases.filter((c) => !c.assessment?.escalated);

  const risingTrajectoriesCount = cases.filter(
    (c) => c.assessment?.trend?.direction === 'rising' || c.assessment?.escalated
  ).length;

  const followUpsDueCount = cases.filter(
    (c) => (c.counsellorStatus || 'new') === 'follow_up_due' || c.counsellorStatus === 'new'
  ).length;

  if (loading) {
    return (
      <div>
        <div className="page-header animate-in">
          <h1 style={{ fontFamily: 'var(--font-display)' }}>Support Queue</h1>
          <p style={{ color: 'var(--ink-muted)' }}>Reviewing case dockets and longitudinal well-being signals…</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ height: 120, background: 'var(--surface-sunken)', opacity: 0.7 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Cockpit Title answering "WHO NEEDS MY ATTENTION?" */}
      <div className="page-header animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.25rem' }}>
            District Casework Cockpit · Human-in-the-Loop
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 'clamp(1.5rem, 2.5vw, 2rem)' }}>
            {alertsOnly ? 'Active Support Escalations' : 'Support Queue'}
          </h1>
          <p style={{ color: 'var(--ink-muted)', margin: '0.25rem 0 0', fontSize: '0.88rem' }}>
            Ranked by longitudinal well-being trajectory, statutory court milestones, and human support urgency.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{
            fontSize: '0.8rem',
            padding: '0.35rem 0.85rem',
            borderRadius: 'var(--radius-full)',
            background: escalated.length > 0 ? 'var(--risk-high-bg)' : 'var(--risk-low-bg)',
            color: escalated.length > 0 ? 'var(--risk-high)' : 'var(--risk-low)',
            fontWeight: 700,
            border: `1px solid ${escalated.length > 0 ? 'var(--risk-high-border)' : 'var(--risk-low-border)'}`,
          }}>
            {escalated.length > 0 ? `⚠ ${escalated.length} Needs Immediate Attention` : '✓ All Monitored Cases Steady'}
          </span>
        </div>
      </div>

      {/* Operational KPI Summary Bar (Structured around Sections 33 & 34) */}
      <div className="stats-row animate-in animate-in-delay-1" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: escalated.length > 0 ? 'var(--risk-high)' : 'var(--ink)' }}>
            {escalated.length}
          </div>
          <div className="stat-label">Needs Review</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)' }}>
            {followUpsDueCount}
          </div>
          <div className="stat-label">Follow-ups Due</div>
        </div>

        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--risk-elevated)' }}>
            {risingTrajectoriesCount}
          </div>
          <div className="stat-label">Rising Trajectories</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">
            {cases.length}
          </div>
          <div className="stat-label">Open Support Dockets</div>
        </div>
      </div>

      {/* Operational Review Alerts Banner (if any) */}
      {operationalAlerts.length > 0 && (
        <div className="card animate-in" style={{
          marginBottom: '1.5rem',
          borderLeft: '4px solid var(--accent)',
          background: 'var(--surface)',
        }}>
          <h2 style={{ fontSize: '0.98rem', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink)' }}>
            <span>🔔</span> Operational Follow-up Alerts ({operationalAlerts.length})
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {operationalAlerts.map((alert) => (
              <div key={alert.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem 1rem',
                background: 'var(--surface-sunken)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--line-faint)',
                gap: '1rem',
                flexWrap: 'wrap',
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--ink)' }}>
                    {alert.reason ?? alert.type ?? 'Contact Continuity Review Required'}
                    {alert.caseId && (
                      <button
                        style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.78rem',
                          color: 'var(--accent)',
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          fontWeight: 600,
                        }}
                        onClick={() => onSelectCase(alert.caseId)}
                      >
                        ({alert.caseId})
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: '0.76rem', color: 'var(--ink-muted)', marginTop: '0.2rem' }}>
                    Triggered: {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : 'Recent'} · Tier: {alert.targetTier || 'counsellor'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {alert.caseId && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => onSelectCase(alert.caseId)}
                    >
                      View Case
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleResolveOpAlert(alert.id)}
                  >
                    Resolve Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Triage Status Queues Tabs */}
      <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1.25rem' }} className="animate-in animate-in-delay-1" role="tablist">
        {Object.entries(STATUS_LABELS).map(([key, label]) => {
          const count = key === 'all'
            ? cases.length
            : cases.filter((c) => (c.counsellorStatus || 'new') === key).length;
          const isActive = triageStatus === key;

          return (
            <button
              key={key}
              onClick={() => setTriageStatus(key)}
              role="tab"
              aria-selected={isActive}
              style={{
                padding: '0.4rem 0.95rem',
                borderRadius: 'var(--radius-full)',
                border: isActive ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                background: isActive ? 'var(--accent)' : 'var(--surface)',
                color: isActive ? '#FFFFFF' : 'var(--ink-soft)',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                transition: 'all var(--duration-fast)',
              }}
            >
              <span>{label}</span>
              <span style={{
                fontSize: '0.72rem',
                padding: '0.05rem 0.45rem',
                borderRadius: 'var(--radius-full)',
                background: isActive ? 'rgba(255,255,255,0.22)' : 'var(--surface-sunken)',
                color: isActive ? '#FFFFFF' : 'var(--ink-muted)',
                fontWeight: 700,
              }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Multi-criteria Filter Toolbar */}
      <div className="toolbar animate-in animate-in-delay-2">
        <IconSearch size={18} color="var(--ink-muted)" />
        <input
          className="toolbar-input"
          placeholder="Search by pseudonym, Case ID, district, or context notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search cases"
        />
        <select
          className="toolbar-select"
          value={filterBand}
          onChange={(e) => setFilterBand(e.target.value)}
          aria-label="Filter by distress band"
        >
          <option value="all">All Distress Levels</option>
          <option value="escalated">Needs Review Only</option>
          <option value="high">High Distress</option>
          <option value="elevated">Elevated Distress</option>
          <option value="moderate">Moderate Distress</option>
          <option value="low">Low Distress</option>
        </select>
        <select
          className="toolbar-select"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          aria-label="Sort cases by"
        >
          <option value="score">Sort: Support Priority ↓</option>
          <option value="name">Sort: Pseudonym (A–Z)</option>
          <option value="checkins">Sort: Check-in Count ↓</option>
          <option value="recent">Sort: Most Recent</option>
        </select>
        {search && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>
            Clear
          </button>
        )}
      </div>

      {/* SECTION 1: REQUIRES ATTENTION (Urgent Cases) */}
      {escalated.length > 0 && (
        <>
          <div className="section-divider animate-in animate-in-delay-2">
            <div className="section-icon section-icon-high">
              <IconAlert size={16} />
            </div>
            <h2 style={{ color: 'var(--risk-high)', fontSize: '1.05rem', margin: 0 }}>
              Needs Attention ({escalated.length})
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
            {escalated.map((row, i) => (
              <SaharaCaseCard key={row.caseId} row={row} onSelect={onSelectCase} delay={i} urgent />
            ))}
          </div>
        </>
      )}

      {/* SECTION 2: UNDER MONITORING (Holding Steady) */}
      {stable.length > 0 && (
        <>
          <div className="section-divider animate-in animate-in-delay-3">
            <div className="section-icon section-icon-accent">
              <IconCase size={16} />
            </div>
            <h2 style={{ fontSize: '1.05rem', margin: 0 }}>
              Under Active Monitoring ({stable.length})
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1.25rem' }}>
            {stable.map((row, i) => (
              <SaharaCaseCard key={row.caseId} row={row} onSelect={onSelectCase} delay={i + escalated.length} />
            ))}
          </div>
        </>
      )}

      {filteredCases.length === 0 && cases.length > 0 && (
        <div className="empty-state animate-in">
          <div className="empty-state-title">No Matching Cases</div>
          <div className="empty-state-desc">
            No dockets match your current search and filter settings. Try clearing your query or adjusting the filters.
          </div>
          <div style={{ marginTop: '1rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => { setSearch(''); setFilterBand('all'); setTriageStatus('all'); }}>
              Reset Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * SaharaCaseCard — Implements Section 35:
 * Structure:
 * - Case reference & current stage
 * - Trajectory & last check-in
 * - "Why this case is here" (Explainable human factors)
 * - Clear action: "Review Case"
 */
function SaharaCaseCard({ row, onSelect, delay = 0, urgent = false }) {
  const { assessment } = row;
  const bandClass = BAND_CLASS[assessment?.band] ?? '';
  const bandColor = BAND_BORDER[assessment?.band] ?? 'var(--line)';

  const reasons = assessment?.escalation?.triggerReasons || [];
  const whyHeadline = row.assessment?.explanation?.headline || (reasons.length > 0 ? formatTriggerReason(reasons[0]) : 'Routine baseline monitoring');
  const trajectoryDirection = row.assessment?.trend?.direction || 'stable';

  return (
    <div
      className={`card card-elevated card-interactive animate-in animate-in-delay-${(delay % 4) + 1}`}
      style={{
        borderLeft: `5px solid ${urgent ? 'var(--risk-high)' : bandColor}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '1.35rem',
      }}
      onClick={() => onSelect(row.caseId)}
    >
      <div>
        {/* Header line: Case reference + Stage */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.45rem' }}>
          <div>
            <strong style={{ fontSize: '1.08rem', color: 'var(--ink)' }}>{row.pseudonym}</strong>
            <div style={{ fontSize: '0.78rem', color: 'var(--ink-muted)', marginTop: '0.1rem' }}>
              {row.caseId} · {row.district}, {row.state}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              padding: '0.15rem 0.55rem',
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface-sunken)',
              color: 'var(--ink-soft)',
              border: '1px solid var(--line-faint)',
            }}>
              {STAGE_LABELS[row.caseStage] || row.caseStage}
            </span>
          </div>
        </div>

        {/* Trajectory & Cadence Meta */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
          margin: '0.6rem 0 0.85rem',
          fontSize: '0.78rem',
          flexWrap: 'wrap',
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.15rem 0.55rem',
            borderRadius: 'var(--radius-full)',
            background: trajectoryDirection === 'rising' ? 'var(--risk-high-bg)' : trajectoryDirection === 'improving' ? 'var(--risk-low-bg)' : 'var(--surface-sunken)',
            color: trajectoryDirection === 'rising' ? 'var(--risk-high)' : trajectoryDirection === 'improving' ? 'var(--risk-low)' : 'var(--ink-muted)',
            fontWeight: 600,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: trajectoryDirection === 'rising' ? 'var(--risk-high)' : trajectoryDirection === 'improving' ? 'var(--risk-low)' : 'var(--ink-faint)' }} />
            {trajectoryDirection === 'rising' ? 'Rising trajectory' : trajectoryDirection === 'improving' ? 'Improving trajectory' : 'Holding steady'}
          </span>

          <span style={{ color: 'var(--ink-muted)' }}>
            {row.checkInCount ?? 0} check-ins recorded
          </span>
        </div>

        {/* WHY THIS CASE IS HERE */}
        <div style={{
          padding: '0.75rem 0.85rem',
          background: 'var(--surface-sunken)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--line-faint)',
          marginBottom: '1rem',
        }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: urgent ? 'var(--risk-high)' : 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.25rem' }}>
            Why this case is here:
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--ink-soft)', lineHeight: 1.45, fontWeight: 500 }}>
            {whyHeadline}
          </div>
          {row.contextNote && (
            <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)', fontStyle: 'italic', marginTop: '0.3rem' }}>
              "{row.contextNote}"
            </div>
          )}
        </div>
      </div>

      {/* Action Footer: Review Case */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--line-faint)', paddingTop: '0.75rem' }}>
        <div style={{ fontSize: '0.74rem', color: 'var(--ink-muted)' }}>
          Support Priority Index: <strong style={{ color: 'var(--ink)' }}>{assessment?.score ?? '—'}</strong>
        </div>

        <button
          className="btn btn-sm"
          style={{ fontWeight: 700 }}
          onClick={(e) => { e.stopPropagation(); onSelect(row.caseId); }}
        >
          Review Case &rarr;
        </button>
      </div>
    </div>
  );
}
