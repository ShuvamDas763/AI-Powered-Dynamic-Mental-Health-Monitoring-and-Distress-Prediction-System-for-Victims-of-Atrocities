/**
 * TIER 1 — individual-level (identified) case data.
 *
 * Every route in this file may return data about one identifiable person.
 * The router-level guard below is what keeps that true: it applies to every
 * route added to this router, so a new endpoint cannot be added here and
 * accidentally ship unguarded.
 *
 * Do not add aggregate/statistical endpoints here, and do not add
 * individual-level endpoints to `admin.js`. Keeping the two files strictly
 * single-tier is what makes the separation reviewable by reading the routes.
 */

import { Router } from 'express';
import { requireIdentifiedDataAccess } from '../access/requireRole.js';

export const counsellorRouter = Router();

// Router-level guard: applies to EVERY route below, including ones added later.
counsellorRouter.use(requireIdentifiedDataAccess);

// --- Phase 5 will implement these against the real store. -------------------

/** Case queue, ranked by distress score x priority-use-case weighting. */
counsellorRouter.get('/cases', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet (Phase 5).' });
});

/** One case: check-in history, scores with explanations, trend, interventions. */
counsellorRouter.get('/cases/:caseId', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet (Phase 5).' });
});

/** Cases that have crossed a risk threshold and need human review. */
counsellorRouter.get('/alerts', (req, res) => {
  res.status(501).json({ error: 'Not implemented yet (Phase 5).' });
});
