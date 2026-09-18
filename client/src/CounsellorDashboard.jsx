import { useEffect, useState, useMemo } from 'react';
import { api } from './api.js';
import { IconCase, IconAlert, IconClock, IconSearch, IconCheck, IconChat, IconShield, IconUser } from './GovernmentBranding.jsx';

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
  trial_active: 'Trial (active)',
  trial_pending: 'Trial (pending)',
  chargesheet_filed: 'Chargesheet filed',
  post_compensation: 'Post-compensation',
};

const STAGE_ICONS = {
  investigation: IconSearch,
  trial_active: IconCase,
  trial_pending: IconClock,
  chargesheet_filed: IconCase,
  post_compensation: IconCheck,
};

const STATUS_LABELS = {
  all: 'All Cases',
  new: 'New',
  under_review: 'Under Review',
  contacted: 'Contacted',
  assigned: 'Assigned',
  follow_up_due: 'Follow-up Due',
  resolved: 'Resolved',
};

const TRIGGER_LABELS = {
  high_overall_score: 'Overall support index elevated',
  acute_sentiment_drop: 'Acute sentiment drop',
  cluster_hopelessness: 'Expressed hopelessness / helplessness',
  cluster_fear_anxiety: 'Reported fear / threat to personal safety',
  cluster_trauma_intrusive: 'Intrusive distress memories',
  cluster_social_withdrawal: 'Social withdrawal & isolation',
  cluster_somatic_distress: 'Severe somatic & physical symptoms',
  sustained_distress_trajectory: 'Longitudinal distress trajectory rising',
  significant_sentiment_drop: 'Significant decrease in expressed well-being',
  repeated_missed_checkins: 'Repeated missed check-ins requiring welfare review',
  outreach_unresponsive: 'Outreach channel unresponsive',
  urgent_distress_phrase: 'Urgent distress phrasing detected',
  unresolved_safety_barrier: 'Unresolved safety barrier reported',
};

function formatTriggerReason(r) {
  if (!r) return 'Support review requested';
  if (typeof r === 'string') return TRIGGER_LABELS[r] || r;
  if (typeof r === 'object') return r.label || TRIGGER_LABELS[r.code] || r.code || 'Support review requested';
  return String(r);
}

function formatWhyHeadline(why) {
  if (!why) return '';
  if (typeof why === 'string') return why;
  if (Array.isArray(why)) {
    const first = why[0];
    if (!first) return '';
    if (typeof first === 'string') return first;
    if (typeof first === 'object') return first.label || first.code || JSON.stringify(first);
    return String(first);
  }
  if (typeof why === 'object') return why.headline || why.label || why.code || '';
  return String(why);
}

