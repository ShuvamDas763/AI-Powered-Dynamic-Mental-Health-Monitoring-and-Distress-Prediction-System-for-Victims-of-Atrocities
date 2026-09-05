/**
 * Interactive India map — state-level distress visualization.
 *
 * Uses simplified SVG paths for Indian states. Each state is colored by its
 * average distress score (heat-map style). Clicking a state shows its details.
 *
 * The map is intentionally simplified — this is a prototype, not a GIS system.
 * The paths approximate state boundaries well enough for a demo dashboard.
 */

import { useState } from 'react';

/**
 * Simplified Indian state paths — approximate boundaries for visual representation.
 * Each path includes an id matching the state name used in the data.
 * Coordinates are in a 900x700 viewBox.
 */
const STATE_PATHS = [
  { id: 'Jammu & Kashmir', d: 'M200,30 L260,20 L310,40 L320,80 L290,110 L250,100 L220,80 L200,50 Z' },
  { id: 'Himachal Pradesh', d: 'M260,100 L310,90 L340,110 L330,140 L290,150 L260,130 Z' },
  { id: 'Punjab', d: 'M230,100 L260,100 L260,130 L290,150 L280,170 L240,160 L220,130 Z' },
  { id: 'Uttarakhand', d: 'M310,90 L360,80 L390,100 L380,140 L340,150 L310,140 L310,110 Z' },
  { id: 'Haryana', d: 'M280,150 L310,140 L340,150 L350,180 L320,200 L280,190 L270,170 Z' },
  { id: 'Delhi', d: 'M310,170 L325,165 L335,180 L320,190 L305,185 Z' },
  { id: 'Rajasthan', d: 'M180,160 L240,160 L280,190 L320,200 L310,280 L260,300 L200,280 L170,220 Z' },
  { id: 'Uttar Pradesh', d: 'M320,140 L420,130 L460,160 L470,220 L430,260 L380,250 L340,220 L320,200 L340,150 Z' },
  { id: 'Bihar', d: 'M420,160 L480,150 L510,180 L500,220 L460,240 L430,220 L420,190 Z' },
  { id: 'Sikkim', d: 'M510,160 L530,155 L540,175 L525,185 L510,175 Z' },
  { id: 'Arunachal Pradesh', d: 'M560,120 L620,110 L660,130 L650,160 L610,170 L570,160 L555,140 Z' },
  { id: 'Nagaland', d: 'M650,160 L680,155 L690,175 L675,190 L650,185 L645,170 Z' },
  { id: 'Manipur', d: 'M660,190 L690,185 L700,210 L685,225 L660,220 L655,200 Z' },
  { id: 'Mizoram', d: 'M670,230 L695,225 L705,255 L690,275 L665,270 L660,245 Z' },
  { id: 'Tripura', d: 'M650,260 L670,255 L680,275 L665,290 L645,285 L640,270 Z' },
  { id: 'Meghalaya', d: 'M590,195 L640,190 L650,215 L630,230 L590,225 L580,210 Z' },
  { id: 'Assam', d: 'M550,170 L610,165 L645,190 L640,220 L590,225 L550,210 L540,190 Z' },
  { id: 'West Bengal', d: 'M480,200 L520,195 L540,220 L530,280 L500,310 L470,290 L460,250 Z' },
  { id: 'Jharkhand', d: 'M430,220 L480,215 L500,240 L490,280 L450,290 L420,270 L415,240 Z' },
  { id: 'Odisha', d: 'M440,280 L490,275 L520,300 L510,350 L470,370 L430,350 L420,310 Z' },
  { id: 'Chhattisgarh', d: 'M400,260 L450,255 L470,290 L460,340 L420,360 L380,340 L375,290 Z' },
  { id: 'Madhya Pradesh', d: 'M280,220 L375,210 L420,240 L420,300 L380,340 L320,350 L270,330 L250,280 Z' },
  { id: 'Gujarat', d: 'M140,200 L200,195 L250,220 L260,280 L230,320 L180,310 L130,270 L120,230 Z' },
  { id: 'Maharashtra', d: 'M200,310 L280,300 L340,320 L360,370 L340,420 L280,440 L220,420 L180,380 L170,340 Z' },
  { id: 'Goa', d: 'M210,420 L230,415 L240,440 L225,455 L205,450 L200,435 Z' },
  { id: 'Karnataka', d: 'M240,430 L300,420 L330,450 L320,510 L280,540 L230,530 L210,490 L205,455 Z' },
  { id: 'Kerala', d: 'M230,530 L260,525 L275,560 L265,610 L240,620 L220,590 L215,555 Z' },
  { id: 'Tamil Nadu', d: 'M280,510 L340,500 L370,530 L360,580 L320,610 L270,600 L255,560 L265,520 Z' },
  { id: 'Andhra Pradesh', d: 'M320,380 L380,370 L420,400 L410,460 L370,490 L320,480 L300,440 L310,400 Z' },
  { id: 'Telangana', d: 'M310,350 L370,340 L400,370 L390,420 L350,440 L310,430 L290,390 Z' },
];

