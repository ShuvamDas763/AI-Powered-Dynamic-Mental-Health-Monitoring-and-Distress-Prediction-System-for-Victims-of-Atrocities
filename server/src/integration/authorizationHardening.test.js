/**
 * Mandatory P0-2 and P0-3 Acceptance Tests: Authorization Hardening.
 *
 * Exercises:
 * - Consent routes: GET /, POST /, POST /revoke
 * - Outreach routes: GET /:caseId, POST /schedule, POST /:id/simulate-delivery, POST /:id/simulate-response
 *
 * Verifies strict case-scoping for victims, tier-isolation for admins,
 * and valid-case bounds for counsellors.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import session from 'express-session';
import { authRouter } from '../routes/auth.js';
import { consentRouter } from '../routes/consent.js';
import { outreachRouter } from '../routes/outreach.js';
import { store } from '../store/memoryStore.js';

let server;
let baseUrl;
let victimCookie; // SIH-CASE-0001
let victimBCookie; // SIH-CASE-0002
let counsellorCookie;
let adminCookie;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    session({
      secret: 'test-secret-authz',
      resave: false,
      saveUninitialized: false,
    }),
  );
  app.use('/api/auth', authRouter);
  app.use('/api/consent', consentRouter);
  app.use('/api/outreach', outreachRouter);
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

describe('Authorization Hardening (P0-2 & P0-3)', () => {
  before(async () => {
    store.reset();
    const app = createApp();
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseUrl = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });

    victimCookie = await loginAs('victim', 'demo'); // caseId SIH-CASE-0001
    victimBCookie = await loginAs('case-b', 'demo'); // caseId SIH-CASE-0002
    counsellorCookie = await loginAs('counsellor', 'demo');
    adminCookie = await loginAs('admin', 'demo');
  });

  after(() => {
    server?.close();
  });

  describe('P0-2: Consent Case Authorization Hardening', () => {
    test('1. Victim can GET own consent', async () => {
      const res = await authedGet('/api/consent', victimCookie);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.caseId, 'SIH-CASE-0001');
      assert.equal(body.granted, true);
    });

    test('2. Victim cannot GET another case consent', async () => {
      // Attempt to request Victim B's consent by passing query param
      const res = await authedGet('/api/consent?caseId=SIH-CASE-0002', victimCookie);
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.match(body.error, /own case/i);
    });

    test('3. Victim can POST own consent', async () => {
      const res = await authedPost('/api/consent', victimCookie, {
        caseId: 'SIH-CASE-0001',
        purposes: { monitoring: true, communication: true },
        channelsAllowed: ['app', 'web', 'sms'],
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.equal(body.record.caseId, 'SIH-CASE-0001');
    });

    test('4. Victim cannot modify another case consent', async () => {
      const res = await authedPost('/api/consent', victimCookie, {
        caseId: 'SIH-CASE-0002', // Belongs to Victim B
        purposes: { monitoring: false },
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.match(body.error, /own case/i);
    });

    test('5. Victim can revoke own consent', async () => {
      const res = await authedPost('/api/consent/revoke', victimCookie, {
        caseId: 'SIH-CASE-0001',
        reason: 'Testing revocation',
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.ok, true);
      assert.ok(body.record.revokedAt);
    });

    test('6. Victim cannot revoke another case consent', async () => {
      const res = await authedPost('/api/consent/revoke', victimCookie, {
        caseId: 'SIH-CASE-0002', // Belongs to Victim B
        reason: 'Malicious revocation attempt',
      });
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.match(body.error, /own case/i);
    });

    test('7. Counsellor can access authorized cases in Tier 1', async () => {
      const res = await authedGet('/api/consent?caseId=SIH-CASE-0001', counsellorCookie);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.caseId, 'SIH-CASE-0001');
    });

    test('8. Counsellor cannot access non-existent cases', async () => {
      const res = await authedGet('/api/consent?caseId=SIH-CASE-NONEXISTENT', counsellorCookie);
      assert.equal(res.status, 404);
    });

    test('9. Admin receives 403 for identified consent access (GET, POST, revoke)', async () => {
      const getRes = await authedGet('/api/consent?caseId=SIH-CASE-0001', adminCookie);
      assert.equal(getRes.status, 403);

      const postRes = await authedPost('/api/consent', adminCookie, {
        caseId: 'SIH-CASE-0001',
        purposes: { monitoring: true },
      });
      assert.equal(postRes.status, 403);

      const revokeRes = await authedPost('/api/consent/revoke', adminCookie, {
        caseId: 'SIH-CASE-0001',
        reason: 'Admin attempt',
      });
      assert.equal(revokeRes.status, 403);
    });

    test('10. Client-controlled caseId cannot bypass authorization', async () => {
      // Victim B attempts to pass Victim A's case in body
      const res = await authedPost('/api/consent', victimBCookie, {
        caseId: 'SIH-CASE-0001',
        purposes: { monitoring: false },
      });
      assert.equal(res.status, 403);
    });
  });

  describe('P0-3: Outreach Mutation Case Authorization Hardening', () => {
    test('1. Victim A cannot schedule for Victim B', async () => {
      const res = await authedPost('/api/outreach/schedule', victimCookie, {
        caseId: 'SIH-CASE-0002',
        nextCheckInDate: '2026-10-01',
      });
      assert.equal(res.status, 403);
    });

    test('2. Victim A cannot simulate delivery for Victim B', async () => {
      const res = await authedPost('/api/outreach/SIH-CASE-0002/simulate-delivery', victimCookie, {
        simulateFailure: false,
      });
      assert.equal(res.status, 403);
    });

    test('3. Victim A cannot simulate response for Victim B', async () => {
      const res = await authedPost('/api/outreach/SIH-CASE-0002/simulate-response', victimCookie, {
        message: 'Spoofed response',
      });
      assert.equal(res.status, 403);
    });

    test('4. Unassigned / non-existent case returns 404 for counsellor', async () => {
      const res = await authedGet('/api/outreach/SIH-CASE-NONEXISTENT', counsellorCookie);
      assert.equal(res.status, 404);

      const simRes = await authedPost('/api/outreach/SIH-CASE-NONEXISTENT/simulate-delivery', counsellorCookie, {});
      assert.equal(simRes.status, 404);
    });

    test('5. Admin receives 403 on all individual outreach endpoints', async () => {
      const getRes = await authedGet('/api/outreach/SIH-CASE-0001', adminCookie);
      assert.equal(getRes.status, 403);

      const schedRes = await authedPost('/api/outreach/schedule', adminCookie, {
        caseId: 'SIH-CASE-0001',
      });
      assert.equal(schedRes.status, 403);

      const delivRes = await authedPost('/api/outreach/SIH-CASE-0001/simulate-delivery', adminCookie, {});
      assert.equal(delivRes.status, 403);

      const respRes = await authedPost('/api/outreach/SIH-CASE-0001/simulate-response', adminCookie, {});
      assert.equal(respRes.status, 403);
    });

    test('6. Authorized counsellor can perform permitted outreach operations', async () => {
      const getRes = await authedGet('/api/outreach/SIH-CASE-0001', counsellorCookie);
      assert.equal(getRes.status, 200);

      const schedRes = await authedPost('/api/outreach/schedule', counsellorCookie, {
        caseId: 'SIH-CASE-0001',
        nextCheckInDate: '2026-10-15',
      });
      assert.equal(schedRes.status, 200);

      const delivRes = await authedPost('/api/outreach/SIH-CASE-0001/simulate-delivery', counsellorCookie, {});
      assert.equal(delivRes.status, 200);
    });

    test('7. Victim can perform permitted outreach operations on own case', async () => {
      const getRes = await authedGet('/api/outreach/SIH-CASE-0001', victimCookie);
      assert.equal(getRes.status, 200);

      const schedRes = await authedPost('/api/outreach/schedule', victimCookie, {
        caseId: 'SIH-CASE-0001',
        nextCheckInDate: '2026-10-20',
      });
      assert.equal(schedRes.status, 200);
    });
  });
});
