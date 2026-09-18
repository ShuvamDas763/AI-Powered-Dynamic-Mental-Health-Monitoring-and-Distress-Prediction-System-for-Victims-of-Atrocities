/**
 * Mandatory P0-1 Acceptance Test: Consent Before Analysis Enforcement.
 *
 * Verifies that:
 * 1. A routine check-in without active monitoring consent is rejected with 403 and consentRequired=true.
 * 2. The analysis provider call count is strictly 0 (never called when consent is absent/revoked).
 * 3. Emergency life-safety crisis path triggers and executes even if routine monitoring consent is absent/revoked.
 * 4. Routine check-ins with active consent invoke the analysis provider and succeed.
 */

import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import { authRouter } from '../routes/auth.js';
import { checkinRouter } from '../routes/checkin.js';
import { consentRouter } from '../routes/consent.js';
import { store } from '../store/memoryStore.js';
import { analysisProvider } from '../llm/groqClient.js';

let server;
let baseUrl;
let victimCookie;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret-consent',
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use('/api/auth', authRouter);
  app.use('/api/checkin', checkinRouter);
  app.use('/api/consent', consentRouter);
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

describe('P0-1: Server-Authoritative Consent Before Analysis', () => {
  before(async () => {
    store.reset();
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
    victimCookie = await loginAs('victim', 'demo');
  });

  after(() => {
    server?.close();
  });

  beforeEach(() => {
    analysisProvider.resetCallCount();
  });

  test('routine check-in with revoked consent is rejected (403) and analysis provider is NEVER called', async () => {
    // 1. Revoke monitoring consent for the case
    store.revokeConsent('SIH-CASE-0001', 'Victim requested revocation for privacy');
    analysisProvider.resetCallCount();

    // 2. Submit non-crisis routine check-in
    const res = await authedPost('/api/checkin', victimCookie, {
      caseId: 'SIH-CASE-0001',
      turns: [{ speaker: 'person', text: 'I went to work today and felt fine' }],
      locale: 'en',
      channel: 'app',
    });

    // 3. Verify 403 and consentRequired
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.consentRequired, true);
    assert.match(body.error, /Active monitoring consent is required/i);

    // 4. Critical invariant: analysis provider call count MUST be exactly 0
    assert.equal(
      analysisProvider.callCount,
      0,
      'Analysis provider was called despite absence of active monitoring consent!',
    );
  });

  test('crisis text WITHOUT routine consent bypasses restriction and executes emergency safety path', async () => {
    // Ensure consent is still revoked
    const consent = store.getConsent('SIH-CASE-0001');
    assert.ok(consent?.revokedAt, 'Consent should be in revoked state');
    analysisProvider.resetCallCount();

    // Submit acute crisis text
    const res = await authedPost('/api/checkin', victimCookie, {
      caseId: 'SIH-CASE-0001',
      turns: [{ speaker: 'person', text: 'I keep thinking about killing myself' }],
      locale: 'en',
      channel: 'app',
    });

    // Life-safety emergency path must execute (NOT 403!)
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.ok(body.crisisResponse, 'crisisResponse must be present in emergency path');
    assert.equal(body.crisisResponse.triggered, true);
    assert.equal(body.crisisResponse.category, 'explicit_intent');
    assert.ok(body.crisisResponse.helpline, 'Emergency helpline must be provided');
    assert.match(body.followUp, /Tele-MANAS/i);

    // Routine analysis provider was NOT called
    assert.equal(analysisProvider.callCount, 0);

    // Case is escalated in store
    const latest = store.getLatestAssessment('SIH-CASE-0001');
    assert.equal(latest.escalation.triggered, true);
  });

  test('routine check-in with active consent calls analysis provider and succeeds', async () => {
    // Re-grant consent for the case
    await authedPost('/api/consent', victimCookie, {
      caseId: 'SIH-CASE-0001',
      purposes: { monitoring: true, communication: true },
      channelsAllowed: ['app', 'web'],
    });
    analysisProvider.resetCallCount();

    // Submit non-crisis routine check-in
    const res = await authedPost('/api/checkin', victimCookie, {
      caseId: 'SIH-CASE-0001',
      turns: [{ speaker: 'person', text: 'Everything is peaceful today, had tea with family' }],
      locale: 'en',
      channel: 'app',
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.crisisResponse, undefined);

    // Analysis provider was invoked exactly once
    assert.equal(analysisProvider.callCount, 1);
  });
});
