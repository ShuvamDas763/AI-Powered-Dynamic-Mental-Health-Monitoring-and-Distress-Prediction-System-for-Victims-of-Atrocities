import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { buildConsentRecord, revokeConsent, isPurposeConsented, CONSENT_PURPOSE, COMMUNICATION_CHANNELS } from './consent.js';
import { createStore } from '../store/memoryStore.js';

describe('Server-Authoritative Consent Management', () => {
  test('builds an authoritative consent record with default granted purposes', () => {
    const record = buildConsentRecord({
      caseId: 'SIH-CASE-0001',
      userId: 'victim_a',
      purposes: {
        [CONSENT_PURPOSE.MONITORING]: true,
        [CONSENT_PURPOSE.COMMUNICATION]: true,
        [CONSENT_PURPOSE.VOICE_ANALYSIS]: false,
      },
      channelsAllowed: [COMMUNICATION_CHANNELS.WEB, COMMUNICATION_CHANNELS.APP],
    });

    assert.equal(record.caseId, 'SIH-CASE-0001');
    assert.equal(record.userId, 'victim_a');
    assert.equal(record.purposes.monitoring, true);
    assert.equal(record.purposes.communication, true);
    assert.equal(record.purposes.voice_analysis, false);
    assert.equal(record.revokedAt, null);
    assert.ok(record.grantedAt);
    assert.ok(isPurposeConsented(record, CONSENT_PURPOSE.MONITORING));
    assert.ok(isPurposeConsented(record, CONSENT_PURPOSE.COMMUNICATION));
    assert.equal(isPurposeConsented(record, CONSENT_PURPOSE.VOICE_ANALYSIS), false);
  });

  test('revoking consent sets revokedAt and zeroes out all purposes and channels', () => {
    const record = buildConsentRecord({
      caseId: 'SIH-CASE-0002',
      userId: 'victim_b',
      purposes: { [CONSENT_PURPOSE.MONITORING]: true, [CONSENT_PURPOSE.COMMUNICATION]: true },
    });

    const revoked = revokeConsent(record, 'Victim opted out during case review');
    assert.ok(revoked.revokedAt);
    assert.equal(revoked.revocationReason, 'Victim opted out during case review');
    assert.equal(revoked.purposes.monitoring, false);
    assert.equal(revoked.purposes.communication, false);
    assert.equal(revoked.channelsAllowed.length, 0);
    assert.equal(isPurposeConsented(revoked, CONSENT_PURPOSE.MONITORING), false);
  });

  test('memory store persists, updates, and revokes consent per case', () => {
    const store = createStore({ now: Date.now() });

    const consent = store.getConsent('SIH-CASE-0001');
    assert.ok(consent);
    assert.equal(store.hasPurposeConsent('SIH-CASE-0001', CONSENT_PURPOSE.MONITORING), true);

    // Revoke
    const revoked = store.revokeConsent('SIH-CASE-0001', 'Participant requested stop');
    assert.ok(revoked);
    assert.equal(store.hasPurposeConsent('SIH-CASE-0001', CONSENT_PURPOSE.MONITORING), false);

    // Re-grant
    const updated = buildConsentRecord({
      caseId: 'SIH-CASE-0001',
      userId: 'victim',
      purposes: { [CONSENT_PURPOSE.MONITORING]: true },
    });
    store.saveConsent(updated);
    assert.equal(store.hasPurposeConsent('SIH-CASE-0001', CONSENT_PURPOSE.MONITORING), true);
  });

  test('throws if caseId or userId is missing', () => {
    assert.throws(() => buildConsentRecord({ userId: 'u' }), /caseId/);
    assert.throws(() => buildConsentRecord({ caseId: 'c' }), /userId/);
  });
});