/**
 * Color scale for distress scores — matches the earth-tone risk bands.
 */
function getScoreColor(score) {
  if (score == null) return '#e8e2d8'; // No data
  if (score < 31) return '#4a7c59';    // Low — sage
  if (score < 50) return '#a0722e';    // Moderate — ochre
  if (score < 70) return '#c45d3a';    // Elevated — terracotta
  return '#8b2e23';                     // High — clay
}

/**
 * Simplified state centroids for labels and click targets.
 */
const STATE_CENTROIDS = {
  'Jammu & Kashmir': [255, 60],
  'Himachal Pradesh': [295, 120],
  'Punjab': [255, 135],
  'Uttarakhand': [345, 115],
  'Haryana': [310, 170],
  'Delhi': [318, 178],
  'Rajasthan': [245, 230],
  'Uttar Pradesh': [395, 190],
  'Bihar': [465, 190],
  'Sikkim': [525, 170],
  'Arunachal Pradesh': [605, 140],
  'Nagaland': [668, 170],
  'Manipur': [680, 205],
  'Mizoram': [683, 250],
  'Tripura': [660, 272],
  'Meghalaya': [615, 210],
  'Assam': [590, 195],
  'West Bengal': [495, 255],
  'Jharkhand': [455, 255],
  'Odisha': [470, 325],
  'Chhattisgarh': [420, 305],
  'Madhya Pradesh': [335, 290],
  'Gujarat': [185, 255],
  'Maharashtra': [275, 370],
  'Goa': [220, 438],
  'Karnataka': [270, 480],
  'Kerala': [245, 575],
  'Tamil Nadu': [315, 555],
  'Andhra Pradesh': [360, 440],
  'Telangana': [345, 395],
};

/**
 * IndiaMap component.
 *
 * @param {{ stateData: Array<{ name: string, total: number, avgScore: number, escalated: number }>, onStateClick?: (stateName: string) => void }} props
 */
