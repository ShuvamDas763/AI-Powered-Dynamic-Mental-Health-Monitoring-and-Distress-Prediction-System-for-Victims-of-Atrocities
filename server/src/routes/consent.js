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
import { resolveAuthorizedCase } from '../access/caseAuthorization.js';

export const consentRouter = Router();

// All consent endpoints require an active session
consentRouter.use(requireAuth);

/**
 * GET /api/consent — fetch active consent record.
 * Victims see their own case; counsellors can specify ?caseId=...
 */
consentRouter.get('/', (req, res) => {
  const user = req.session.user;
  const requestedCaseId = req.query.caseId || user.caseId;
  const auth = resolveAuthorizedCase(user, requestedCaseId);
  if (!auth.authorized) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const targetCaseId = auth.caseId;
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

  const requestedCaseId = user.role === ROLES.VICTIM ? (caseId || user.caseId) : caseId;
  const auth = resolveAuthorizedCase(user, requestedCaseId);
  if (!auth.authorized) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const effectiveCaseId = auth.caseId;
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

  const requestedCaseId = user.role === ROLES.VICTIM ? (caseId || user.caseId) : caseId;
  const auth = resolveAuthorizedCase(user, requestedCaseId);
  if (!auth.authorized) {
    return res.status(auth.status).json({ error: auth.error });
  }

  const effectiveCaseId = auth.caseId;
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
