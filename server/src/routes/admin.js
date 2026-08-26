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
 *
 * A Playwright test (tests/e2e/access-control.spec.js) asserts that no seed
 * persona identifier ever appears in any response from this router.
 */

import { Router } from 'express';
import { requireRole } from '../access/requireRole.js';
import { ROLES } from '../access/roles.js';

export const adminRouter = Router();

// Router-level guard: applies to EVERY route below, including ones added later.
adminRouter.use(requireRole(ROLES.ADMIN));

// --- Phase 6 will implement these against the aggregation layer. ------------

/** Headline counts: caseload, risk-band distribution, open alerts. */
adminRouter.get('/summary', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet (Phase 6).' });
});

/** Cohort distress trend over time. No individual trajectories. */
adminRouter.get('/trends', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet (Phase 6).' });
});

/** Aggregates broken down by geography at the requested scope level. */
adminRouter.get('/geography', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet (Phase 6).' });
});
