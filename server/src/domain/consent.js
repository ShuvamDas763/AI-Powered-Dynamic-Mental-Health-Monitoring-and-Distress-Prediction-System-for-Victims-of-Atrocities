/**
 * Server-Authoritative Consent Management Module.
 *
 * LEGAL & ETHICAL MANDATE
 * -------------------------------------------------------------------------
 * Under Indian data protection principles (DPDP Act, 2023) and victim
 * support protocols under the SC/ST (PoA) Act, 1989, consent cannot simply
 * be an unverified client-side boolean (e.g. `localStorage.getItem('consent')`).
 *
 * The server must maintain an authoritative, timestamped, versioned audit
 * record for every monitored victim. The victim retains the absolute right
 * to grant, modify, or revoke consent across specific operational purposes
 * at any time.
 *
 * PURPOSES
 * -------------------------------------------------------------------------
 * 1. MONITORING: Periodic well-being inquiries & longitudinal distress tracking.
 * 2. COMMUNICATION: Permission to contact via specified channels (Web, App, SMS, IVRS).
 * 3. VOICE_ANALYSIS: Optional acoustic analysis (pace, pauses, pitch variability).
 *
 * EMERGENCY EXCEPTION
 * -------------------------------------------------------------------------
 * Revocation of monitoring consent halts automated periodic outreach and
 * routine check-in scoring. However, if a person in active crisis directly
 * triggers an emergency alert (e.g. suicidal ideation or imminent threat),
 * life-safety escalation protocols and helpline referrals (Tele-MANAS)
 * remain operational as an immediate duty-of-care obligation.
 */

export const CONSENT_POLICY_VERSION = '2026.1';

export const CONSENT_PURPOSE = Object.freeze({
  MONITORING: 'monitoring',
  COMMUNICATION: 'communication',
  VOICE_ANALYSIS: 'voice_analysis',
});

export const COMMUNICATION_CHANNELS = Object.freeze({
  WEB: 'web',
  APP: 'app',
  SMS: 'sms',
  IVRS: 'ivrs',
});

/**
 * Validate and build an authoritative consent record.
 *
 * @param {object} input
 * @param {string} input.caseId
 * @param {string} input.userId
 * @param {object} [input.purposes]
 * @param {string[]} [input.channelsAllowed]
 * @param {string} [input.policyVersion]
 * @returns {object} Authoritative consent record
 */
export function buildConsentRecord(input = {}) {
  if (!input.caseId) throw new Error('Consent record requires a valid caseId');
  if (!input.userId) throw new Error('Consent record requires a valid userId');

  const now = new Date().toISOString();

  const purposes = {
    [CONSENT_PURPOSE.MONITORING]: input.purposes?.[CONSENT_PURPOSE.MONITORING] === true,
    [CONSENT_PURPOSE.COMMUNICATION]: input.purposes?.[CONSENT_PURPOSE.COMMUNICATION] === true,
    [CONSENT_PURPOSE.VOICE_ANALYSIS]: input.purposes?.[CONSENT_PURPOSE.VOICE_ANALYSIS] === true,
  };

  const channelsAllowed = Array.isArray(input.channelsAllowed)
    ? input.channelsAllowed.filter((ch) => Object.values(COMMUNICATION_CHANNELS).includes(ch))
    : [];

  return {
    caseId: input.caseId,
    userId: input.userId,
    policyVersion: input.policyVersion || CONSENT_POLICY_VERSION,
    purposes,
    channelsAllowed,
    grantedAt: now,
    revokedAt: null,
    revocationReason: null,
    updatedAt: now,
  };
}

/**
 * Revoke an existing consent record.
 *
 * @param {object} record Current consent record
 * @param {string} [reason] Stated reason for revocation
 * @returns {object} Updated consent record with revoked status
 */
export function revokeConsent(record, reason = 'User requested revocation') {
  if (!record) return null;
  const now = new Date().toISOString();
  return {
    ...record,
    purposes: {
      [CONSENT_PURPOSE.MONITORING]: false,
      [CONSENT_PURPOSE.COMMUNICATION]: false,
      [CONSENT_PURPOSE.VOICE_ANALYSIS]: false,
    },
    channelsAllowed: [],
    revokedAt: now,
    revocationReason: reason,
    updatedAt: now,
  };
}

/**
 * Check if a specific purpose is currently actively consented.
 *
 * @param {object|null} record
 * @param {string} purpose
 * @returns {boolean}
 */
export function isPurposeConsented(record, purpose) {
  if (!record || record.revokedAt) return false;
  return Boolean(record.purposes?.[purpose]);
}
