/**
 * Quick smoke test for the API routes.
 * Tests: health, auth, counsellor (Tier 1), admin (Tier 2), cross-tier rejection.
 */

import http from 'node:http';

const BASE = 'http://localhost:3001';

function request(method, path, { body, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: { 'Content-Type': 'application/json' },
    };
    if (cookie) opts.headers.Cookie = cookie;

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        resolve({
          status: res.status ?? res.statusCode,
          body: parsed,
          cookie: res.headers['set-cookie']?.[0]?.split(';')[0] ?? cookie ?? null,
        });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const results = [];
function check(label, ok) {
  results.push({ label, ok });
  console.log(ok ? '  ✔' : '  ✗', label);
}

async function run() {
  console.log('\nAPI smoke tests\n');

  // Health
  const h = await request('GET', '/api/health');
  check('Health endpoint returns 200', h.status === 200);
  check('Health reports LLM mode', typeof h.body.llmMode === 'string');

  // Login as counsellor
  const loginC = await request('POST', '/api/auth/login', {
    body: { username: 'counsellor', passcode: 'demo' },
  });
  check('Counsellor login succeeds', loginC.status === 200 && loginC.body.user?.role === 'counsellor');
  const cCookie = loginC.cookie;

  // Counsellor cases
  const cases = await request('GET', '/api/counsellor/cases', { cookie: cCookie });
  check('Counsellor gets cases', cases.status === 200 && cases.body.cases?.length === 6);
  check('Cases are ranked', cases.body.cases[0]?.assessment?.escalated === true);

  // Counsellor case detail
  const detail = await request('GET', '/api/counsellor/cases/SIH-CASE-0001', { cookie: cCookie });
  check('Case detail returns data', detail.status === 200 && detail.body.caseRecord?.caseId === 'SIH-CASE-0001');
  check('Case has trend data', detail.body.trendData?.length > 0);
  check('Case has check-in history', detail.body.checkIns?.length > 0);

  // Counsellor alerts
  const alerts = await request('GET', '/api/counsellor/alerts', { cookie: cCookie });
  check('Alerts returned', alerts.status === 200 && alerts.body.alerts?.length > 0);
  check('Alerts have trigger reasons', alerts.body.alerts[0]?.assessment?.triggerReasons?.length > 0);

  // Login as admin
  const loginA = await request('POST', '/api/auth/login', {
    body: { username: 'admin', passcode: 'demo' },
  });
  check('Admin login succeeds', loginA.status === 200 && loginA.body.user?.role === 'admin');
  const aCookie = loginA.cookie;

  // Admin summary
  const summary = await request('GET', '/api/admin/summary', { cookie: aCookie });
  check('Admin summary returned', summary.status === 200 && summary.body.total === 6);

  // Admin trends
  const trends = await request('GET', '/api/admin/trends', { cookie: aCookie });
  check('Admin trends returned', trends.status === 200 && trends.body.bandDistribution);

  // Admin geography
  const geo = await request('GET', '/api/admin/geography?scope=national', { cookie: aCookie });
  check('Admin geography returned', geo.status === 200 && geo.body.groups?.length > 0);

  // Cross-tier: counsellor -> admin (should 403)
  const cross1 = await request('GET', '/api/admin/summary', { cookie: cCookie });
  check('Counsellor denied admin access (403)', cross1.status === 403);

  // Cross-tier: admin -> counsellor (should 403)
  const cross2 = await request('GET', '/api/counsellor/cases', { cookie: aCookie });
  check('Admin denied counsellor access (403)', cross2.status === 403);

  // Unauthenticated -> 401
  const unauth = await request('GET', '/api/counsellor/cases');
  check('Unauthenticated request returns 401', unauth.status === 401);

  // Unknown endpoint -> 404
  const notfound = await request('GET', '/api/nope', { cookie: cCookie });
  check('Unknown endpoint returns 404', notfound.status === 404);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n  ${passed}/${results.length} passed\n`);
}

run().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
