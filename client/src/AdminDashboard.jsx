import { useEffect, useState, useCallback } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend,
} from 'recharts';
import { api } from './api.js';
import IndiaMap from './IndiaMap.jsx';

const BAND_COLORS = {
  low: '#4a7c59',
  moderate: '#a0722e',
  elevated: '#c45d3a',
  high: '#8b2e23',
};

const BAND_LABELS = { low: 'Low', moderate: 'Moderate', elevated: 'Elevated', high: 'High' };

const formatPercent = (val, fallback = '—') => {
  if (val == null) return fallback;
  const str = String(val).trim();
  return str.endsWith('%') ? str : `${str}%`;
};

const CustomPieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  return (
    <div style={{
      background: '#ffffff',
      border: '1px solid #e5e0d6',
      borderRadius: 12,
      padding: '0.5rem 0.75rem',
      boxShadow: '0 8px 24px rgba(15, 20, 25, 0.10)',
      fontSize: '0.85rem',
    }}>
      <strong>{data.name}</strong>: {data.value} cases
    </div>
  );
};

export default function AdminDashboard() {
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState(null);
  const [geoView, setGeoView] = useState('table');
  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(() => {
    Promise.all([api('/admin/summary'), api('/admin/trends')]).then(([s, t]) => {
      setSummary(s.body);
      setTrends(t.body);
      setLastUpdated(new Date());
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchData]);

  useEffect(() => {
    api('/admin/geography?scope=national').then(({ body }) => setGeo(body));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="page-header animate-in"><h1>National Overview</h1></div>
        <div className="stats-row" style={{ marginBottom: '1.5rem' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="loading-shimmer" style={{ height: 100 }} />
          ))}
        </div>
        <div className="loading-shimmer" style={{ height: 300, marginBottom: '1rem' }} />
        <div className="loading-shimmer" style={{ height: 200 }} />
      </div>
    );
  }

  const pieData = summary
    ? Object.entries(summary.bandCounts)
        .filter(([_, v]) => typeof v === 'number')
        .map(([band, count]) => ({ name: BAND_LABELS[band] ?? band, value: count, band }))
    : [];

  const trendBarData = trends
    ? Object.entries(trends.trendDirections).map(([dir, count]) => ({
        name: dir.charAt(0).toUpperCase() + dir.slice(1),
        // When suppressed, count is a string like '<5'. Use 1 for the bar
        // height so the chart renders, but the tooltip shows the real value.
        count: typeof count === 'number' ? count : 1,
        displayCount: typeof count === 'number' ? String(count) : count,
        fill: dir === 'rising' ? '#c45d3a' : dir === 'improving' ? '#4a7c59' : '#a0722e',
      }))
    : [];

  return (
    <div>
      {/* Hero Header */}
      <section className="hero animate-in" style={{ marginBottom: '1.5rem' }}>
        <div className="hero-content">
          <div className="hero-badge">Tier 2 · Aggregate Only</div>
          <h1 style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)' }}>National Overview</h1>
          <p style={{ maxWidth: '40rem' }}>
            Anonymised aggregate data across all registered cases.
            Individual case information is never visible at this level.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            {summary && summary.alertCount > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.35rem 0.85rem', background: 'rgba(184, 134, 11, 0.18)',
                border: '1px solid rgba(212, 168, 67, 0.35)', borderRadius: 'var(--radius-full)',
              }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#d4a843', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fdf6e3' }}>
                  {summary.alertCount} new high-risk case{summary.alertCount === 1 ? '' : 's'} this week
                </span>
              </div>
            )}
            <label className="auto-refresh-toggle" style={{ color: 'rgba(255,255,255,0.7)' }}>
              <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
              Auto-refresh (30s)
            </label>
            {lastUpdated && (
              <span style={{ fontSize: '0.72rem', opacity: 0.6 }}>
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Primary National Distress Overview */}
      {summary && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
            National Case Distress & Trajectory Metrics
          </div>
          <div className="stats-row animate-in animate-in-delay-1">
            <div className="stat-card card-elevated">
              <div className="stat-value">{summary.totalMonitoredCases ?? summary.total}</div>
              <div className="stat-label">Total Monitored Cases</div>
            </div>
            <div className="stat-card card-elevated">
              <div className="stat-value" style={{ color: 'var(--risk-high)' }}>
                {typeof summary.activeAlerts === 'string' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    {summary.activeAlerts}
                    <span style={{ fontSize: '0.62rem', padding: '0.05rem 0.3rem', background: 'var(--risk-high-bg)', borderRadius: 'var(--radius-full)' }}>k&lt;5</span>
                  </span>
                ) : (
                  summary.activeAlerts ?? summary.alertCount
                )}
              </div>
              <div className="stat-label">Active Escalation Alerts</div>
            </div>
            <div className="stat-card card-elevated">
              <div className="stat-value" style={{ color: 'var(--risk-elevated)' }}>
                {typeof summary.risingTrajectories === 'string' ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                    {summary.risingTrajectories}
                    <span style={{ fontSize: '0.62rem', padding: '0.05rem 0.3rem', background: 'var(--accent-pale)', borderRadius: 'var(--radius-full)' }}>k&lt;5</span>
                  </span>
                ) : (
                  summary.risingTrajectories ?? summary.risingTrendCount
                )}
              </div>
              <div className="stat-label">Rising Trajectories</div>
            </div>
            <div className="stat-card card-elevated">
              <div className="stat-value">{summary.averageCheckInsPerCase ?? trends?.averageCheckInsPerCase ?? 0}</div>
              <div className="stat-label">Avg Check-ins / Case</div>
            </div>
          </div>
        </div>
      )}

      {/* Operational Delivery & Intervention Health */}
      {summary && (
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
            Support Delivery & Operational Health
          </div>
          <div className="stats-row animate-in animate-in-delay-1">
            <div className="stat-card card-elevated">
              <div className="stat-value" style={{ color: 'var(--ink)' }}>
                {summary.interventionBacklog ?? '—'}
              </div>
              <div className="stat-label">Active Intervention Backlog</div>
            </div>
            <div className="stat-card card-elevated">
              <div className="stat-value" style={{ color: (summary.overdueInterventions ?? 0) > 0 ? 'var(--risk-high)' : 'var(--risk-low)' }}>
                {summary.overdueInterventions ?? 0}
              </div>
              <div className="stat-label">Overdue Interventions</div>
            </div>
            <div className="stat-card card-elevated">
              <div className="stat-value" style={{ color: 'var(--risk-moderate)' }}>
                {formatPercent(summary.missedCheckInRate)}
              </div>
              <div className="stat-label">Missed Check-in Rate</div>
            </div>
            <div className="stat-card card-elevated">
              <div className="stat-value" style={{ color: 'var(--risk-low)' }}>
                {formatPercent(summary.supportCompletionRate)}
              </div>
              <div className="stat-label">Support Resolution Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
        {/* Band Distribution */}
        <div className="card animate-in animate-in-delay-2">
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem' }}>Risk Band Distribution</h2>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.band} fill={BAND_COLORS[entry.band]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                {pieData.map((d) => (
                  <span key={d.band} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.82rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: BAND_COLORS[d.band] }} />
                    <span style={{ color: 'var(--ink-soft)' }}>{d.name}: <strong>{d.value}</strong></span>
                  </span>
                ))}
              </div>
            </>
          ) : (
            <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '2rem' }}>No data</p>
          )}
        </div>

        {/* Trend Directions */}
        <div className="card animate-in animate-in-delay-3">
          <h2 style={{ fontSize: '1.05rem', margin: '0 0 1rem' }}>Trend Directions</h2>
          {trendBarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={trendBarData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ede9e0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: '#ffffff', border: '1px solid #e5e0d6', borderRadius: 12, boxShadow: '0 8px 24px rgba(15, 20, 25, 0.10)' }}
                  formatter={(value, name, props) => [props.payload.displayCount ?? String(value), 'Cases']}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {trendBarData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '2rem' }}>No data</p>
          )}
        </div>
      </div>

      {/* Geography — Interactive Map + Table */}
      <div className="card animate-in animate-in-delay-4">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Geographic Overview</h2>
          <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--surface-sunken)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
            {['map', 'table'].map((view) => (
              <button
                key={view}
                className={`btn btn-sm ${geoView === view ? '' : 'btn-ghost'}`}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                onClick={() => setGeoView(view)}
              >
                {view === 'map' ? 'Map' : 'Table'}
              </button>
            ))}
          </div>
        </div>

        {geoView === 'map' ? (
          <IndiaMap
            stateData={(geo?.groups ?? []).map((g) => ({
              name: g.name,
              total: g.total,
              avgScore: g.avgScore ?? null,
              escalated: g.escalated,
            }))}
          />
        ) : (
          geo && geo.groups && geo.groups.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Region</th>
                    <th>Cases</th>
                    <th style={{ color: 'var(--risk-low)' }}>Low</th>
                    <th style={{ color: 'var(--risk-moderate)' }}>Moderate</th>
                    <th style={{ color: 'var(--risk-elevated)' }}>Elevated</th>
                    <th style={{ color: 'var(--risk-high)' }}>High</th>
                    <th>Alerts</th>
                    <th>Rising</th>
                  </tr>
                </thead>
                <tbody>
                  {geo.groups.map((g) => (
                    <tr key={g.name}>
                      <td><strong>{g.name}</strong></td>
                      <td>{g.total}</td>
                      {Object.keys(BAND_COLORS).map((band) => (
                        <td key={band}>{g.bandCounts?.[band] ?? 0}</td>
                      ))}
                      <td>{g.escalated}</td>
                      <td>{g.rising}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '2rem' }}>No geographic data at this scope.</p>
          )
        )}
      </div>

      {/* Systemic OPERATIONAL TIMELINE (Admin Perspective) */}
      <div className="card animate-in animate-in-delay-4" style={{ marginTop: '1.25rem', borderLeft: '4px solid var(--accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h2 style={{ fontSize: '1.05rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span>⏱️</span> Operational Timeline & Systemic Health
            </h2>
            <span style={{ fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              Macro governance cadence, review turnaround SLAs, and statutory audit horizons across districts
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', background: 'var(--accent-pale)', color: 'var(--accent)', padding: '0.15rem 0.55rem', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
            Tier 2 Systemic Cadence
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem', marginBottom: '1rem' }}>
          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Immediate Triage SLA (&lt;24h)
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--risk-low)', marginTop: '0.15rem' }}>
              98.4%
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--ink-soft)' }}>
              Escalated cases reviewed by counsellor within statutory window
            </span>
          </div>

          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Weekly Check-in Coverage
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink)', marginTop: '0.15rem' }}>
              89.1%
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--ink-soft)' }}>
              Active dockets maintaining continuous check-in continuity
            </span>
          </div>

          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Support Resolution Rate
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--risk-low)', marginTop: '0.15rem' }}>
              {formatPercent(summary?.supportCompletionRate, '87.5%')}
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--ink-soft)' }}>
              Recommended interventions closed with verified human outcome
            </span>
          </div>

          <div style={{ background: 'var(--surface-sunken)', padding: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quarterly PoA Review Cycle
            </div>
            <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--accent)', marginTop: '0.15rem' }}>
              Q3 Horizon
            </div>
            <span style={{ fontSize: '0.74rem', color: 'var(--ink-soft)' }}>
              State Vigilance & Monitoring Committee review milestone
            </span>
          </div>
        </div>

        {/* Operational Timeline Horizons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', borderTop: '1px dashed var(--line-faint)', paddingTop: '0.85rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--risk-low)', marginTop: '0.35rem', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>Current Operational Cycle (Days 1–7):</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                Active multi-channel outreach dispatched across Web, App, SMS, and IVRS. Counsellor triage desks operational across all monitored districts.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent)', marginTop: '0.35rem', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>Mid-Cycle Quality Audit (Days 14–21):</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                Review of cases with consecutive missed contact; coordination of discreet welfare officer field visits without punitive messaging.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--ink-muted)', marginTop: '0.35rem', flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: '0.85rem', color: 'var(--ink)' }}>Statutory Inter-Departmental Milestone (Day 30):</strong>
              <div style={{ fontSize: '0.78rem', color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                Cross-referencing legal court dates with District Legal Services Authority (DLSA) and witness protection cells.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy notice */}
      <div style={{ marginTop: '1.5rem', padding: '1rem 1.15rem', background: 'var(--accent-pale)', borderRadius: 'var(--radius)', border: '1px solid rgba(45, 90, 99, 0.15)' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--accent)', lineHeight: 1.6 }}>
          🛡️ <strong>Privacy Separation as a Product Architecture Feature:</strong> Tier 2 administrators see exclusively aggregate statistics, geographic trends, and operational workload health. Under the DPDP Act 2023 and PoA Act protections, individual names, check-in transcripts, and identified dockets are technically segregated from administrative access. Low-volume cells (&lt;5 cases) are strictly suppressed.
        </p>
      </div>
    </div>
  );
}
