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

  // Tier separation: admin cannot access identified outreach data
  if (user.role === ROLES.ADMIN) {
    return res.status(403).json({ error: 'Aggregate role cannot view individual outreach schedules.' });
  }

  // Victim can only access their own case
  if (user.role === ROLES.VICTIM && user.caseId !== caseId) {
    return res.status(403).json({ error: 'You can only view your own outreach schedule.' });
  }

  const schedule = store.getOutreachSchedule(caseId);
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

  const targetCaseId = user.role === ROLES.VICTIM ? user.caseId : caseId;
  if (!targetCaseId) {
    return res.status(400).json({ error: 'Valid caseId is required.' });
  }

  const schedule = outreachService.scheduleCheckin(targetCaseId, {
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
  const { channelOverride, simulateFailure } = req.body ?? {};

  // 'id' can be caseId
  const caseRecord = store.getCase(id);
  if (!caseRecord) {
    return res.status(404).json({ error: `Case ${id} not found.` });
  }

  const result = await outreachService.attemptDelivery(id, {
    channelOverride,
    simulateFailure: simulateFailure === true,
  });

  const updatedSchedule = store.getOutreachSchedule(id);
  res.json({ ok: true, result, schedule: updatedSchedule });
});

/**
 * POST /api/outreach/:id/simulate-response — Simulate victim replying to outreach
 */
outreachRouter.post('/:id/simulate-response', (req, res) => {
  const { id } = req.params;
  const { responseChannel, message } = req.body ?? {};

  const caseRecord = store.getCase(id);
  if (!caseRecord) {
    return res.status(404).json({ error: `Case ${id} not found.` });
  }

  const updated = outreachService.recordResponse(id, {
    responseChannel,
    message,
  });

  res.json({ ok: true, schedule: updated });
});
