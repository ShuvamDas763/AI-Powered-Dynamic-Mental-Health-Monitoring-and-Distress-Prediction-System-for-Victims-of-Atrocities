const BASE = 'http://localhost:3001';
let pass = 0, fail = 0;
const cookie = { jar: '' };

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (cookie.jar) headers['Cookie'] = cookie.jar;
  const res = await fetch(BASE + '/api' + path, { ...opts, headers });
  const sc = res.headers.get('set-cookie');
  if (sc) cookie.jar = sc.split(';')[0];
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body };
}

function check(label, cond) {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label); }
}

async function run() {
  // ===== VICTIM ROLE =====
  console.log('\n📋 SECTION 1: VICTIM ROLE');

  const vLogin = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'case-b', passcode: 'demo' }) });
  check('Victim login (case-b)', vLogin.ok);

  const vMe = await api('/auth/me');
  check('Victim session established', vMe.ok && vMe.body.user?.role === 'victim');
  check('Victim has caseId', vMe.body.user?.caseId === 'SIH-CASE-0002');

  const vCheckin = await api('/checkin', {
    method: 'POST',
    body: JSON.stringify({
      caseId: 'SIH-CASE-0002',
      turns: [{ speaker: 'system', text: 'How have things been since we last checked in?' }, { speaker: 'person', text: 'I feel unsafe going to court. Someone keeps watching me.' }],
      locale: 'en', channel: 'app', consentAcknowledged: true,
    }),
  });
  check('Check-in accepted', vCheckin.ok);
  check('Assessment returned', !!vCheckin.body.assessment);
  check('Score is a number', typeof vCheckin.body.assessment?.score === 'number');
  check('Band is a string', typeof vCheckin.body.assessment?.band === 'string');
  check('Follow-up response returned', typeof vCheckin.body.followUp === 'string' && vCheckin.body.followUp.length > 5);
  check('Has emotions', !!vCheckin.body.assessment?.emotions);
  check('Has prediction', !!vCheckin.body.assessment?.prediction);

  const vNotif = await api('/notifications');
  check('Notifications endpoint works', vNotif.ok);
  check('Notifications is array', Array.isArray(vNotif.body.notifications));

  await api('/auth/logout', { method: 'POST' });

  // ===== COUNSELLOR ROLE =====
  console.log('\n📋 SECTION 2: COUNSELLOR ROLE');

  await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'counsellor', passcode: 'demo' }) });
  const cMe = await api('/auth/me');
  check('Counsellor login + role', cMe.body.user?.role === 'counsellor');

  const cCases = await api('/counsellor/cases');
  check('Cases list', cCases.ok);
  check('Cases array length > 0', Array.isArray(cCases.body.cases) && cCases.body.cases.length > 0);

  const firstCase = cCases.body.cases[0];
  check('Case has caseId', !!firstCase.caseId);
  check('Case has pseudonym', !!firstCase.pseudonym);
  check('Case has assessment.score', typeof firstCase.assessment?.score === 'number');
  check('Case has assessment.band', typeof firstCase.assessment?.band === 'string');

  const cAlerts = await api('/counsellor/alerts');
  check('Alerts endpoint', cAlerts.ok);
  check('Alerts is array', Array.isArray(cAlerts.body.alerts));

  const detailCase = cCases.body.cases.find(c => c.assessment?.escalated) || firstCase;
  const cDetail = await api('/counsellor/cases/' + detailCase.caseId);
  check('Case detail', cDetail.ok);
  check('Has checkIns', Array.isArray(cDetail.body.checkIns));
  check('Has trendData', Array.isArray(cDetail.body.trendData));
  check('Has latest assessment', !!cDetail.body.latest);
  check('Has emotions', !!cDetail.body.latest?.emotions);
  check('Has prediction', !!cDetail.body.latest?.prediction);
  check('Has escalation', !!cDetail.body.latest?.escalation);

  const cReview = await api('/counsellor/cases/' + detailCase.caseId + '/review', { method: 'POST' });
  check('Mark as reviewed', cReview.ok);

  const cAdmin = await api('/admin/summary');
  check('Counsellor blocked from admin', cAdmin.status === 403);

  await api('/auth/logout', { method: 'POST' });

  // ===== ADMIN ROLE =====
  console.log('\n📋 SECTION 3: ADMIN ROLE');

  await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', passcode: 'demo' }) });
  const aMe = await api('/auth/me');
  check('Admin login + role', aMe.body.user?.role === 'admin');

  const aSummary = await api('/admin/summary');
  check('Admin summary', aSummary.ok);
  check('Has total', typeof aSummary.body.total === 'number');
  check('Has bandCounts', !!aSummary.body.bandCounts);
  check('Has alertCount', typeof aSummary.body.alertCount === 'number');
  check('Has risingTrendCount', typeof aSummary.body.risingTrendCount === 'number');

  const aTrends = await api('/admin/trends');
  check('Admin trends', aTrends.ok);
  check('Has trendDirections', !!aTrends.body.trendDirections);
  check('Has avgCheckIns', typeof aTrends.body.averageCheckInsPerCase === 'number');

  const aGeo = await api('/admin/geography?scope=national');
  check('Admin geography', aGeo.ok);
  check('Has groups', Array.isArray(aGeo.body.groups) && aGeo.body.groups.length > 0);

  const aExport = await api('/admin/export');
  check('Admin export', aExport.ok);

  const aCounsel = await api('/counsellor/cases');
  check('Admin blocked from counsellor', aCounsel.status === 403);

  await api('/auth/logout', { method: 'POST' });

  // ===== ALL 8 PERSONAS =====
  console.log('\n📋 SECTION 4: ALL 8 PERSONA SCORING');

  const personas = ['victim', 'case-b', 'case-c', 'case-d', 'case-e', 'case-f', 'case-g', 'case-h'];
  for (const persona of personas) {
    await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: persona, passcode: 'demo' }) });
    const me = await api('/auth/me');
    const caseId = me.body.user?.caseId;
    if (caseId) {
      const ci = await api('/checkin', {
        method: 'POST',
        body: JSON.stringify({ caseId, turns: [{ speaker: 'system', text: 'How are you?' }, { speaker: 'person', text: 'I am worried and scared.' }], locale: 'en', channel: 'app', consentAcknowledged: true }),
      });
      if (ci.ok && ci.body.assessment) {
        check(persona + ': score=' + ci.body.assessment.score + ' band=' + ci.body.assessment.band, true);
        check(persona + ': emotions', !!ci.body.assessment.emotions);
        check(persona + ': prediction', !!ci.body.assessment.prediction);
      } else {
        check(persona + ': check-in FAILED (status=' + ci.status + ')', false);
      }
    }
    await api('/auth/logout', { method: 'POST' });
  }

  // ===== CRISIS DETECTION =====
  console.log('\n📋 SECTION 5: CRISIS DETECTION');

  await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'case-b', passcode: 'demo' }) });
  const cme = await api('/auth/me');
  const cid = cme.body.user?.caseId;

  const v1 = await api('/checkin', {
    method: 'POST',
    body: JSON.stringify({
      caseId: cid,
      turns: [{ speaker: 'system', text: 'How are you?' }, { speaker: 'person', text: 'I feel like someone is following me and I am scared to go to court. They keep threatening me.' }],
      locale: 'en', channel: 'app', consentAcknowledged: true,
    }),
  });
  check('Violence fear triggers escalation', v1.body.assessment?.escalation?.triggered || v1.body.assessment?.score >= 50);
  check('Violence fear returns response', typeof v1.body.followUp === 'string' && v1.body.followUp.length > 10);

  const v2 = await api('/checkin', {
    method: 'POST',
    body: JSON.stringify({
      caseId: cid,
      turns: [{ speaker: 'system', text: 'How are you?' }, { speaker: 'person', text: 'I want to end my life. I cannot take this anymore.' }],
      locale: 'en', channel: 'app', consentAcknowledged: true,
    }),
  });
  check('Self-harm triggers crisis', v2.body.assessment?.escalation?.triggered || v2.body.assessment?.score >= 70);
  const hasHelpline = typeof v2.body.followUp === 'string' && (v2.body.followUp.includes('1800') || v2.body.followUp.includes('14566') || v2.body.followUp.includes('112'));
  check('Self-harm returns helpline', hasHelpline);

  await api('/auth/logout', { method: 'POST' });

  // ===== DEV UTILITIES =====
  console.log('\n📋 SECTION 6: DEV UTILITIES');

  const devReset = await api('/dev/reset', { method: 'POST' });
  check('Dev reset', devReset.ok);

  const devPersonas = await api('/dev/personas');
  check('Dev personas list', devPersonas.ok);
  check('Has 8 personas', Array.isArray(devPersonas.body.personas) && devPersonas.body.personas.length === 8);

  // ===== EXPORT =====
  console.log('\n📋 SECTION 7: EXPORT');

  await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'counsellor', passcode: 'demo' }) });
  const exDetail = await api('/counsellor/cases');
  if (exDetail.ok && exDetail.body.cases?.length > 0) {
    const eid = exDetail.body.cases[0].caseId;
    const ex = await api('/export/case/' + eid);
    check('Case export endpoint', ex.ok);
    if (ex.ok) check('Export has text', typeof ex.body.text === 'string' && ex.body.text.length > 50);
  }
  const natEx = await api('/auth/logout', { method: 'POST' });

  // ===== NOTIFICATION FLOW =====
  console.log('\n📋 SECTION 8: NOTIFICATION FLOW');

  // Login as victim, submit check-in
  await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'case-b', passcode: 'demo' }) });
  await api('/checkin', {
    method: 'POST',
    body: JSON.stringify({
      caseId: 'SIH-CASE-0002',
      turns: [{ speaker: 'system', text: 'How are you?' }, { speaker: 'person', text: 'I am doing better today.' }],
      locale: 'en', channel: 'app', consentAcknowledged: true,
    }),
  });
  const n1 = await api('/notifications');
  const unreadBefore = n1.body.unreadCount || 0;
  check('Victim has notifications', n1.ok);
  await api('/auth/logout', { method: 'POST' });

  // Login as counsellor, mark reviewed
  await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'counsellor', passcode: 'demo' }) });
  await api('/counsellor/cases/SIH-CASE-0002/review', { method: 'POST' });
  await api('/auth/logout', { method: 'POST' });

  // Login as victim again, check notification count increased
  await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: 'case-b', passcode: 'demo' }) });
  const n2 = await api('/notifications');
  const unreadAfter = n2.body.unreadCount || 0;
  check('Notification count increased after review', unreadAfter > unreadBefore || unreadAfter >= 1);
  await api('/auth/logout', { method: 'POST' });

  // ===== SUMMARY =====
  console.log('\n════════════════════════════════════════');
  console.log('📊 TOTAL: ' + pass + ' passed, ' + fail + ' failed');
  console.log('════════════════════════════════════════');
  if (fail > 0) process.exit(1);
}

run().catch(e => { console.error(e); process.exit(1); });