export default function IndiaMap({ stateData = [], onStateClick }) {
  const [hoveredState, setHoveredState] = useState(null);
  const [selectedState, setSelectedState] = useState(null);

  // Map demo state names to real Indian states for visualization.
  const DEMO_TO_REAL = {
    'Demo State 1': 'Maharashtra',
    'Demo State 2': 'Uttar Pradesh',
  };

  // Build a lookup from state name to data, merging demo states into real ones.
  const dataByState = {};
  for (const s of stateData) {
    const realName = DEMO_TO_REAL[s.name] ?? s.name;
    if (dataByState[realName]) {
      // Merge if multiple demo states map to the same real state
      dataByState[realName] = {
        ...dataByState[realName],
        total: dataByState[realName].total + s.total,
        escalated: dataByState[realName].escalated + s.escalated,
        avgScore: Math.round((dataByState[realName].avgScore + s.avgScore) / 2),
      };
    } else {
      dataByState[realName] = { ...s, name: realName };
    }
  }

  function handleClick(stateId) {
    setSelectedState(stateId === selectedState ? null : stateId);
    onStateClick?.(stateId);
  }

  const selectedData = selectedState ? dataByState[selectedState] : null;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        {/* Map */}
        <div style={{ flex: '1 1 400px', minWidth: 320 }}>
          <svg
            viewBox="0 0 750 650"
            style={{ width: '100%', height: 'auto' }}
            role="img"
            aria-label="India map showing state-level distress data"
          >
            {/* Background */}
            <rect x="0" y="0" width="750" height="650" fill="var(--paper)" rx="8" />

            {/* State paths */}
            {STATE_PATHS.map((state) => {
              const data = dataByState[state.id];
              const isHovered = hoveredState === state.id;
              const isSelected = selectedState === state.id;

              return (
                <g key={state.id}>
                  <path
                    d={state.d}
                    fill={getScoreColor(data?.avgScore)}
                    stroke={isSelected ? 'var(--accent)' : isHovered ? 'var(--ink)' : '#fff'}
                    strokeWidth={isSelected ? 2.5 : isHovered ? 1.5 : 0.5}
                    opacity={hoveredState && !isHovered ? 0.6 : 1}
                    style={{ cursor: 'pointer', transition: 'opacity 0.15s, stroke-width 0.15s' }}
                    onMouseEnter={() => setHoveredState(state.id)}
                    onMouseLeave={() => setHoveredState(null)}
                    onClick={() => handleClick(state.id)}
                  />
                </g>
              );
            })}

            {/* State labels — only show for states with data */}
            {STATE_PATHS.map((state) => {
              const data = dataByState[state.id];
              const centroid = STATE_CENTROIDS[state.id];
              if (!centroid || !data) return null;

              return (
                <text
                  key={`label-${state.id}`}
                  x={centroid[0]}
                  y={centroid[1]}
                  textAnchor="middle"
                  fontSize={8}
                  fill="var(--ink)"
                  fontWeight={600}
                  pointerEvents="none"
                  opacity={hoveredState === state.id || selectedState === state.id ? 1 : 0.7}
                >
                  {data.total}
                </text>
              );
            })}

            {/* Hover tooltip */}
            {hoveredState && dataByState[hoveredState] && (
              <g>
                <rect
                  x={Math.min(STATE_CENTROIDS[hoveredState]?.[0] ?? 0, 600)}
                  y={(STATE_CENTROIDS[hoveredState]?.[1] ?? 0) - 45}
                  width={140}
                  height={35}
                  rx={6}
                  fill="var(--accent)"
                  opacity={0.95}
                />
                <text
                  x={Math.min(STATE_CENTROIDS[hoveredState]?.[0] ?? 0, 600) + 10}
                  y={(STATE_CENTROIDS[hoveredState]?.[1] ?? 0) - 22}
                  fontSize={10}
                  fill="#fff"
                  fontWeight={600}
                >
                  {hoveredState}: {dataByState[hoveredState].total} cases
                </text>
                <text
                  x={Math.min(STATE_CENTROIDS[hoveredState]?.[0] ?? 0, 600) + 10}
                  y={(STATE_CENTROIDS[hoveredState]?.[1] ?? 0) - 10}
                  fontSize={9}
                  fill="rgba(255,255,255,0.8)"
                >
                  Avg score: {dataByState[hoveredState].avgScore ?? '—'}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Legend + Selected state details */}
        <div style={{ flex: '0 0 240px', minWidth: 200 }}>
          {/* Legend */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Risk Level
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {[
                { label: 'Low (0-30)', color: '#4a7c59' },
                { label: 'Moderate (31-49)', color: '#a0722e' },
                { label: 'Elevated (50-69)', color: '#c45d3a' },
                { label: 'High (70+)', color: '#8b2e23' },
              ].map(({ label, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem' }}>
                  <span style={{ width: 16, height: 16, borderRadius: 3, background: color, flexShrink: 0 }} />
                  <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Selected state details */}
          {selectedData ? (
            <div className="card" style={{ padding: '0.85rem' }}>
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>{selectedState}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-muted)' }}>Cases</span>
                  <strong>{selectedData.total}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-muted)' }}>Avg Score</span>
                  <strong>{selectedData.avgScore ?? '—'}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--ink-muted)' }}>Alerts</span>
                  <strong style={{ color: selectedData.escalated > 0 ? 'var(--risk-high)' : 'var(--ink)' }}>
                    {selectedData.escalated}
                  </strong>
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '0.85rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
              Click a state on the map to see details.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
