import { useEffect, useState } from 'react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, Legend,
} from 'recharts';
import { api } from './api.js';

const BAND_COLORS = {
  low: '#4a7c59',
  moderate: '#a0722e',
  elevated: '#c45d3a',
  high: '#8b2e23',
};

const BAND_LABELS = { low: 'Low', moderate: 'Moderate', elevated: 'Elevated', high: 'High' };

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
  const [geoScope, setGeoScope] = useState('national');
  const [geo, setGeo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([api('/admin/summary'), api('/admin/trends')]).then(([s, t]) => {
      setSummary(s.body);
      setTrends(t.body);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    api(`/admin/geography?scope=${geoScope}`).then(({ body }) => setGeo(body));
  }, [geoScope]);

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
        </div>
      </section>

      {/* Summary Stats */}
      {summary && (
        <div className="stats-row animate-in animate-in-delay-1" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card card-elevated">
            <div className="stat-value">{summary.total}</div>
            <div className="stat-label">Total Cases</div>
          </div>
          <div className="stat-card card-elevated">
            <div className="stat-value" style={{ color: 'var(--risk-high)' }}>{summary.alertCount}</div>
            <div className="stat-label">Active Alerts</div>
          </div>
          <div className="stat-card card-elevated">
            <div className="stat-value" style={{ color: 'var(--risk-elevated)' }}>{summary.risingTrendCount}</div>
            <div className="stat-label">Rising Trends</div>
          </div>
          <div className="stat-card card-elevated">
            <div className="stat-value">{trends?.averageCheckInsPerCase ?? 0}</div>
            <div className="stat-label">Avg Check-ins</div>
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

      {/* Geography */}
      <div className="card animate-in animate-in-delay-4">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 style={{ fontSize: '1.05rem', margin: 0 }}>Geographic Breakdown</h2>
          <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--surface-sunken)', padding: '0.2rem', borderRadius: 'var(--radius-sm)' }}>
            {['national', 'state', 'district'].map((scope) => (
              <button
                key={scope}
                className={`btn btn-sm ${geoScope === scope ? '' : 'btn-ghost'}`}
                style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem' }}
                onClick={() => setGeoScope(scope)}
              >
                {scope.charAt(0).toUpperCase() + scope.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {geo && geo.groups && geo.groups.length > 0 ? (
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
        )}
      </div>

      {/* Privacy notice */}
      <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'var(--accent-pale)', borderRadius: 'var(--radius)', border: '1px solid rgba(45, 90, 99, 0.1)' }}>
        <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--accent)', lineHeight: 1.6 }}>
          <strong>Privacy notice:</strong> Aggregate view — individual case data is never visible at this level.
          Small buckets (fewer than 5 cases) are suppressed to prevent re-identification.
        </p>
      </div>
    </div>
  );
}
