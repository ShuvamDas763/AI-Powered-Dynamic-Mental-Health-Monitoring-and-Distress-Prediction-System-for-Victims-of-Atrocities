import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OutreachService,
  WebAdapter,
  AppAdapter,
  SMSAdapter,
  IVRSAdapter,
  OUTREACH_STATE,
  CHANNELS,
} from './outreachOrchestrator.js';
import { createStore } from '../store/memoryStore.js';

describe('Outreach Orchestrator & Channel Adapters', () => {
  test('all four channel adapters dispatch successfully with gateway metadata', async () => {
    const web = new WebAdapter();
    const app = new AppAdapter();
    const sms = new SMSAdapter();
    const ivrs = new IVRSAdapter();

    const wRes = await web.dispatch({ caseId: 'CASE-01', recipientIdentifier: 'user1', message: 'Hello', locale: 'en' });
    const aRes = await app.dispatch({ caseId: 'CASE-01', recipientIdentifier: 'user1', message: 'Hello', locale: 'en' });
    const sRes = await sms.dispatch({ caseId: 'CASE-01', recipientIdentifier: 'user1', message: 'Hello', locale: 'hi' });
    const iRes = await ivrs.dispatch({ caseId: 'CASE-01', recipientIdentifier: 'user1', message: 'Hello', locale: 'hi' });

    assert.equal(wRes.success, true);
    assert.equal(aRes.success, true);
    assert.equal(sRes.success, true);
    assert.equal(iRes.success, true);

    assert.ok(wRes.gatewayMessageId.startsWith('web-push-'));
    assert.ok(aRes.gatewayMessageId.startsWith('fcm-push-'));
    assert.ok(sRes.gatewayMessageId.startsWith('nic-sms-'));
    assert.ok(iRes.gatewayMessageId.startsWith('ivrs-call-'));
  });

  test('happy path: schedule -> delivery -> response', async () => {
    const store = createStore({ now: Date.now() });
    const outreach = new OutreachService(store);

    outreach.scheduleCheckin('SIH-CASE-0001', {
      nextCheckInDate: '2026-09-25',
      preferredChannel: CHANNELS.APP,
    });

    let sched = store.getOutreachSchedule('SIH-CASE-0001');
    assert.equal(sched.deliveryState, OUTREACH_STATE.CHECKIN_DUE);
    assert.equal(sched.nextCheckInDate, '2026-09-25');

    // Attempt delivery
    const delivery = await outreach.attemptDelivery('SIH-CASE-0001');
    assert.equal(delivery.ok, true);
    sched = store.getOutreachSchedule('SIH-CASE-0001');
    assert.equal(sched.deliveryState, OUTREACH_STATE.DELIVERED);
    assert.equal(sched.lastSuccessfulChannel, CHANNELS.APP);

    // Record response
    const resp = outreach.recordResponse('SIH-CASE-0001');
    assert.equal(resp.deliveryState, OUTREACH_STATE.RESPONDED);
    assert.equal(resp.missedStreak, 0);
  });

  test('failure fallback: retry -> alternate channel -> counsellor flag', async () => {
    const store = createStore({ now: Date.now() });
    const outreach = new OutreachService(store);

    outreach.scheduleCheckin('SIH-CASE-0002', {
      preferredChannel: CHANNELS.APP,
    });

    // Attempt 1 fails -> RETRY
    const f1 = await outreach.attemptDelivery('SIH-CASE-0002', { simulateFailure: true });
    assert.equal(f1.ok, false);
    assert.equal(f1.state, OUTREACH_STATE.RETRY);

    // Attempt 2 fails -> ALTERNATE_CHANNEL (app -> sms)
    const f2 = await outreach.attemptDelivery('SIH-CASE-0002', { simulateFailure: true });
    assert.equal(f2.ok, false);
    assert.equal(f2.state, OUTREACH_STATE.ALTERNATE_CHANNEL);
    let sched = store.getOutreachSchedule('SIH-CASE-0002');
    assert.equal(sched.preferredChannel, CHANNELS.SMS);

    // Attempt on SMS fails twice -> ALTERNATE_CHANNEL (sms -> ivrs)
    await outreach.attemptDelivery('SIH-CASE-0002', { simulateFailure: true });
    await outreach.attemptDelivery('SIH-CASE-0002', { simulateFailure: true });
    sched = store.getOutreachSchedule('SIH-CASE-0002');
    assert.equal(sched.preferredChannel, CHANNELS.IVRS);

    // Attempt on IVRS fails twice -> COUNSELLOR_FLAG
    await outreach.attemptDelivery('SIH-CASE-0002', { simulateFailure: true });
    const fFinal = await outreach.attemptDelivery('SIH-CASE-0002', { simulateFailure: true });
    assert.equal(fFinal.state, OUTREACH_STATE.COUNSELLOR_FLAG);
    sched = store.getOutreachSchedule('SIH-CASE-0002');
    assert.ok(sched.missedStreak >= 1);
  });
});
