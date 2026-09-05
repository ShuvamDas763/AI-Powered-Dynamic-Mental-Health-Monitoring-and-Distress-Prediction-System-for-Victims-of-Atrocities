import { useEffect, useState, useMemo } from 'react';
import { api } from './api.js';
import { IconCase, IconAlert, IconClock, IconSearch, IconCheck, IconChat } from './GovernmentBranding.jsx';

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

export default function CounsellorDashboard({ onSelectCase, alertsOnly = false }) {
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('score');
  const [filterBand, setFilterBand] = useState('all');
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    setLoading(true);
    const url = alertsOnly ? '/counsellor/alerts' : '/counsellor/cases';
    api(url).then(({ body }) => {
      if (alertsOnly) {
        setCases(body.alerts ?? []);
      } else {
        setCases(body.cases ?? []);
      }
      setLoading(false);
    });
  }, [alertsOnly]);

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
  }, [cases, search, sortBy, filterBand]);

  if (loading) {
    return (
      <div>
        <div className="page-header animate-in">
          <h1>{alertsOnly ? 'Active Alerts' : 'Case Queue'}</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-row animate-in" style={{ animationDelay: `${i * 0.08}s` }}>
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
          <h1>Active Alerts</h1>
          <p>Cases that have crossed a risk threshold and need human review.</p>
        </div>
        {cases.length === 0 ? (
          <div className="card animate-in animate-in-delay-1" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ marginBottom: '0.75rem', color: 'var(--risk-low)' }}><IconCheck size={48} /></div>
            <h3 style={{ margin: '0 0 0.5rem', color: 'var(--risk-low)' }}>No active alerts</h3>
            <p style={{ margin: 0, color: 'var(--ink-muted)' }}>All cases are within normal parameters.</p>
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
      <div className="page-header animate-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Case Queue</h1>
          <p>Ranked by distress score and priority-use-case weighting.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', position: 'relative' }}>
          <button className="notification-bell" aria-label="Notifications">
            <IconChat size={20} color="var(--ink-muted)" />
            {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="stats-row animate-in animate-in-delay-1" style={{ marginBottom: '1.25rem' }}>
        <div className="stat-card card-elevated">
          <div className="stat-value">{cases.length}</div>
          <div className="stat-label">Total Cases</div>
        </div>
        <div className="stat-card card-elevated">
          <div className="stat-value" style={{ color: 'var(--risk-high)' }}>{escalated.length}</div>
          <div className="stat-label">Escalated</div>
        </div>
        <div className="stat-card card-elevated">
          <div className="stat-value" style={{ color: 'var(--risk-low)' }}>{stable.length}</div>
          <div className="stat-label">Stable</div>
        </div>
        <div className="stat-card card-elevated">
          <div className="stat-value">
            {cases.length > 0 ? Math.round(cases.reduce((s, c) => s + (c.assessment?.score ?? 0), 0) / cases.length) : 0}
          </div>
          <div className="stat-label">Avg Score</div>
        </div>
      </div>

      {/* Search and filter toolbar */}
      <div className="toolbar animate-in animate-in-delay-2">
        <IconSearch size={16} color="var(--ink-muted)" />
        <input
          className="toolbar-input"
          placeholder="Search by name, case ID, district..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search cases"
        />
        <select className="toolbar-select" value={filterBand} onChange={(e) => setFilterBand(e.target.value)} aria-label="Filter by band">
          <option value="all">All Bands</option>
          <option value="escalated">Escalated Only</option>
          <option value="high">High</option>
          <option value="elevated">Elevated</option>
          <option value="moderate">Moderate</option>
          <option value="low">Low</option>
        </select>
        <select className="toolbar-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort by">
          <option value="score">Sort: Score ↓</option>
          <option value="name">Sort: Name A-Z</option>
          <option value="checkins">Sort: Check-ins ↓</option>
          <option value="recent">Sort: Recent</option>
        </select>
        {search && (
          <button className="btn btn-ghost btn-sm" onClick={() => setSearch('')}>Clear</button>
        )}
      </div>

      {/* Escalated cases first */}
      {escalated.length > 0 && (
        <>
          <div className="section-divider animate-in animate-in-delay-2">
            <div className="section-icon section-icon-high">
              <IconAlert size={18} />
            </div>
            <h2 style={{ color: 'var(--risk-high)', fontSize: '0.88rem' }}>
              Requires Attention ({escalated.length})
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {escalated.map((row, i) => (
              <CaseCard key={row.caseId} row={row} onSelect={onSelectCase} delay={i + 2} urgent />
            ))}
          </div>
        </>
      )}

      {/* Stable cases */}
      {stable.length > 0 && (
        <>
          <div className="section-divider animate-in animate-in-delay-3">
            <h2 style={{ fontSize: '0.88rem' }}>
              Under Monitoring ({stable.length})
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1rem' }}>
            {stable.map((row, i) => (
              <CaseCard key={row.caseId} row={row} onSelect={onSelectCase} delay={i + escalated.length + 3} />
            ))}
          </div>
        </>
      )}

      {filteredCases.length === 0 && cases.length > 0 && (
        <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--ink-muted)' }}>
          No cases match your search.
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

  return (
    <div
      className="card card-elevated animate-in"
      role="button"
      tabIndex={0}
      aria-label={`Case ${row.pseudonym}, score ${assessment?.score}, band ${assessment?.band}`}
      style={{
        cursor: 'pointer',
        animationDelay: `${delay * 0.08}s`,
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `4px solid ${bandColor}`,
      }}
      onClick={() => onSelect(row.caseId)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(row.caseId); } }}
    >
      {urgent && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'var(--risk-high)' }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <div className={`section-icon ${urgent ? 'section-icon-high' : 'section-icon-accent'}`}>
            <StageIcon size={20} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>{row.pseudonym}</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              {row.caseId} · {row.district}
            </span>
          </div>
        </div>
        <span className={`band-badge ${bandClass}`}>{assessment?.band}</span>
      </div>

      <p style={{ margin: '0 0 0.85rem', fontSize: '0.85rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>
        {row.contextNote}
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 auto', minWidth: 80 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>Score</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{assessment?.score ?? '—'}</div>
        </div>
        <div style={{ flex: '1 1 auto', minWidth: 80 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>Check-ins</div>
          <div style={{ fontSize: '1.35rem', fontWeight: 700 }}>{row.checkInCount}</div>
        </div>
        <div style={{ flex: '1 1 auto', minWidth: 80 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.15rem' }}>Trend</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: assessment?.trendDirection === 'rising' ? 'var(--risk-elevated)' : assessment?.trendDirection === 'improving' ? 'var(--risk-low)' : 'var(--ink)' }}>
            {assessment?.trendDirection === 'rising' ? '↗ Rising' : assessment?.trendDirection === 'improving' ? '↘ Improving' : '→ Stable'}
          </div>
        </div>
      </div>

      {assessment?.escalated && assessment?.triggerReasons?.length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--line-faint)', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {assessment.triggerReasons.map((r) => (
            <span key={r.code} style={{
              fontSize: '0.72rem', padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)',
              background: 'var(--risk-high-bg)', color: 'var(--risk-high)', fontWeight: 600,
            }}>
              {r.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function AlertCard({ row, onSelect, delay = 0 }) {
  const { caseRecord, assessment } = row;
  const reasons = assessment?.triggerReasons ?? [];
  const bandClass = BAND_CLASS[assessment?.band] ?? '';

  return (
    <div
      className="card card-elevated animate-in"
      style={{ cursor: 'pointer', animationDelay: `${delay * 0.08}s`, position: 'relative', overflow: 'hidden' }}
      onClick={() => onSelect(caseRecord.caseId)}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 4, background: 'var(--risk-high)' }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem' }}>
        <div style={{ flex: 1, paddingLeft: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '1.05rem' }}>{caseRecord.pseudonym}</strong>
            <span className={`band-badge ${bandClass}`}>{assessment?.band}</span>
            <span style={{ fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
              Score {assessment?.score} → adjusted {assessment?.priorityAdjustedScore}
            </span>
          </div>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: 'var(--ink-soft)' }}>
            {caseRecord.contextNote}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {reasons.map((r) => (
              <span key={r.code} style={{
                fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-full)',
                background: 'var(--risk-high-bg)', color: 'var(--risk-high)', fontWeight: 600,
              }}>
                {r.label}
              </span>
            ))}
          </div>
        </div>
        <span style={{ color: 'var(--ink-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          {caseRecord.caseId}
        </span>
      </div>
    </div>
  );
}
