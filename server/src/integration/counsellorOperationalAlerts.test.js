/**
 * Integration test: Counsellor Operational Alert Visibility & Resolution.
 *
 * Verifies that when outreach is exhausted:
 * 1. Operational alert is visible to counsellor via /api/counsellor/alerts and /api/counsellor/operational-alerts.
 * 2. Counsellor can resolve the operational alert via POST /api/counsellor/operational-alerts/:id/resolve.
 * 3. Audit trail logs the resolution.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import { authRouter } from '../routes/auth.js';
import { counsellorRouter } from '../routes/counsellor.js';
import { store } from '../store/memoryStore.js';
import { OutreachService, CHANNELS } from '../domain/outreachOrchestrator.js';

let server;
let baseUrl;
let counsellorCookie;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret-counsellor-alerts',
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use('/api/auth', authRouter);
  app.use('/api/counsellor', counsellorRouter);
  return app;
}

async function loginAs(username, passcode = 'demo') {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passcode }),
    redirect: 'manual',
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

async function authedGet(path, cookie) {
  return fetch(`${baseUrl}${path}`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
}

async function authedPost(path, cookie, body) {
  return fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
    },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
}

describe('P1-5: Counsellor Operational Alert Workflow', () => {
  before(async () => {
    store.reset();
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
    counsellorCookie = await loginAs('counsellor', 'demo');
  });

  after(() => {
    server?.close();
  });

  test('exhausted outreach creates alert visible in counsellor queue and can be resolved', async () => {
    const caseId = 'SIH-CASE-0001';
    const outreachService = new OutreachService(store);

    // Simulate exhausting all channels
    const sched = store.getOutreachSchedule(caseId);
    sched.lastAttemptedChannel = CHANNELS.IVRS;
    sched.attemptCount = 2;
    store.updateOutreachSchedule(caseId, sched);
    outreachService.handleDeliveryFailure(caseId, 'Exhausted in test');

    // 1. Check GET /api/counsellor/operational-alerts
    const res1 = await authedGet('/api/counsellor/operational-alerts', counsellorCookie);
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.ok(Array.isArray(body1.operationalAlerts));
    const opAlert = body1.operationalAlerts.find((a) => a.caseId === caseId);
    assert.ok(opAlert, 'Operational alert should be in counsellor operational alerts list');
    assert.equal(opAlert.type, 'outreach_exhausted');
    assert.equal(opAlert.status, 'active');
    assert.match(opAlert.reason, /Repeated unsuccessful contact across configured outreach channels/i);

    // 2. Check GET /api/counsellor/alerts
    const res2 = await authedGet('/api/counsellor/alerts', counsellorCookie);
    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.ok(Array.isArray(body2.operationalAlerts));
    assert.ok(body2.operationalAlerts.some((a) => a.id === opAlert.id));

    // 3. Resolve the alert via POST /api/counsellor/operational-alerts/:id/resolve
    const res3 = await authedPost(`/api/counsellor/operational-alerts/${opAlert.id}/resolve`, counsellorCookie, {
      note: 'Field welfare visit completed; victim reached.',
    });
    assert.equal(res3.status, 200);
    const body3 = await res3.json();
    assert.equal(body3.ok, true);
    assert.equal(body3.alert.status, 'resolved');
    assert.equal(body3.alert.resolutionNote, 'Field welfare visit completed; victim reached.');

    // 4. Verify no longer active
    const res4 = await authedGet('/api/counsellor/operational-alerts?status=active', counsellorCookie);
    const body4 = await res4.json();
    assert.equal(body4.operationalAlerts.find((a) => a.id === opAlert.id), undefined);
  });
});
