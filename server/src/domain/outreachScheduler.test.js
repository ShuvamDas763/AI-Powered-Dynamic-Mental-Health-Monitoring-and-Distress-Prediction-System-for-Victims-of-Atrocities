/**
 * Acceptance Tests for P1-4 (Automatic Outreach Scheduler)
 * and P1-5 (Counsellor Alert Creation after Exhausted Outreach).
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../store/memoryStore.js';
import { OutreachService, OUTREACH_STATE, CHANNELS } from './outreachOrchestrator.js';
import { OutreachScheduler } from './outreachScheduler.js';

describe('P1-4: Automatic Outreach Scheduler', () => {
  let store;
  let outreachService;
  let fixedClock;

  beforeEach(() => {
    fixedClock = new Date('2026-09-20T10:00:00Z').getTime();
    store = createStore({ now: fixedClock });
    outreachService = new OutreachService(store);
  });

  test('1. scheduler starts and stops cleanly without orphaned timers', () => {
    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      intervalMs: 1000,
      nowFn: () => fixedClock,
    });

    scheduler.start();
    assert.ok(scheduler.timer, 'Timer should be active after start()');

    scheduler.stop();
    assert.equal(scheduler.timer, null, 'Timer should be cleared after stop()');
  });

  test('2. due outreach is discovered and delivered', async () => {
    const caseId = 'SIH-CASE-0001';
    // Set schedule due today (2026-09-20)
    store.updateOutreachSchedule(caseId, {
      nextCheckInDate: '2026-09-20',
      deliveryState: OUTREACH_STATE.CHECKIN_DUE,
      preferredChannel: CHANNELS.APP,
    });

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => fixedClock,
    });

    const results = await scheduler.tick();
    assert.ok(results.length >= 1, 'Should process at least one due schedule');

    const updated = store.getOutreachSchedule(caseId);
    assert.equal(updated.deliveryState, OUTREACH_STATE.DELIVERED);
    assert.equal(updated.lastSuccessfulChannel, CHANNELS.APP);
  });

  test('3. future outreach is ignored', async () => {
    const caseId = 'SIH-CASE-0001';
    // Schedule for 7 days in future
    store.updateOutreachSchedule(caseId, {
      nextCheckInDate: '2026-09-27',
      deliveryState: OUTREACH_STATE.CHECKIN_DUE,
    });

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => fixedClock,
    });

    const results = await scheduler.tick();
    const processedForCase = results.find((r) => r.caseId === caseId);
    assert.equal(processedForCase, undefined, 'Future schedule should not be processed');

    const schedule = store.getOutreachSchedule(caseId);
    assert.equal(schedule.deliveryState, OUTREACH_STATE.CHECKIN_DUE);
  });

  test('4. disabled scheduler does nothing', async () => {
    const caseId = 'SIH-CASE-0001';
    store.updateOutreachSchedule(caseId, {
      nextCheckInDate: '2026-09-20',
      deliveryState: OUTREACH_STATE.CHECKIN_DUE,
    });

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: false,
      nowFn: () => fixedClock,
    });

    const results = await scheduler.tick();
    assert.equal(results.length, 0);

    const schedule = store.getOutreachSchedule(caseId);
    assert.equal(schedule.deliveryState, OUTREACH_STATE.CHECKIN_DUE);
  });

  test('5. repeated ticks do not duplicate delivery (idempotency)', async () => {
    const caseId = 'SIH-CASE-0001';
    store.updateOutreachSchedule(caseId, {
      nextCheckInDate: '2026-09-20',
      deliveryState: OUTREACH_STATE.CHECKIN_DUE,
    });

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => fixedClock,
    });

    // Tick 1
    const results1 = await scheduler.tick();
    assert.ok(results1.some((r) => r.caseId === caseId));

    const scheduleAfter1 = store.getOutreachSchedule(caseId);
    assert.equal(scheduleAfter1.deliveryState, OUTREACH_STATE.DELIVERED);
    const attemptCount1 = scheduleAfter1.attemptCount;

    // Tick 2 (same clock)
    const results2 = await scheduler.tick();
    const processedOnTick2 = results2.find((r) => r.caseId === caseId);
    assert.equal(processedOnTick2, undefined, 'Already DELIVERED schedule must not re-dispatch');

    const scheduleAfter2 = store.getOutreachSchedule(caseId);
    assert.equal(scheduleAfter2.deliveryState, OUTREACH_STATE.DELIVERED);
    assert.equal(scheduleAfter2.attemptCount, attemptCount1);
  });

  test('6. overlap guard prevents concurrent execution', async () => {
    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => fixedClock,
    });

    scheduler.running = true; // Simulate long-running execution
    const results = await scheduler.tick();
    assert.deepEqual(results, [], 'Tick while running should immediately return empty');
    scheduler.running = false;
  });
});

describe('P1-5: Counsellor Alert Creation after Outreach Exhaustion', () => {
  let store;
  let outreachService;

  beforeEach(() => {
    store = createStore();
    outreachService = new OutreachService(store);
  });

  function exhaustOutreach(caseId) {
    const sched = store.getOutreachSchedule(caseId);
    sched.lastAttemptedChannel = CHANNELS.IVRS;
    sched.attemptCount = 2;
    store.updateOutreachSchedule(caseId, sched);
    return outreachService.handleDeliveryFailure(caseId, 'All automated outreach channels exhausted');
  }

  test('exhausting all channels through full state machine creates one operational counsellor alert', async () => {
    const caseId = 'SIH-CASE-0001';
    // Fresh schedule with attemptCount 0
    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Channel 1: APP -> attempt 1 fails
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    let sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.RETRY);

    // Channel 1: APP -> attempt 2 fails -> falls back to SMS
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.ALTERNATE_CHANNEL);
    assert.equal(sched.preferredChannel, CHANNELS.SMS);

    // Channel 2: SMS -> attempt 1 fails
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.RETRY);

    // Channel 2: SMS -> attempt 2 fails -> falls back to IVRS
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.ALTERNATE_CHANNEL);
    assert.equal(sched.preferredChannel, CHANNELS.IVRS);

    // Channel 3: IVRS -> attempt 1 fails
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.RETRY);

    // Channel 3: IVRS -> attempt 2 fails -> EXHAUSTED!
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.COUNSELLOR_FLAG);

    // Verify operational counsellor alert exists
    const alerts = store.getOperationalAlerts({ caseId, status: 'active' });
    assert.equal(alerts.length, 1, 'Exactly one active operational alert should exist');

    const alert = alerts[0];
    assert.equal(alert.caseId, caseId);
    assert.equal(alert.type, 'outreach_exhausted');
    assert.match(alert.reason, /Repeated unsuccessful contact across configured outreach channels/i);
    assert.ok(!alert.reason.includes('AI predicted risk'), 'Alert must not claim AI predicted risk');
    assert.equal(alert.source, 'outreach_orchestrator');
    assert.ok(alert.missedStreak >= 1);
    assert.ok(alert.attemptedChannels.includes('app'));
    assert.ok(alert.attemptedChannels.includes('sms'));
    assert.ok(alert.attemptedChannels.includes('ivrs'));
    assert.equal(alert.status, 'active');
  });

  test('alert idempotency: repeating failure does NOT create duplicate unresolved alert', async () => {
    const caseId = 'SIH-CASE-0001';

    // Trigger exhaustion 1
    exhaustOutreach(caseId);
    const alerts1 = store.getOperationalAlerts({ caseId, status: 'active' });
    assert.equal(alerts1.length, 1);
    const alertId1 = alerts1[0].id;

    // Trigger failure again
    exhaustOutreach(caseId);
    const alerts2 = store.getOperationalAlerts({ caseId, status: 'active' });
    assert.equal(alerts2.length, 1, 'Duplicate unresolved alert must NOT be created');
    assert.equal(alerts2[0].id, alertId1, 'Existing alert should be updated in place');
  });

  test('resolving alert allows new alert on future exhaustion event', () => {
    const caseId = 'SIH-CASE-0001';

    // Trigger initial exhaustion
    exhaustOutreach(caseId);
    const alerts1 = store.getOperationalAlerts({ caseId, status: 'active' });
    assert.equal(alerts1.length, 1);
    const alertId = alerts1[0].id;

    // Counsellor resolves alert
    const resolved = store.resolveOperationalAlert(alertId, 'Officer contacted victim in person');
    assert.equal(resolved.status, 'resolved');
    assert.ok(resolved.resolvedAt);

    // Active alert count is now 0
    assert.equal(store.getOperationalAlerts({ caseId, status: 'active' }).length, 0);

    // A later materially new exhaustion event creates a new active alert
    exhaustOutreach(caseId);
    const alerts2 = store.getOperationalAlerts({ caseId, status: 'active' });
    assert.equal(alerts2.length, 1);
    assert.notEqual(alerts2[0].id, alertId, 'New alert should have a new identifier');
  });
});
