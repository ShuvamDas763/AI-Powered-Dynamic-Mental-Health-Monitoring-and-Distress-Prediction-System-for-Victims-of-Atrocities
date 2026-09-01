/**
 * Integration tests — cross-tier access control and crisis detection.
 *
 * These tests exercise the Express route layer end-to-end: they spin up a
 * minimal Express app with the real routers, log in as each role, and verify
 * that the two-tier boundary holds. They also verify that the crisis-
 * detection hard-trigger fires through the full checkin route, not just
 * in unit tests on the detection module.
 *
 * Run:  node --test server/src/integration/crossTier.test.js
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import { authRouter } from '../routes/auth.js';
import { checkinRouter } from '../routes/checkin.js';
import { counsellorRouter } from '../routes/counsellor.js';
import { adminRouter } from '../routes/admin.js';
import { store } from '../store/memoryStore.js';

/* ── helpers ────────────────────────────────────────────────────────── */

let server;
let baseUrl;

/** Build a minimal Express app with the real routers and session. */
function createApp() {
  const app = express();
  app.use(express.json());
  app.use(session({
    secret: 'test-secret',
    resave: false,
    saveUninitialized: false,
  }));
  app.use('/api/auth', authRouter);
  app.use('/api/checkin', checkinRouter);
  app.use('/api/counsellor', counsellorRouter);
  app.use('/api/admin', adminRouter);
  return app;
}

/** Login as a role and return the cookie header for subsequent requests. */
async function loginAs(username, passcode = 'demo') {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, passcode }),
    redirect: 'manual',
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  const cookie = setCookie
    .map((c) => c.split(';')[0])
    .join('; ');
  return cookie;
}

/** Make an authenticated GET request. */
async function authedGet(path, cookie) {
  return fetch(`${baseUrl}${path}`, {
    headers: { Cookie: cookie },
    redirect: 'manual',
  });
}

/** Make an authenticated POST request. */
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

/* ── setup / teardown ──────────────────────────────────────────────── */

before(async () => {
  // Reset store to seed state.
  store.reset();

  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(() => {
  server?.close();
});

/* ── Cross-tier 403 tests ──────────────────────────────────────────── */

describe('Cross-tier access control', () => {
  let victimCookie, counsellorCookie, adminCookie;

  before(async () => {
    victimCookie = await loginAs('victim');
    counsellorCookie = await loginAs('counsellor');
    adminCookie = await loginAs('admin');
  });

  // Victim → Counsellor routes
  test('victim gets 403 on counsellor cases', async () => {
    const res = await authedGet('/api/counsellor/cases', victimCookie);
    assert.equal(res.status, 403);
  });

  test('victim gets 403 on counsellor case detail', async () => {
    const res = await authedGet('/api/counsellor/cases/SIH-CASE-0001', victimCookie);
    assert.equal(res.status, 403);
  });

  test('victim gets 403 on counsellor alerts', async () => {
    const res = await authedGet('/api/counsellor/alerts', victimCookie);
    assert.equal(res.status, 403);
  });

  // Victim → Admin routes
  test('victim gets 403 on admin summary', async () => {
    const res = await authedGet('/api/admin/summary', victimCookie);
    assert.equal(res.status, 403);
  });

  // Counsellor → Admin routes
  test('counsellor gets 403 on admin summary', async () => {
    const res = await authedGet('/api/admin/summary', counsellorCookie);
    assert.equal(res.status, 403);
  });

  // Counsellor → Checkin route
  test('counsellor gets 403 on checkin', async () => {
    const res = await authedPost('/api/checkin', counsellorCookie, {
      caseId: 'SIH-CASE-0001',
      turns: [{ speaker: 'person', text: 'test' }],
    });
    assert.equal(res.status, 403);
  });

  // Admin → Counsellor routes
  test('admin gets 403 on counsellor cases', async () => {
    const res = await authedGet('/api/counsellor/cases', adminCookie);
    assert.equal(res.status, 403);
  });

  // Admin → Checkin route
  test('admin gets 403 on checkin', async () => {
    const res = await authedPost('/api/checkin', adminCookie, {
      caseId: 'SIH-CASE-0001',
      turns: [{ speaker: 'person', text: 'test' }],
    });
    assert.equal(res.status, 403);
  });

  // Positive controls — roles CAN access their own routes
  test('counsellor can access counsellor cases', async () => {
    const res = await authedGet('/api/counsellor/cases', counsellorCookie);
    assert.equal(res.status, 200);
  });

  test('admin can access admin summary', async () => {
    const res = await authedGet('/api/admin/summary', adminCookie);
    assert.equal(res.status, 200);
  });

  test('unauthenticated gets 401 on protected routes', async () => {
    const res = await authedGet('/api/counsellor/cases', '');
    assert.equal(res.status, 401);
  });
});

/* ── Crisis detection end-to-end ───────────────────────────────────── */

describe('Crisis detection through checkin route', () => {
  let victimCookie;

  before(async () => {
    victimCookie = await loginAs('victim');
  });

  test('crisis text triggers crisis response in checkin', async () => {
    const res = await authedPost('/api/checkin', victimCookie, {
      caseId: 'SIH-CASE-0001',
      turns: [{ speaker: 'person', text: 'I feel like ending my life' }],
      locale: 'hi',
      channel: 'app',
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.ok, true);

    // Crisis response must be present
    assert.ok(body.crisisResponse, 'crisisResponse should be present');
    assert.equal(body.crisisResponse.triggered, true);
    assert.equal(body.crisisResponse.category, 'explicit_intent');
    assert.ok(body.crisisResponse.helpline, 'helpline should be present');

    // Assessment must show escalation
    assert.equal(body.assessment.escalation.triggered, true);
    const codes = body.assessment.escalation.triggerReasons.map((r) => r.code);
    assert.ok(codes.includes('crisis_detected'), 'crisis_detected trigger must fire');

    // Score must be forced high regardless of LLM reading
    assert.ok(body.assessment.score >= 60, `score should be elevated, got ${body.assessment.score}`);
  });

  test('non-crisis text does NOT trigger crisis response', async () => {
    const res = await authedPost('/api/checkin', victimCookie, {
      caseId: 'SIH-CASE-0001',
      turns: [{ speaker: 'person', text: 'Things are going well, thank you for checking' }],
      locale: 'hi',
      channel: 'app',
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.crisisResponse, undefined, 'crisisResponse should not be present for non-crisis text');
  });

  test('crisis fires for Hindi self-harm text', async () => {
    const res = await authedPost('/api/checkin', victimCookie, {
      caseId: 'SIH-CASE-0001',
      turns: [{ speaker: 'person', text: 'मैं मरना चाहता हूँ' }],
      locale: 'hi',
      channel: 'app',
    });
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.ok(body.crisisResponse, 'Hindi crisis text should trigger crisis response');
    assert.equal(body.crisisResponse.category, 'explicit_intent');
  });

  test('victim cannot submit check-in for another case', async () => {
    const res = await authedPost('/api/checkin', victimCookie, {
      caseId: 'SIH-CASE-0002', // Not victim's case
      turns: [{ speaker: 'person', text: 'hello' }],
    });
    assert.equal(res.status, 403);
  });

  test('empty turns returns 400', async () => {
    const res = await authedPost('/api/checkin', victimCookie, {
      caseId: 'SIH-CASE-0001',
      turns: [],
    });
    assert.equal(res.status, 400);
  });

  test('missing caseId returns 400', async () => {
    const res = await authedPost('/api/checkin', victimCookie, {
      turns: [{ speaker: 'person', text: 'hello' }],
    });
    assert.equal(res.status, 400);
  });
});