function formatWhySubReason(r) {
  if (!r) return '';
  if (typeof r === 'string') return r;
  if (typeof r === 'object') return r.label || r.code || JSON.stringify(r);
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
      result = result.filter(c =>
        (c.pseudonym || '').toLowerCase().includes(q) ||
        (c.caseId || '').toLowerCase().includes(q) ||
        (c.district || '').toLowerCase().includes(q) ||
        (c.contextNote || '').toLowerCase().includes(q)
      );
    }

    // Band filter
    if (filterBand !== 'all') {
      if (filterBand === 'escalated') {
        result = result.filter(c => c.assessment?.escalated);
      } else {
        result = result.filter(c => c.assessment?.band === filterBand);
      }
    }

    // Triage status filter
    if (triageStatus !== 'all') {
      result = result.filter(c => (c.counsellorStatus || 'new') === triageStatus);
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

  if (loading) {
    return (
      <div>
        <div className="page-header animate-in">
          <h1>{alertsOnly ? 'Active Alerts' : 'Counsellor Triage & Case Queue'}</h1>
          <p>Loading operational case dockets…</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-row animate-in">
              <div className="skeleton-avatar" />
              <div className="skeleton-text">
                <div className="skeleton-line" />
                <div className="skeleton-line" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (alertsOnly) {
    return (
      <div>
        <div className="page-header animate-in">
          <h1>Active Escalation Alerts</h1>
          <p>
            Cases that have crossed statutory distress thresholds or require priority welfare follow-up under SC/ST Protection protocols.
          </p>
        </div>

        {/* Operational Review Alerts */}
        {operationalAlerts.length > 0 && (
          <div className="card animate-in" style={{
            marginBottom: '1.5rem',
            borderLeft: '4px solid var(--accent)',
            background: 'var(--surface)',
          }}>
            <h2 style={{ fontSize: '1rem', margin: '0 0 0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--ink)' }}>
              <span>🔔</span> Operational Review Alerts ({operationalAlerts.length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {operationalAlerts.map(alert => (
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
                      Triggered: {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleString() : 'Recent'} · Target Tier: {alert.targetTier || 'counsellor'}
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

        {cases.length === 0 && operationalAlerts.length === 0 ? (
          <div className="empty-state animate-in">
            <div className="empty-state-icon" style={{ color: 'var(--risk-low)' }}>
              <IconCheck size={48} />
            </div>
            <div className="empty-state-title" style={{ color: 'var(--risk-low)' }}>
              No Active Alerts
            </div>
            <div className="empty-state-desc">
              All registered cases are currently within normal baseline parameters. When a complainant reports acute distress, alerts will appear here immediately.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {cases.map((row, i) => (
              <AlertCard key={row.caseRecord.caseId} row={row} onSelect={onSelectCase} delay={i} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const escalated = filteredCases.filter((c) => c.assessment?.escalated);
  const stable = filteredCases.filter((c) => !c.assessment?.escalated);

  return (
    <div>
      {/* Header answering "What needs my attention right now?" */}
      <div className="page-header animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Counsellor Triage & Casework Workspace</h1>
          <p>
            Human-in-the-loop triage ranked by longitudinal distress trajectory, court dates, and priority weighting.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{
            fontSize: '0.78rem',
            padding: '0.3rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            background: escalated.length > 0 ? 'var(--risk-high-bg)' : 'var(--risk-low-bg)',
            color: escalated.length > 0 ? 'var(--risk-high)' : 'var(--risk-low)',
            fontWeight: 700,
            border: `1px solid ${escalated.length > 0 ? 'var(--risk-high-border)' : 'var(--risk-low-border)'}`,
          }}>
            {escalated.length > 0 ? `⚠ ${escalated.length} Urgent Case${escalated.length === 1 ? '' : 's'}` : '✓ Caseload Stable'}
          </span>
        </div>
      </div>

      {/* Operational KPI Summary */}
      <div className="stats-row animate-in animate-in-delay-1">
        <div className="stat-card">
          <div className="stat-value">{cases.length}</div>
          <div className="stat-label">Total Assigned Dockets</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--risk-high)' }}>{escalated.length}</div>
          <div className="stat-label">Escalated / Action Due</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--risk-low)' }}>{stable.length}</div>
          <div className="stat-label">Stable / Under Monitoring</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {cases.length > 0 ? Math.round(cases.reduce((s, c) => s + (c.assessment?.score ?? 0), 0) / cases.length) : 0}
          </div>
          <div className="stat-label">Avg Support Priority</div>
        </div>
      </div>

      {/* Triage Status Queues Tabs */}
      <div style={{ display: 'flex', gap: '0.45rem', overflowX: 'auto', paddingBottom: '0.5rem', marginBottom: '1rem' }} className="animate-in animate-in-delay-1" role="tablist">
        {Object.entries(STATUS_LABELS).map(([key, label]) => {
          const count = key === 'all'
            ? cases.length
            : cases.filter(c => (c.counsellorStatus || 'new') === key).length;
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

      {/* Search and Multi-Criteria Filter Toolbar */}
      <div className="toolbar animate-in animate-in-delay-2">
        <IconSearch size={18} color="var(--ink-muted)" />
        <input
          className="toolbar-input"
          placeholder="Search by name, Case ID, district, or context notes…"
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
          <option value="all">All Distress Bands</option>
          <option value="escalated">Escalated Only</option>
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
          <option value="score">Sort: Priority Score ↓</option>
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

      {/* Section 1: Requires Attention / Urgent Escalations */}
      {escalated.length > 0 && (
        <>
          <div className="section-divider animate-in animate-in-delay-2">
            <div className="section-icon section-icon-high">
              <IconAlert size={18} />
            </div>
            <h2 style={{ color: 'var(--risk-high)', fontSize: '1rem' }}>
              Requires Attention ({escalated.length})
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.15rem', marginBottom: '1.75rem' }}>
            {escalated.map((row, i) => (
              <CaseCard key={row.caseId} row={row} onSelect={onSelectCase} delay={i} urgent />
            ))}
          </div>
        </>
      )}

      {/* Section 2: Under Monitoring / Stable Cases */}
      {stable.length > 0 && (
        <>
          <div className="section-divider animate-in animate-in-delay-3">
            <div className="section-icon section-icon-accent">
              <IconCase size={18} />
            </div>
            <h2 style={{ fontSize: '1rem' }}>
              Under Monitoring ({stable.length})
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.15rem' }}>
            {stable.map((row, i) => (
              <CaseCard key={row.caseId} row={row} onSelect={onSelectCase} delay={i + escalated.length} />
            ))}
          </div>
        </>
      )}

      {filteredCases.length === 0 && cases.length > 0 && (
        <div className="empty-state animate-in">
          <div className="empty-state-title">No Matching Cases</div>
          <div className="empty-state-desc">
            No dockets match your current search and filter settings. Try clearing your search query or changing the distress band filter.
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

function CaseCard({ row, onSelect, delay = 0, urgent = false }) {
  const { assessment } = row;
  const bandClass = BAND_CLASS[assessment?.band] ?? '';
  const bandColor = BAND_BORDER[assessment?.band] ?? 'var(--line)';
  const StageIcon = STAGE_ICONS[row.caseStage] ?? IconCase;

  const statusColor = {
    new: '#1E6091',
    under_review: '#855208',
    contacted: '#2D5A46',
    assigned: '#5C458A',
    follow_up_due: '#A34226',
    resolved: '#2D5A46',
  }[row.counsellorStatus || 'new'] || 'var(--ink-muted)';

  return (
    <div
      className="card card-elevated card-interactive animate-in"
      role="button"
      tabIndex={0}
      aria-label={`Case ${row.pseudonym}, score ${assessment?.score}, band ${assessment?.band}`}
      style={{
        animationDelay: `${delay * 0.05}s`,
        borderLeft: `4px solid ${bandColor}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
      onClick={() => onSelect(row.caseId)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(row.caseId); } }}
    >
      <div>
        {/* Card Header: Pseudonym, Status & Band */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.85rem', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className={`section-icon ${urgent ? 'section-icon-high' : 'section-icon-accent'}`}>
              <StageIcon size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>{row.pseudonym}</h3>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '0.12rem 0.5rem',
                  borderRadius: 'var(--radius-full)',
                  border: `1px solid ${statusColor}`,
                  color: statusColor,
                  letterSpacing: '0.04em',
                }}>
                  {STATUS_LABELS[row.counsellorStatus] || 'New'}
                </span>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                {row.caseId} · {row.district}
              </span>
            </div>
          </div>
          <span className={`band-badge ${bandClass}`}>{assessment?.band}</span>
        </div>

        {/* WHY THIS CASE IS HERE — Transparency Banner */}
        {row.whyThisCaseIsHere && (Array.isArray(row.whyThisCaseIsHere) ? row.whyThisCaseIsHere.length > 0 : Boolean(row.whyThisCaseIsHere.headline)) && (
          <div style={{
            margin: '0 0 0.85rem',
            padding: '0.6rem 0.85rem',
            background: urgent ? 'var(--risk-high-bg)' : 'var(--surface-sunken)',
            borderLeft: `3px solid ${urgent ? 'var(--risk-high)' : 'var(--accent)'}`,
            borderRadius: 'var(--radius-xs)',
            fontSize: '0.8rem',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, color: urgent ? 'var(--risk-high)' : 'var(--accent)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                WHY FLAGGED:
              </span>
              <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                {formatWhyHeadline(row.whyThisCaseIsHere)}
              </span>
            </div>
            {(() => {
              const subReasons = Array.isArray(row.whyThisCaseIsHere)
                ? row.whyThisCaseIsHere.slice(1)
                : (row.whyThisCaseIsHere.rationale ?? []);
              if (subReasons.length === 0) return null;
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginTop: '0.3rem' }}>
                  {subReasons.map((r, i) => (
                    <span key={i} style={{
                      fontSize: '0.72rem',
                      background: 'var(--surface)',
                      padding: '0.1rem 0.5rem',
                      borderRadius: 'var(--radius-full)',
                      color: 'var(--ink-soft)',
                      border: '1px solid var(--line-faint)',
                    }}>
                      • {formatWhySubReason(r)}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Docket Context Note */}
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
          {row.contextNote}
        </p>
      </div>

      <div>
        {/* Core Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: '0.5rem',
          padding: '0.75rem',
          background: 'var(--surface-sunken)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--line-faint)',
          marginBottom: '0.85rem',
        }}>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Score</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>{assessment?.score ?? '—'}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Check-ins</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--ink)', lineHeight: 1.2 }}>{row.checkInCount}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.68rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>Trend</div>
            <div style={{
              fontSize: '0.88rem',
              fontWeight: 700,
              marginTop: '0.2rem',
              color: assessment?.trendDirection === 'rising' ? 'var(--risk-elevated)' : assessment?.trendDirection === 'improving' ? 'var(--risk-low)' : 'var(--ink-soft)',
            }}>
              {assessment?.trendDirection === 'rising' ? '↗ Rising' : assessment?.trendDirection === 'improving' ? '↘ Improving' : '→ Stable'}
            </div>
          </div>
        </div>

        {/* Operational Indicators: Next checkin & Interventions */}
        <div style={{
          paddingTop: '0.65rem',
          borderTop: '1px solid var(--line-faint)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem',
          fontSize: '0.75rem',
        }}>
          <span style={{ color: 'var(--ink-muted)' }}>
            📅 Next check-in: <strong style={{ color: 'var(--ink)' }}>{row.nextCheckInDate || 'Within 7 days'}</strong>
          </span>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {row.activeInterventionsCount > 0 && (
              <span style={{ padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)', background: 'var(--accent-pale)', color: 'var(--accent)', fontWeight: 700, fontSize: '0.7rem' }}>
                {row.activeInterventionsCount} Active Action{row.activeInterventionsCount === 1 ? '' : 's'}
              </span>
            )}
            {row.overdueInterventionsCount > 0 && (
              <span style={{ padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)', background: 'var(--risk-high-bg)', color: 'var(--risk-high)', fontWeight: 700, fontSize: '0.7rem' }}>
                ⚠️ {row.overdueInterventionsCount} Overdue
              </span>
            )}
          </div>
        </div>

        {/* Action button link */}
        <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
          <span style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 700 }}>
            Review Case & Triage →
          </span>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ row, onSelect, delay = 0 }) {
  const { caseRecord, assessment } = row;
  const reasons = assessment?.triggerReasons ?? [];
  const bandClass = BAND_CLASS[assessment?.band] ?? '';

  return (
    <div
      className="card card-elevated card-interactive animate-in"
      style={{
        animationDelay: `${delay * 0.05}s`,
        borderLeft: '4px solid var(--risk-high)',
      }}
      onClick={() => onSelect(caseRecord.caseId)}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '1.1rem', color: 'var(--ink)' }}>{caseRecord.pseudonym}</strong>
            <span className={`band-badge ${bandClass}`}>{assessment?.band}</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
              Score {assessment?.score} → Priority-adjusted <strong>{assessment?.priorityAdjustedScore}</strong>
            </span>
          </div>

          {/* WHY THIS CASE IS HERE */}
          {row.whyThisCaseIsHere && (Array.isArray(row.whyThisCaseIsHere) ? row.whyThisCaseIsHere.length > 0 : Boolean(row.whyThisCaseIsHere.headline)) && (
            <div style={{
              margin: '0.4rem 0 0.75rem',
              padding: '0.6rem 0.85rem',
              background: 'var(--risk-high-bg)',
              borderLeft: '3px solid var(--risk-high)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '0.8rem',
            }}>
              <div style={{ fontWeight: 800, color: 'var(--risk-high)', marginBottom: '0.2rem', textTransform: 'uppercase', fontSize: '0.72rem', letterSpacing: '0.04em' }}>
                🎯 PRIMARY TRIGGER: {formatWhyHeadline(row.whyThisCaseIsHere)}
              </div>
              {(() => {
                const subReasons = Array.isArray(row.whyThisCaseIsHere)
                  ? row.whyThisCaseIsHere.slice(1)
                  : (row.whyThisCaseIsHere.rationale ?? []);
                if (subReasons.length === 0) return null;
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                    {subReasons.map((r, i) => (
                      <span key={i} style={{ fontSize: '0.72rem', background: 'var(--surface)', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)', color: 'var(--ink-soft)' }}>
                        • {formatWhySubReason(r)}
                      </span>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          <p style={{ margin: '0 0 0.65rem', fontSize: '0.88rem', color: 'var(--ink-soft)' }}>
            {caseRecord.contextNote}
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {reasons.map((r, idx) => (
              <span key={r.code || idx} style={{
                fontSize: '0.75rem', padding: '0.2rem 0.65rem', borderRadius: 'var(--radius-full)',
                background: 'var(--risk-high-bg)', color: 'var(--risk-high)', fontWeight: 700,
                border: '1px solid var(--risk-high-border)',
              }}>
                {formatTriggerReason(r)}
              </span>
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ color: 'var(--ink-muted)', fontSize: '0.82rem', fontWeight: 600 }}>
            {caseRecord.caseId}
          </div>
          <button className="btn btn-critical btn-sm" style={{ marginTop: '0.75rem' }}>
            Review Docket →
          </button>
        </div>
      </div>
    </div>
  );
}
