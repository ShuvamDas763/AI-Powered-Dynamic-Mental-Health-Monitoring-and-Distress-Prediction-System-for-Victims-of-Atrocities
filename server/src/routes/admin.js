/**
 * TIER 2 — aggregate data only. District / State / national administration.
 *
 * THE RULE FOR THIS FILE: no handler here may load, construct, or serialise a
 * record that describes one identifiable person. Aggregation happens on the
 * server BEFORE the response is built, so there is no individual-level data in
 * an admin payload for a devtools network tab or a replayed request to find.
 *
 * The `national -> state -> district` drill-down (spec Section 5) is GEOGRAPHIC
 * and stays inside this tier. Narrowing the scope reaches smaller aggregate
 * buckets; it never bottoms out at a person. Because district-level buckets are
 * the smallest, small-cell suppression matters most here — see
 * `config.privacy.minCellSize`.
 */

import { Router } from 'express';
import { requireRole } from '../access/requireRole.js';
import { ROLES } from '../access/roles.js';
import { store } from '../store/memoryStore.js';
import { config } from '../config/env.js';
import { BAND } from '../domain/distressScore.js';

export const adminRouter = Router();

// Router-level guard: applies to EVERY route below, including ones added later.
adminRouter.use(requireRole(ROLES.ADMIN));

/**
 * Apply small-cell suppression to a count.
 *
 * Any bucket smaller than minCellSize is rendered as "<5" rather than an exact
 * number. This prevents re-identification at district level where the caseload
 * is small.
 */
function suppress(count) {
  return count < config.privacy.minCellSize ? `<${config.privacy.minCellSize}` : count;
}

/**
 * Headline counts: caseload, risk-band distribution, open alerts.
 */
adminRouter.get('/summary', (req, res) => {
  const inputs = store.aggregateInputs();

  const total = inputs.length;
  const bandCounts = {};
  for (const band of Object.values(BAND)) {
    bandCounts[band] = 0;
  }
  let escalatedCount = 0;
  let risingCount = 0;

  for (const row of inputs) {
    if (bandCounts[row.band] !== undefined) {
      bandCounts[row.band]++;
    }
    if (row.escalated) escalatedCount++;
    if (row.trendDirection === 'rising') risingCount++;
  }

  res.json({
    total,
    bandCounts,
    escalatedCount: suppress(escalatedCount),
    risingTrendCount: suppress(risingCount),
    // List of open alerts — count only, never individual cases.
    alertCount: suppress(inputs.filter((r) => r.escalated).length),
  });
});

/**
 * Cohort distress trend over time. No individual trajectories.
 *
 * Aggregates the latest assessment band distribution, and provides a
 * simplified trend summary.
 */
adminRouter.get('/trends', (req, res) => {
  const inputs = store.aggregateInputs();

  // Band distribution for the latest snapshot.
  const bandDistribution = {};
  for (const band of Object.values(BAND)) {
    bandDistribution[band] = suppress(inputs.filter((r) => r.band === band).length);
  }

  // Trend direction distribution — suppressed like the summary counts.
  const rawTrendDirections = { rising: 0, improving: 0, stable: 0 };
  for (const row of inputs) {
    if (rawTrendDirections[row.trendDirection] !== undefined) {
      rawTrendDirections[row.trendDirection]++;
    }
  }
  const trendDirections = {};
  for (const [dir, count] of Object.entries(rawTrendDirections)) {
    trendDirections[dir] = suppress(count);
  }

  // Engagement distribution.
  const avgCheckIns =
    inputs.length > 0
      ? Math.round(inputs.reduce((sum, r) => sum + r.checkInCount, 0) / inputs.length)
      : 0;

  res.json({
    totalCases: inputs.length,
    bandDistribution,
    trendDirections,
    averageCheckInsPerCase: avgCheckIns,
  });
});

/**
 * Aggregates broken down by geography at the requested scope level.
 *
 * Scope narrows from national -> state -> district. At each level, the
 * response shows aggregate buckets — never individual cases.
 */
adminRouter.get('/geography', (req, res) => {
  const { scope = 'national', state, district } = req.query;
  const inputs = store.aggregateInputs();

  let filtered = inputs;

  // Apply geographic filtering based on scope.
  if (scope === 'district' && state && district) {
    filtered = inputs.filter((r) => r.state === state && r.district === district);
  } else if (scope === 'state' && state) {
    filtered = inputs.filter((r) => r.state === state);
  }
  // 'national' = no filter.

  // Group by the appropriate geographic level.
  const groupBy =
    scope === 'district'
      ? (r) => r.district
      : scope === 'state'
        ? (r) => r.district
        : (r) => r.state;

  const groups = {};
  for (const row of filtered) {
    const key = groupBy(row);
    if (!groups[key]) {
      groups[key] = {
        name: key,
        total: 0,
        bandCounts: {},
        escalated: 0,
        rising: 0,
      };
      for (const band of Object.values(BAND)) {
        groups[key].bandCounts[band] = 0;
      }
    }
    groups[key].total++;
    if (groups[key].bandCounts[row.band] !== undefined) {
      groups[key].bandCounts[row.band]++;
    }
    if (row.escalated) groups[key].escalated++;
    if (row.trendDirection === 'rising') groups[key].rising++;
  }

  // Apply small-cell suppression to each group.
  const result = Object.values(groups).map((g) => ({
    name: g.name,
    total: suppress(g.total),
    bandCounts: g.bandCounts,
    escalated: suppress(g.escalated),
    rising: suppress(g.rising),
  }));

  res.json({
    scope,
    state: state ?? null,
    district: district ?? null,
    groups: result,
  });
});
