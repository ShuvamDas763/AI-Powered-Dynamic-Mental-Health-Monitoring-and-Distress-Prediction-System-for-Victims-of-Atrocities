/**
 * Mandatory Tests for FIX #1: Consent-Aware Outreach Fallback.
 *
 * Requirements:
 * 1. APP allowed, SMS denied, IVRS allowed -> APP fails -> IVRS is selected.
 * 2. APP allowed, SMS denied, IVRS denied -> APP fails -> outreach exhausted (COUNSELLOR_FLAG).
 * 3. APP allowed, SMS allowed, IVRS allowed -> APP fails -> SMS selected first according to configured ordering.
 * 4. SMS revoked after first attempt -> scheduler does not use SMS for fallback.
 * 5. No communication consent -> no unauthorized channel is dispatched.
 * 6. Exhausted authorized channels -> counsellor operational alert created.
 * 7. Repeated scheduler execution -> no duplicate dispatch caused by fallback processing.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../store/memoryStore.js';
import { OutreachService, OUTREACH_STATE, CHANNELS } from './outreachOrchestrator.js';
import { OutreachScheduler } from './outreachScheduler.js';
import { buildConsentRecord, CONSENT_PURPOSE, COMMUNICATION_CHANNELS } from './consent.js';

describe('FIX #1: Consent-Aware Outreach Fallback', () => {
  let store;
  let outreachService;
  let fixedClock;

  beforeEach(() => {
    fixedClock = new Date('2026-09-20T10:00:00Z').getTime();
    store = createStore({ now: fixedClock });
    outreachService = new OutreachService(store, {
      nowFn: () => fixedClock,
      retryDelayMs: 60_000,
    });
  });

  test('1. APP allowed, SMS denied, IVRS allowed: APP fails -> IVRS is selected', async () => {
    const caseId = 'SIH-CASE-0001';
    // User allows only APP and IVRS; SMS is explicitly omitted/denied
    store.saveConsent(buildConsentRecord({
      caseId,
      userId: 'victim_1',
      purposes: {
        [CONSENT_PURPOSE.MONITORING]: true,
        [CONSENT_PURPOSE.COMMUNICATION]: true,
      },
      channelsAllowed: [COMMUNICATION_CHANNELS.APP, COMMUNICATION_CHANNELS.IVRS],
    }));

    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Attempt 1: APP fails -> state is RETRY
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    let sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.RETRY);
    assert.equal(sched.preferredChannel, CHANNELS.APP);

    // Attempt 2: APP fails again -> skips SMS and selects IVRS
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.ALTERNATE_CHANNEL);
    assert.equal(sched.preferredChannel, CHANNELS.IVRS, 'IVRS must be selected; SMS must be skipped');
    assert.equal(sched.channel, CHANNELS.IVRS);
  });

  test('2. APP allowed, SMS denied, IVRS denied: APP fails -> outreach exhausted', async () => {
    const caseId = 'SIH-CASE-0001';
    // User allows only APP; SMS and IVRS are denied
    store.saveConsent(buildConsentRecord({
      caseId,
      userId: 'victim_1',
      purposes: {
        [CONSENT_PURPOSE.MONITORING]: true,
        [CONSENT_PURPOSE.COMMUNICATION]: true,
      },
      channelsAllowed: [COMMUNICATION_CHANNELS.APP],
    }));

    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Attempt 1: APP fails
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    assert.equal(store.getOutreachSchedule(caseId).deliveryState, OUTREACH_STATE.RETRY);

    // Attempt 2: APP fails -> no permitted fallback channels exist -> COUNSELLOR_FLAG
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    const sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.COUNSELLOR_FLAG, 'Must exhaust to COUNSELLOR_FLAG');
    assert.equal(sched.nextAttemptAt, null);

    // Operational alert created
    const alerts = store.getOperationalAlerts({ caseId, status: 'active' });
    assert.equal(alerts.length, 1, 'Operational alert must be created upon exhaustion');
  });

  test('3. APP allowed, SMS allowed, IVRS allowed: APP fails -> SMS selected first', async () => {
    const caseId = 'SIH-CASE-0001';
    store.saveConsent(buildConsentRecord({
      caseId,
      userId: 'victim_1',
      purposes: {
        [CONSENT_PURPOSE.MONITORING]: true,
        [CONSENT_PURPOSE.COMMUNICATION]: true,
      },
      channelsAllowed: [COMMUNICATION_CHANNELS.APP, COMMUNICATION_CHANNELS.SMS, COMMUNICATION_CHANNELS.IVRS],
    }));

    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    await outreachService.attemptDelivery(caseId, { simulateFailure: true }); // Attempt 1
    await outreachService.attemptDelivery(caseId, { simulateFailure: true }); // Attempt 2 -> fallback

    const sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.ALTERNATE_CHANNEL);
    assert.equal(sched.preferredChannel, CHANNELS.SMS, 'SMS must be selected first according to configured ordering');
  });

  test('4. SMS revoked after first attempt -> scheduler does not use SMS for fallback', async () => {
    const caseId = 'SIH-CASE-0001';
    // Initial consent allows APP, SMS, IVRS
    store.saveConsent(buildConsentRecord({
      caseId,
      userId: 'victim_1',
      purposes: {
        [CONSENT_PURPOSE.MONITORING]: true,
        [CONSENT_PURPOSE.COMMUNICATION]: true,
      },
      channelsAllowed: [COMMUNICATION_CHANNELS.APP, COMMUNICATION_CHANNELS.SMS, COMMUNICATION_CHANNELS.IVRS],
    }));

    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Attempt 1 fails
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    assert.equal(store.getOutreachSchedule(caseId).deliveryState, OUTREACH_STATE.RETRY);

    // User revokes SMS before attempt 2 / fallback
    store.saveConsent(buildConsentRecord({
      caseId,
      userId: 'victim_1',
      purposes: {
        [CONSENT_PURPOSE.MONITORING]: true,
        [CONSENT_PURPOSE.COMMUNICATION]: true,
      },
      channelsAllowed: [COMMUNICATION_CHANNELS.APP, COMMUNICATION_CHANNELS.IVRS],
    }));

    // Attempt 2 fails -> falls back using updated consent state -> must skip SMS and pick IVRS
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    const sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.ALTERNATE_CHANNEL);
    assert.equal(sched.preferredChannel, CHANNELS.IVRS, 'Must skip revoked SMS and pick authorized IVRS');
  });

  test('5. No communication consent -> no unauthorized channel is dispatched', async () => {
    const caseId = 'SIH-CASE-0001';
    // Revoke all communication consent
    store.revokeConsent(caseId, 'User requested stop to communications');

    const schedule = store.getOutreachSchedule(caseId);
    schedule.deliveryState = OUTREACH_STATE.CHECKIN_DUE;
    schedule.nextCheckInDate = '2026-09-20';
    store.updateOutreachSchedule(caseId, schedule);

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => fixedClock,
    });

    const results = await scheduler.tick();
    assert.equal(results.length, 0, 'Scheduler must not dispatch to case without active communication consent');

    // Direct attemptDelivery also refuses to dispatch to unconsented channel
    const directResult = await outreachService.attemptDelivery(caseId);
    assert.equal(directResult.ok, false);
    const updated = store.getOutreachSchedule(caseId);
    assert.notEqual(updated.deliveryState, OUTREACH_STATE.DELIVERED);
  });

  test('6. Exhausted authorized channels creates counsellor operational alert with attempted channels', async () => {
    const caseId = 'SIH-CASE-0001';
    store.saveConsent(buildConsentRecord({
      caseId,
      userId: 'victim_1',
      purposes: {
        [CONSENT_PURPOSE.MONITORING]: true,
        [CONSENT_PURPOSE.COMMUNICATION]: true,
      },
      channelsAllowed: [COMMUNICATION_CHANNELS.APP],
    }));

    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Fail attempt 1 and attempt 2
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });

    const sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.COUNSELLOR_FLAG);

    const alerts = store.getOperationalAlerts({ caseId, status: 'active' });
    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].type, 'outreach_exhausted');
    assert.deepEqual(alerts[0].attemptedChannels, [CHANNELS.APP]);
  });

  test('7. Repeated scheduler execution does not duplicate dispatch caused by fallback processing', async () => {
    const caseId = 'SIH-CASE-0001';
    store.saveConsent(buildConsentRecord({
      caseId,
      userId: 'victim_1',
      purposes: {
        [CONSENT_PURPOSE.MONITORING]: true,
        [CONSENT_PURPOSE.COMMUNICATION]: true,
      },
      channelsAllowed: [COMMUNICATION_CHANNELS.APP, COMMUNICATION_CHANNELS.SMS],
    }));

    // Schedule due today
    store.updateOutreachSchedule(caseId, {
      nextCheckInDate: '2026-09-20',
      deliveryState: OUTREACH_STATE.CHECKIN_DUE,
      preferredChannel: CHANNELS.APP,
    });

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => fixedClock,
    });

    // Tick 1 dispatches APP successfully
    const results1 = await scheduler.tick();
    assert.equal(results1.length, 1);
    assert.equal(store.getOutreachSchedule(caseId).deliveryState, OUTREACH_STATE.DELIVERED);

    // Tick 2 does not re-dispatch or trigger alternate channel
    const results2 = await scheduler.tick();
    assert.equal(results2.length, 0);
    assert.equal(store.getOutreachSchedule(caseId).deliveryState, OUTREACH_STATE.DELIVERED);
  });
});
