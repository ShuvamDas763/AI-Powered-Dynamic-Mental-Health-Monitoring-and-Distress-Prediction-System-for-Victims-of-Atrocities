#!/usr/bin/env node
/**
 * Comprehensive Playtest — drives every API endpoint as a real user would.
 * Tests: auth, victim flows, counsellor flows, admin flows, edge cases, access control.
 */

const BASE = 'http://localhost:3001';

let passed = 0;
let failed = 0;
const defects = [];

async function req(method, path, body, cookie) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (cookie) opts.headers['Cookie'] = cookie;
  const r = await fetch(`${BASE}${path}`, opts);
  const setCookie = r.headers.get('set-cookie');
  const sid = setCookie?.match(/sih26094\.sid=([^;]+)/)?.[1];
  const text = await r.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: r.status, json, sid, setCookie };
}

function check(name, condition, detail) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`);
    defects.push({ name, detail });
  }
}

async function login(username, passcode) {
  const r = await req('POST', '/api/auth/login', { username, passcode });
  const sid = r.sid;
  return { ...r, cookie: sid ? `sih26094.sid=${sid}` : null };
}

// ─── 1. HEALTH ───────────────────────────────────────────────────────────
console.log('\n═══ 1. HEALTH CHECK ═══');
{
  const r = await req('GET', '/api/health');
  check('health returns 200', r.status === 200);
  check('health reports status ok', r.json?.status === 'ok');
  check('health reports llmMode', !!r.json?.llmMode);
}

// ─── 2. AUTH — VALID LOGINS ─────────────────────────────────────────────
console.log('\n═══ 2. AUTH — VALID LOGINS ═══');
const accounts = [
  { user: 'victim', pass: 'demo', role: 'victim', caseId: 'SIH-CASE-0001' },
  { user: 'case-b', pass: 'demo', role: 'victim', caseId: 'SIH-CASE-0002' },
  { user: 'counsellor', pass: 'demo', role: 'counsellor' },
  { user: 'admin', pass: 'demo', role: 'admin' },
];
const sessions = {};
for (const a of accounts) {
  const r = await login(a.user, a.pass);
  check(`login ${a.user} → 200`, r.status === 200);
  check(`login ${a.user} → role=${a.role}`, r.json?.user?.role === a.role);
  if (a.caseId) check(`login ${a.user} → caseId=${a.caseId}`, r.json?.user?.caseId === a.caseId);
  sessions[a.user] = r.cookie;
}

// ─── 3. AUTH — INVALID LOGINS ──────────────────────────────────────────
console.log('\n═══ 3. AUTH — INVALID LOGINS ═══');
{
  const r1 = await req('POST', '/api/auth/login', { username: 'victim', passcode: 'wrong' });
  check('wrong password → 401', r1.status === 401);
  const r2 = await req('POST', '/api/auth/login', { username: 'nonexistent', passcode: 'demo' });
  check('unknown user → 401', r2.status === 401);
  const r3 = await req('POST', '/api/auth/login', {});
  check('empty body → 401', r3.status === 401);
  const r4 = await req('POST', '/api/auth/login', { username: null, passcode: null });
  check('null fields → 401', r4.status === 401);
}

// ─── 4. AUTH — /me ENDPOINT ────────────────────────────────────────────
console.log('\n═══ 4. AUTH — /me ENDPOINT ═══');
{
  const r1 = await req('GET', '/api/auth/me', null, sessions.victim);
  check('victim /me → 200 with user', r1.status === 200 && !!r1.json?.user);
  check('victim /me → role=victim', r1.json?.user?.role === 'victim');
  const r2 = await req('GET', '/api/auth/me');
  check('no session /me → null user', r2.status === 200 && r2.json?.user === null);
}

// ─── 5. AUTH — LOGOUT ─────────────────────────────────────────────────
console.log('\n═══ 5. AUTH — LOGOUT ═══');
{
  const loginR = await login('victim', 'demo');
  const r1 = await req('POST', '/api/auth/logout', null, loginR.cookie);
  check('logout → 200 ok', r1.status === 200 && r1.json?.ok === true);
  const r2 = await req('GET', '/api/auth/me', null, loginR.cookie);
  check('after logout /me → null', r2.json?.user === null);
}

// ─── 6. VICTIM — CHECK-IN (normal) ─────────────────────────────────────
console.log('\n═══ 6. VICTIM — CHECK-IN ═══');
{
  const r = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0001',
    turns: [{ speaker: 'person', text: 'I feel worried about the court date' }],
    locale: 'en',
  }, sessions.victim);
  check('check-in → 200', r.status === 200);
  check('check-in → assessment.score exists', typeof r.json?.assessment?.score === 'number');
  check('check-in → assessment.band exists', !!r.json?.assessment?.band);
  check('check-in → followUp string', typeof r.json?.followUp === 'string' && r.json.followUp.length > 10);
  check('check-in → analysis.provenance', !!r.json?.analysis?.provenance);
}

// ─── 7. VICTIM — CHECK-IN (Hindi) ──────────────────────────────────────
console.log('\n═══ 7. VICTIM — CHECK-IN (Hindi) ═══');
{
  const r = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0001',
    turns: [{ speaker: 'person', text: 'मुझे जाँच शुरू न होने से बहुत चिंता हो रही है' }],
    locale: 'hi',
  }, sessions.victim);
  check('Hindi check-in → 200', r.status === 200);
  check('Hindi check-in → assessment exists', !!r.json?.assessment);
  check('Hindi check-in → followUp exists', typeof r.json?.followUp === 'string');
}

// ─── 8. VICTIM — CHECK-IN (crisis: self-harm) ─────────────────────────
console.log('\n═══ 8. VICTIM — CHECK-IN (CRISIS) ═══');
{
  const r = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0002',
    turns: [{ speaker: 'person', text: 'I want to kill myself, I cannot take this anymore' }],
  }, sessions['case-b']);
  check('crisis check-in → 200', r.status === 200);
  check('crisis → crisisResponse triggered', r.json?.crisisResponse?.triggered === true);
  check('crisis → helpline provided', !!r.json?.crisisResponse?.helpline?.number);
  check('crisis → sentiment component boosted to 95', r.json?.assessment?.components?.sentiment === 95);
}

// ─── 9. VICTIM — CHECK-IN (wrong case) ────────────────────────────────
console.log('\n═══ 9. VICTIM — ACCESS CONTROL ═══');
{
  const r1 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0003',
    turns: [{ speaker: 'person', text: 'test' }],
  }, sessions.victim);
  check('victim A can NOT check-in to case C → 403', r1.status === 403);

  const r2 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0001',
    turns: [{ speaker: 'person', text: 'test' }],
  }, sessions.counsellor);
  check('counsellor can NOT submit check-in → 403', r2.status === 403);

  const r3 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0001',
    turns: [{ speaker: 'person', text: 'test' }],
  }, sessions.admin);
  check('admin can NOT submit check-in → 403', r3.status === 403);

  const r4 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0001',
    turns: [{ speaker: 'person', text: 'test' }],
  });
  check('unauthenticated can NOT submit check-in → 401/403', r4.status === 401 || r4.status === 403);
}

// ─── 10. VICTIM — CHECK-IN (bad input) ─────────────────────────────────
console.log('\n═══ 10. VICTIM — BAD INPUT ═══');
{
  const r1 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0001',
    turns: [],
  }, sessions.victim);
  check('empty turns → 400', r1.status === 400);

  const r2 = await req('POST', '/api/checkin', {
    caseId: 'NONEXISTENT',
    turns: [{ speaker: 'person', text: 'test' }],
  }, sessions.victim);
  check('nonexistent case → 404', r2.status === 404);

  const r3 = await req('POST', '/api/checkin', {
    turns: [{ speaker: 'person', text: 'test' }],
  }, sessions.victim);
  check('missing caseId → 400', r3.status === 400);

  const r4 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0001',
  }, sessions.victim);
  check('missing turns → 400', r4.status === 400);
}

// ─── 11. VICTIM — NOTIFICATIONS ───────────────────────────────────────
console.log('\n═══ 11. VICTIM — NOTIFICATIONS ═══');
{
  const r = await req('GET', '/api/notifications', null, sessions.victim);
  check('notifications → 200', r.status === 200);
  check('notifications → array', Array.isArray(r.json?.notifications));
  check('notifications → has entries after check-in', r.json?.notifications?.length > 0);
}

// ─── 12. VICTIM — CHECK-IN PROMPTS ────────────────────────────────────
console.log('\n═══ 12. VICTIM — CHECK-IN PROMPTS ═══');
{
  const r = await req('GET', '/api/checkin/prompts/SIH-CASE-0001', null, sessions.victim);
  check('prompts → 200', r.status === 200);
  check('prompts → locale=hi for case A', r.json?.locale === 'hi');
  check('prompts → 3 prompts', r.json?.prompts?.length === 3);

  const r2 = await req('GET', '/api/checkin/prompts/SIH-CASE-0002', null, sessions.victim);
  check('prompts case B → locale=en', r2.json?.locale === 'en');
}

// ─── 13. COUNSELLOR — CASE LIST ────────────────────────────────────────
console.log('\n═══ 13. COUNSELLOR — CASE LIST ═══');
{
  const r = await req('GET', '/api/counsellor/cases', null, sessions.counsellor);
  check('case list → 200', r.status === 200);
  check('case list → has cases array', Array.isArray(r.json?.cases));
  check('case list → 8 cases', r.json?.cases?.length === 8);
  const first = r.json?.cases?.[0];
  if (first) {
    check('case list item → has caseId', !!first.caseId);
    check('case list item → has pseudonym', !!first.pseudonym);
    check('case list item → has assessment', !!first.assessment);
  }
}

// ─── 14. COUNSELLOR — CASE DETAIL ──────────────────────────────────────
console.log('\n═══ 14. COUNSELLOR — CASE DETAIL ═══');
{
  const r = await req('GET', '/api/counsellor/cases/SIH-CASE-0001', null, sessions.counsellor);
  check('case detail → 200', r.status === 200);
  check('case detail → caseRecord', !!r.json?.caseRecord);
  check('case detail → checkIns array', Array.isArray(r.json?.checkIns));
  check('case detail → trendData array', Array.isArray(r.json?.trendData));
  check('case detail → latest assessment', !!r.json?.latest);

  // Check for non-empty check-in history (seed data)
  if (r.json?.checkIns?.length > 0) {
    const c = r.json.checkIns[0];
    check('case detail check-in → has turns', Array.isArray(c.turns) && c.turns.length > 0);
    check('case detail check-in → has assessment', !!c.assessment);
    check('case detail check-in → assessment has explanation', !!c.assessment?.explanation);
  }
}

// ─── 15. COUNSELLOR — ALERTS ──────────────────────────────────────────
console.log('\n═══ 15. COUNSELLOR — ALERTS ═══');
{
  const r = await req('GET', '/api/counsellor/alerts', null, sessions.counsellor);
  check('alerts → 200', r.status === 200);
  check('alerts → has alerts array', Array.isArray(r.json?.alerts));
  // Should have at least some escalated cases from seed data
  check('alerts → has entries', r.json?.alerts?.length > 0);
}

// ─── 16. COUNSELLOR — REVIEW CASE ──────────────────────────────────────
console.log('\n═══ 16. COUNSELLOR — REVIEW CASE ═══');
{
  const r = await req('POST', '/api/counsellor/cases/SIH-CASE-0001/review', {
    note: 'Playtest review — counsellor checked in on case',
  }, sessions.counsellor);
  check('review case → 200 ok', r.status === 200 && r.json?.ok === true);

  // Verify notification was created for the victim
  const n = await req('GET', '/api/notifications', null, sessions.victim);
  const reviewNotif = n.json?.notifications?.find(n => n.type === 'case_reviewed');
  check('review creates victim notification', !!reviewNotif);
}

// ─── 17. ADMIN — SUMMARY ──────────────────────────────────────────────
console.log('\n═══ 17. ADMIN — SUMMARY ═══');
{
  const r = await req('GET', '/api/admin/summary', null, sessions.admin);
  check('admin summary → 200', r.status === 200);
  check('admin summary → total is 8', r.json?.total === 8);
  check('admin summary → bandCounts object', !!r.json?.bandCounts);
  check('admin summary → has low/moderate/elevated/high', 
    r.json?.bandCounts?.low !== undefined &&
    r.json?.bandCounts?.moderate !== undefined &&
    r.json?.bandCounts?.elevated !== undefined &&
    r.json?.bandCounts?.high !== undefined);
}

// ─── 18. ADMIN — TRENDS ───────────────────────────────────────────────
console.log('\n═══ 18. ADMIN — TRENDS ═══');
{
  const r = await req('GET', '/api/admin/trends', null, sessions.admin);
  check('admin trends → 200', r.status === 200);
  check('admin trends → bandDistribution', !!r.json?.bandDistribution);
  check('admin trends → trendDirections', !!r.json?.trendDirections);
  check('admin trends → averageCheckInsPerCase', typeof r.json?.averageCheckInsPerCase === 'number');
}

// ─── 19. ADMIN — GEOGRAPHY ────────────────────────────────────────────
console.log('\n═══ 19. ADMIN — GEOGRAPHY ═══');
{
  const r1 = await req('GET', '/api/admin/geography?scope=national', null, sessions.admin);
  check('geography national → 200', r1.status === 200);
  check('geography national → groups array', Array.isArray(r1.json?.groups));
  check('geography national → has state groups', r1.json?.groups?.length > 0);

  const r2 = await req('GET', '/api/admin/geography?scope=state&state=Uttar Pradesh', null, sessions.admin);
  check('geography state → 200', r2.status === 200);
  check('geography state → scoped to UP', r2.json?.state === 'Uttar Pradesh');
}

// ─── 20. ADMIN — EXPORT ───────────────────────────────────────────────
console.log('\n═══ 20. ADMIN — EXPORT ═══');
{
  const r1 = await req('GET', '/api/export/national', null, sessions.admin);
  check('export national → 200', r1.status === 200);
  // Export returns text/plain, not JSON — check the raw text
  const expNText = (await (await fetch(`${BASE}/api/export/national`, { headers: { Cookie: sessions.admin } })).text());
  check('export national → has content (>100 chars)', expNText.length > 100);
  check('export national → contains case count', expNText.includes('Total Cases'));

  const r2 = await req('GET', '/api/export/case/SIH-CASE-0001', null, sessions.admin);
  check('export case → 200', r2.status === 200);
  const expCText = (await (await fetch(`${BASE}/api/export/case/SIH-CASE-0001`, { headers: { Cookie: sessions.admin } })).text());
  check('export case → has content (>100 chars)', expCText.length > 100);
  check('export case → contains case ID', expCText.includes('SIH-CASE-0001'));
}

// ─── 21. ACCESS CONTROL — CROSS-TIER ──────────────────────────────────
console.log('\n═══ 21. ACCESS CONTROL — CROSS-TIER ═══');
{
  const r1 = await req('GET', '/api/counsellor/cases', null, sessions.admin);
  check('admin can NOT read individual cases → 403', r1.status === 403);

  const r2 = await req('GET', '/api/admin/summary', null, sessions.counsellor);
  check('counsellor can NOT read admin summary → 403', r2.status === 403);

  const r3 = await req('GET', '/api/counsellor/alerts', null, sessions.victim);
  check('victim can NOT read counsellor alerts → 403', r3.status === 403);

  const r4 = await req('GET', '/api/admin/summary');
  check('unauthenticated can NOT read admin summary → 401/403', r4.status === 401 || r4.status === 403);

  const r5 = await req('GET', '/api/counsellor/cases');
  check('unauthenticated can NOT read counsellor cases → 401/403', r5.status === 401 || r5.status === 403);
}

// ─── 22. EDGE CASES — RAPID DUPLICATE REQUESTS ─────────────────────────
console.log('\n═══ 22. EDGE CASES — RAPID REQUESTS ═══');
{
  const promises = Array.from({ length: 5 }, () =>
    req('POST', '/api/checkin', {
      caseId: 'SIH-CASE-0001',
      turns: [{ speaker: 'person', text: 'Just checking in' }],
    }, sessions.victim)
  );
  const results = await Promise.all(promises);
  const allOk = results.every(r => r.status === 200);
  check('5 rapid check-ins all succeed', allOk);
  const allHaveAssessment = results.every(r => !!r.json?.assessment);
  check('5 rapid check-ins all have assessment', allHaveAssessment);
}

// ─── 23. EDGE CASES — EMPTY/WEIRD TEXT ─────────────────────────────────
console.log('\n═══ 23. EDGE CASES — EMPTY/WEIRD TEXT ═══');
{
  const r1 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0002',
    turns: [{ speaker: 'person', text: '.' }],
  }, sessions['case-b']);
  check('single period check-in → 200', r1.status === 200);

  const r2 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0002',
    turns: [{ speaker: 'person', text: '   ' }],
  }, sessions['case-b']);
  check('whitespace-only check-in → 200', r2.status === 200);

  const r3 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0002',
    turns: [{ speaker: 'person', text: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' }],
  }, sessions['case-b']);
  check('very long text check-in → 200', r3.status === 200);

  const r4 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0002',
    turns: [{ speaker: 'person', text: 'Unicode: नमस्ते दुनिया 🙏 مرحبا' }],
  }, sessions['case-b']);
  check('unicode/mixed script check-in → 200', r4.status === 200);
}

// ─── 24. EDGE CASES — XSS/INJECTION ATTEMPTS ──────────────────────────
console.log('\n═══ 24. EDGE CASES — INJECTION ═══');
{
  const r1 = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0002',
    turns: [{ speaker: 'person', text: '<script>alert("xss")</script>' }],
  }, sessions['case-b']);
  check('XSS in text → 200 (sanitised)', r1.status === 200);
  // Check the response doesn't reflect the script tag raw
  const followUp = r1.json?.followUp ?? '';
  check('XSS → followUp does not contain <script>', !followUp.includes('<script>'));

  const r2 = await req('POST', '/api/auth/login', {
    username: "admin' OR '1'='1",
    passcode: "demo' OR '1'='1",
  });
  check('SQL injection in login → 401', r2.status === 401);
}

// ─── 25. DEV ENDPOINTS ─────────────────────────────────────────────────
console.log('\n═══ 25. DEV ENDPOINTS ═══');
{
  const r1 = await req('GET', '/api/dev/personas');
  check('dev personas → 200', r1.status === 200);
  check('dev personas → 8 personas', Array.isArray(r1.json?.personas) && r1.json.personas.length === 8);
}

// ─── 26. VICTIM — FOLLOW-UP QUALITY (no generic fallback) ─────────────
console.log('\n═══ 26. FOLLOW-UP QUALITY ═══');
{
  const r = await req('POST', '/api/checkin', {
    caseId: 'SIH-CASE-0002',
    turns: [{ speaker: 'person', text: 'I feel unsafe, people keep showing up near my house' }],
  }, sessions['case-b']);
  const followUp = r.json?.followUp ?? '';
  check('intimidation follow-up → not generic "Thank you for sharing"', 
    !followUp.includes('Thank you for sharing that. Is there anything else you would like to talk about?'));
  check('intimidation follow-up → substantive (>50 chars)', followUp.length > 50);
  check('intimidation follow-up → addresses safety', 
    followUp.toLowerCase().includes('safe') || 
    followUp.toLowerCase().includes('support') || 
    followUp.toLowerCase().includes('help') ||
    followUp.toLowerCase().includes('worry') ||
    followUp.toLowerCase().includes('concern'));
}

// ─── 27. UNIT TESTS ────────────────────────────────────────────────────
console.log('\n═══ 27. SERVER UNIT TESTS ═══');
// We'll run these via the terminal separately

// ─── 28. CLIENT BUILD ──────────────────────────────────────────────────
console.log('\n═══ 28. CLIENT BUILD ═══');
// We'll run this via the terminal separately

// ─── SUMMARY ────────────────────────────────────────────────────────────
console.log('\n═══════════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed`);
if (defects.length > 0) {
  console.log('\nDEFECTS FOUND:');
  for (const d of defects) {
    console.log(`  ❌ ${d.name}${d.detail ? ': ' + d.detail : ''}`);
  }
}
console.log('═══════════════════════════════════════════════\n');

process.exit(failed > 0 ? 1 : 0);
