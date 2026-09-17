/**
 * Consent Routes — server-authoritative victim consent records.
 *
 * PRIVACY & GOVERNANCE INVARIANT
 * -------------------------------------------------------------------------
 * 1. Consent is authoritative on the server, not a client-side boolean.
 * 2. Victims have the absolute right to view, modify, and revoke consent at any time.
 * 3. Every grant, modification, and revocation is recorded in the audit trail.
 */

import { Router } from 'express';
import { requireAuth } from '../access/requireRole.js';
import { store } from '../store/memoryStore.js';
import { buildConsentRecord, revokeConsent, CONSENT_PURPOSE, COMMUNICATION_CHANNELS } from '../domain/consent.js';
import { ROLES } from '../access/roles.js';

export const consentRouter = Router();

// All consent endpoints require an active session
consentRouter.use(requireAuth);

/**
 * GET /api/consent — fetch active consent record.
 * Victims see their own case; counsellors can specify ?caseId=...
 */
consentRouter.get('/', (req, res) => {
  const user = req.session.user;
  let targetCaseId;

  if (user.role === ROLES.VICTIM) {
    targetCaseId = user.caseId;
  } else if (user.role === ROLES.COUNSELLOR) {
    targetCaseId = req.query.caseId;
    if (!targetCaseId) {
      return res.status(400).json({ error: 'Counsellors must specify a caseId parameter.' });
    }
  } else {
    return res.status(403).json({ error: 'Administrators cannot access identified consent records.' });
  }

  const consentRecord = store.getConsent(targetCaseId);
  if (!consentRecord) {
    // Return default unconsented / preliminary structure for new cases
    return res.json({
      caseId: targetCaseId,
      granted: false,
      record: null,
      availablePurposes: Object.values(CONSENT_PURPOSE),
      availableChannels: Object.values(COMMUNICATION_CHANNELS),
    });
  }

  res.json({
    caseId: targetCaseId,
    granted: !consentRecord.revokedAt,
    record: consentRecord,
    availablePurposes: Object.values(CONSENT_PURPOSE),
    availableChannels: Object.values(COMMUNICATION_CHANNELS),
  });
});

/**
 * POST /api/consent — create or update consent record.
 */
consentRouter.post('/', (req, res) => {
  const user = req.session.user;
  const { caseId, purposes, channelsAllowed } = req.body ?? {};

  const effectiveCaseId = user.role === ROLES.VICTIM ? user.caseId : caseId;
  if (!effectiveCaseId) {
    return res.status(400).json({ error: 'Valid caseId is required.' });
  }

  if (user.role === ROLES.VICTIM && user.caseId !== effectiveCaseId) {
    return res.status(403).json({ error: 'You can only update consent for your own case.' });
  }

  const record = buildConsentRecord({
    caseId: effectiveCaseId,
    userId: user.userId || user.username || 'unknown',
    purposes,
    channelsAllowed,
  });

  const saved = store.saveConsent(record);

  store.logAccess({
    userId: user.userId || user.username,
    role: user.role,
    action: 'grant_consent',
    caseId: effectiveCaseId,
    details: { purposes: saved.purposes, channels: saved.channelsAllowed },
  });

  res.json({ ok: true, record: saved });
});

/**
 * POST /api/consent/revoke — revoke active consent.
 */
consentRouter.post('/revoke', (req, res) => {
  const user = req.session.user;
  const { caseId, reason } = req.body ?? {};

  const effectiveCaseId = user.role === ROLES.VICTIM ? user.caseId : caseId;
  if (!effectiveCaseId) {
    return res.status(400).json({ error: 'Valid caseId is required.' });
  }

  if (user.role === ROLES.VICTIM && user.caseId !== effectiveCaseId) {
    return res.status(403).json({ error: 'You can only revoke consent for your own case.' });
  }

  const existing = store.getConsent(effectiveCaseId);
  if (!existing) {
    return res.status(404).json({ error: 'No active consent record found to revoke.' });
  }

  const revoked = revokeConsent(existing, reason || 'Victim requested revocation');
  const saved = store.saveConsent(revoked);

  store.logAccess({
    userId: user.userId || user.username,
    role: user.role,
    action: 'revoke_consent',
    caseId: effectiveCaseId,
    details: { reason: revoked.revocationReason },
  });

  res.json({ ok: true, record: saved });
});
