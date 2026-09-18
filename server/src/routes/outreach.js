/**
 * Outreach Routes — multi-channel scheduling and simulated delivery/response.
 *
 * ENDPOINTS
 * -------------------------------------------------------------------------
 * GET  /api/outreach/:caseId              - Get current outreach state & schedule
 * POST /api/outreach/schedule             - Schedule next periodic check-in
 * POST /api/outreach/:id/simulate-delivery - Trigger / simulate delivery on Web/App/SMS/IVRS
 * POST /api/outreach/:id/simulate-response - Simulate participant response
 */

import { Router } from 'express';
import { requireAuth } from '../access/requireRole.js';
import { store } from '../store/memoryStore.js';
import { OutreachService, OUTREACH_STATE, CHANNELS } from '../domain/outreachOrchestrator.js';
import { ROLES } from '../access/roles.js';
import { resolveAuthorizedCase } from '../access/caseAuthorization.js';

export const outreachRouter = Router();

const outreachService = new OutreachService(store);

// All outreach endpoints require authentication
outreachRouter.use(requireAuth);

/**
 * GET /api/outreach/:caseId — View outreach status
 */
outreachRouter.get('/:caseId', (req, res) => {
  const { caseId } = req.params;
  const user = req.session.user;

  const auth = resolveAuthorizedCase(user, caseId);
  if (!auth.authorized) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const schedule = store.getOutreachSchedule(auth.caseId);
  if (!schedule) {
    return res.status(404).json({ error: 'Outreach schedule not found for case.' });
  }

  res.json({
    schedule,
    availableChannels: Object.values(CHANNELS),
    states: Object.values(OUTREACH_STATE),
  });
});

/**
 * POST /api/outreach/schedule — Schedule next check-in
 */
outreachRouter.post('/schedule', (req, res) => {
  const user = req.session.user;
  const { caseId, nextCheckInDate, preferredChannel } = req.body ?? {};

  const requestedCaseId = user.role === ROLES.VICTIM ? (caseId || user.caseId) : caseId;
  const auth = resolveAuthorizedCase(user, requestedCaseId);
  if (!auth.authorized) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const schedule = outreachService.scheduleCheckin(auth.caseId, {
    nextCheckInDate,
    preferredChannel,
  });

  res.json({ ok: true, schedule });
});

/**
 * POST /api/outreach/:id/simulate-delivery — Deliver check-in via selected or preferred channel
 */
outreachRouter.post('/:id/simulate-delivery', async (req, res) => {
  const { id } = req.params;
  const user = req.session.user;
  const { channelOverride, simulateFailure } = req.body ?? {};

  const auth = resolveAuthorizedCase(user, id);
  if (!auth.authorized) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const result = await outreachService.attemptDelivery(auth.caseId, {
    channelOverride,
    simulateFailure: simulateFailure === true,
  });

  const updatedSchedule = store.getOutreachSchedule(auth.caseId);
  res.json({ ok: true, result, schedule: updatedSchedule });
});

/**
 * POST /api/outreach/:id/simulate-response — Simulate victim replying to outreach
 */
outreachRouter.post('/:id/simulate-response', (req, res) => {
  const { id } = req.params;
  const user = req.session.user;
  const { responseChannel, message } = req.body ?? {};

  const auth = resolveAuthorizedCase(user, id);
  if (!auth.authorized) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const updated = outreachService.recordResponse(auth.caseId, {
    responseChannel,
    message,
  });

  res.json({ ok: true, schedule: updated });
});
