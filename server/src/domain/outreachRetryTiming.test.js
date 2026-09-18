/**
 * Mandatory Tests for FIX #3: Retry-Timing Cleanup.
 *
 * Requirements:
 * 1. failed attempt schedules future retry.
 * 2. scheduler before nextAttemptAt does nothing.
 * 3. scheduler at/after nextAttemptAt retries.
 * 4. successful retry stops retry chain.
 * 5. retry failure moves according to configured policy.
 * 6. fallback channel is not attempted prematurely.
 * 7. repeated scheduler ticks do not duplicate attempts.
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../store/memoryStore.js';
import { OutreachService, OUTREACH_STATE, CHANNELS } from './outreachOrchestrator.js';
import { OutreachScheduler } from './outreachScheduler.js';

describe('FIX #3: Outreach Retry and Fallback Timing', () => {
  let store;
  let outreachService;
  let currentClock;
  const RETRY_DELAY = 10 * 60_000; // 10 minutes

  beforeEach(() => {
    currentClock = new Date('2026-09-20T10:00:00Z').getTime();
    store = createStore({ now: currentClock });
    outreachService = new OutreachService(store, {
      nowFn: () => currentClock,
      retryDelayMs: RETRY_DELAY,
    });
  });

  test('1. failed attempt schedules future retry with explicit timing fields', async () => {
    const caseId = 'SIH-CASE-0001';
    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Attempt delivery with simulated failure
    const res = await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    assert.equal(res.ok, false);
    assert.equal(res.state, OUTREACH_STATE.RETRY);

    const sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.RETRY);
    assert.equal(sched.state, OUTREACH_STATE.RETRY);
    assert.equal(sched.attemptCount, 1);
    assert.equal(sched.attemptNumber, 1);
    assert.ok(sched.attemptedAt, 'attemptedAt must be recorded');
    assert.ok(sched.nextAttemptAt, 'nextAttemptAt must be populated on failure');
    assert.match(sched.failureReason, /Simulated gateway error/);

    const expectedNextAttempt = new Date(currentClock + RETRY_DELAY).toISOString();
    assert.equal(sched.nextAttemptAt, expectedNextAttempt);
  });

  test('2. scheduler before nextAttemptAt does nothing', async () => {
    const caseId = 'SIH-CASE-0001';
    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // 10:00 -> Failure 1 occurs, nextAttemptAt set to 10:10
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    assert.equal(store.getOutreachSchedule(caseId).attemptCount, 1);

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => currentClock, // 10:00
    });

    // Advance 1 minute to 10:01 (before nextAttemptAt 10:10)
    currentClock += 60_000;
    const results1 = await scheduler.tick();
    assert.equal(results1.length, 0, 'Scheduler at 10:01 must not retry');
    assert.equal(store.getOutreachSchedule(caseId).attemptCount, 1);

    // Advance to 10:05 (before nextAttemptAt 10:10)
    currentClock += 4 * 60_000;
    const results2 = await scheduler.tick();
    assert.equal(results2.length, 0, 'Scheduler at 10:05 must not retry');
    assert.equal(store.getOutreachSchedule(caseId).attemptCount, 1);
  });

  test('3. scheduler at/after nextAttemptAt retries', async () => {
    const caseId = 'SIH-CASE-0001';
    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // 10:00 -> Attempt 1 fails -> nextAttemptAt: 10:10
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => currentClock,
    });

    // Advance clock to exactly 10:10 (10 minutes later)
    currentClock += RETRY_DELAY;
    const results = await scheduler.tick();
    assert.equal(results.length, 1, 'Scheduler must retry when clock reaches nextAttemptAt');

    const sched = store.getOutreachSchedule(caseId);
    // Successful delivery on retry (simulateFailure is false for normal scheduler ticks)
    assert.equal(sched.deliveryState, OUTREACH_STATE.DELIVERED);
    assert.equal(sched.attemptCount, 2);
  });

  test('4. successful retry stops retry chain and clears nextAttemptAt', async () => {
    const caseId = 'SIH-CASE-0001';
    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Attempt 1 fails
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    assert.ok(store.getOutreachSchedule(caseId).nextAttemptAt);

    // Clock reaches nextAttemptAt
    currentClock += RETRY_DELAY;

    // Retry succeeds
    const successRes = await outreachService.attemptDelivery(caseId);
    assert.equal(successRes.ok, true);

    const sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.DELIVERED);
    assert.equal(sched.state, OUTREACH_STATE.DELIVERED);
    assert.equal(sched.nextAttemptAt, null, 'nextAttemptAt must be cleared upon success');
    assert.equal(sched.failureReason, null);
    assert.equal(sched.lastSuccessfulChannel, CHANNELS.APP);
  });

  test('5. retry failure moves according to configured policy to fallback channel', async () => {
    const caseId = 'SIH-CASE-0001';
    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Attempt 1 fails at 10:00 -> RETRY at 10:10
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    assert.equal(store.getOutreachSchedule(caseId).deliveryState, OUTREACH_STATE.RETRY);

    // Advance to 10:10
    currentClock += RETRY_DELAY;

    // Attempt 2 fails at 10:10 -> Transitions to ALTERNATE_CHANNEL (SMS) with nextAttemptAt at 10:20
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    const sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.ALTERNATE_CHANNEL);
    assert.equal(sched.preferredChannel, CHANNELS.SMS);
    assert.equal(sched.attemptCount, 0, 'attemptCount resets for new channel');
    assert.equal(sched.nextAttemptAt, new Date(currentClock + RETRY_DELAY).toISOString());
  });

  test('6. fallback channel is not attempted prematurely before nextAttemptAt', async () => {
    const caseId = 'SIH-CASE-0001';
    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Attempt 1 fails at 10:00
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    currentClock += RETRY_DELAY;

    // Attempt 2 fails at 10:10 -> ALTERNATE_CHANNEL (SMS) scheduled for 10:20
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    const sched = store.getOutreachSchedule(caseId);
    assert.equal(sched.deliveryState, OUTREACH_STATE.ALTERNATE_CHANNEL);
    assert.equal(sched.preferredChannel, CHANNELS.SMS);

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => currentClock,
    });

    // Advance 5 minutes to 10:15 (before 10:20)
    currentClock += 5 * 60_000;
    const prematureTick = await scheduler.tick();
    assert.equal(prematureTick.length, 0, 'Scheduler at 10:15 must not attempt alternate channel before 10:20');
    assert.equal(store.getOutreachSchedule(caseId).deliveryState, OUTREACH_STATE.ALTERNATE_CHANNEL);

    // Advance to 10:20
    currentClock += 5 * 60_000;
    const dueTick = await scheduler.tick();
    assert.equal(dueTick.length, 1, 'Scheduler at 10:20 should attempt alternate channel');
    assert.equal(store.getOutreachSchedule(caseId).deliveryState, OUTREACH_STATE.DELIVERED);
    assert.equal(store.getOutreachSchedule(caseId).lastSuccessfulChannel, CHANNELS.SMS);
  });

  test('7. repeated scheduler ticks do not duplicate attempts', async () => {
    const caseId = 'SIH-CASE-0001';
    outreachService.scheduleCheckin(caseId, { preferredChannel: CHANNELS.APP });

    // Initial failure at 10:00
    await outreachService.attemptDelivery(caseId, { simulateFailure: true });
    assert.equal(store.getOutreachSchedule(caseId).attemptCount, 1);

    const scheduler = new OutreachScheduler(store, outreachService, {
      enabled: true,
      nowFn: () => currentClock,
    });

    // Advance to 10:10
    currentClock += RETRY_DELAY;

    // Tick 1 executes retry and succeeds -> DELIVERED
    const tick1 = await scheduler.tick();
    assert.equal(tick1.length, 1);
    assert.equal(store.getOutreachSchedule(caseId).deliveryState, OUTREACH_STATE.DELIVERED);
    assert.equal(store.getOutreachSchedule(caseId).attemptCount, 2);

    // Tick 2 at 10:10:01
    currentClock += 1000;
    const tick2 = await scheduler.tick();
    assert.equal(tick2.length, 0, 'Delivered schedule must not be retried');
    assert.equal(store.getOutreachSchedule(caseId).attemptCount, 2);

    // Tick 3 at 10:15:00
    currentClock += 5 * 60_000;
    const tick3 = await scheduler.tick();
    assert.equal(tick3.length, 0);
    assert.equal(store.getOutreachSchedule(caseId).attemptCount, 2);
  });
});
