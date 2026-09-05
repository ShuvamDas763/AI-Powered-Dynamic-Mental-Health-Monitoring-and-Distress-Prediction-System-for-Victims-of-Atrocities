#!/usr/bin/env node
/**
 * COMPREHENSIVE PERSONA VERIFICATION — REAL TEST (v3)
 * Tests each of the 8 personas with contextually appropriate messages.
 * Verifies: scoring, escalation, emotions, follow-up quality, response appropriateness.
 */

const BASE = 'http://localhost:3001';

async function api(path, opts = {}) {
  const url = new URL(path, BASE);
  const headers = { 'Content-Type': 'application/json', ...opts.headers };
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  const res = await fetch(url, { method: opts.method || 'GET', headers, body: opts.body });
  const setCookie = res.headers?.getSetCookie?.() || [];
  const cookie = setCookie.map(c => c.split(';')[0]).join('; ');
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body, cookie };
}

const ACCOUNTS = [
  { username: 'victim', passcode: 'demo', caseId: 'SIH-CASE-0001', name: 'Case A — Hindi Investigation' },
  { username: 'case-b', passcode: 'demo', caseId: 'SIH-CASE-0002', name: 'Case B — Witness Intimidation' },
  { username: 'case-c', passcode: 'demo', caseId: 'SIH-CASE-0003', name: 'Case C — Post-Compensation PTSD' },
  { username: 'case-d', passcode: 'demo', caseId: 'SIH-CASE-0004', name: 'Case D — Social Isolation' },
  { username: 'case-e', passcode: 'demo', caseId: 'SIH-CASE-0005', name: 'Case E — Process Fatigue' },
  { username: 'case-f', passcode: 'demo', caseId: 'SIH-CASE-0006', name: 'Case F — Deflection' },
  { username: 'case-g', passcode: 'demo', caseId: 'SIH-CASE-0007', name: 'Case G — Sexual Assault' },
  { username: 'case-h', passcode: 'demo', caseId: 'SIH-CASE-0008', name: 'Case H — Financial Hardship' },
];

const CHECK_INS = {
  'SIH-CASE-0001': {
    msg: 'मेरी जाँच अभी भी शुरू नहीं हुई है। मैं बहुत चिंतित हूँ। क्या मेरा केस कभी आगे बढ़ेगा?',
    second: 'आज मैं अदालत गया था। जज ने अगली तारीख लगा दी। मैं थक गया हूँ।',
    shouldEscalate: false,
  },
  'SIH-CASE-0002': {
    msg: 'They keep showing up near my house. My family is scared. I think they want me to stop testifying.',
    second: 'Last night someone wrote a threat on our wall. I am terrified for my children.',
    shouldEscalate: true,
  },
  'SIH-CASE-0003': {
    msg: "The case is closed now. I got the compensation. But I still can't sleep at night. I keep reliving what happened.",
    second: 'I had a nightmare again last night. The same one I always have. I wake up screaming.',
    shouldEscalate: false,
  },
  'SIH-CASE-0004': {
    msg: 'Nobody in my village talks to me anymore. They all think I caused trouble by complaining. I feel so alone.',
    second: 'I tried to go to the market today but everyone just stared at me. I came back home.',
    shouldEscalate: false,
  },
  'SIH-CASE-0005': {
    msg: 'I have been going to court for the third time this month. I am so tired. Sometimes I think it would have been better not to file the complaint.',
    second: 'My fourth visit to court this month. I spent all my savings on travel. I have nothing left.',
    shouldEscalate: false,
  },
  'SIH-CASE-0006': {
    msg: 'I am fine. Everything is okay. There is nothing to worry about.',
    second: 'I told you, I am fine. Stop worrying about me.',
    shouldEscalate: false,
  },
  'SIH-CASE-0007': {
    msg: "I feel so dirty and broken. I don't want to talk about what happened. Nobody understands what I am going through. I just want to disappear.",
    second: 'I have not been eating properly. I just sit in my room all day. I feel numb.',
    shouldEscalate: true,
  },
  'SIH-CASE-0008': {
    msg: "I lost my shop in the arson. My family has nothing. We don't know where we will get our next meal. I need help.",
    second: 'My children are hungry. We need immediate help. The compensation has not come yet.',
    shouldEscalate: false,
  },
};

const GENERIC_PATTERNS = [
  'Thank you for sharing that',
  'Is there anything else you would like to talk about',
  'How are you feeling today',
  'I appreciate you sharing',
];

let passed = 0;
let failed = 0;
const summaryRows = [];

function check(label, ok, detail) {
  if (ok) { passed++; console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`); }
  else { failed++; console.log(`  ❌ ${label}${detail ? ' — ' + detail : ''}`); }
}

// Safely get emotions array from assessment
function getEmotions(a) {
  if (!a) return [];
  if (Array.isArray(a.emotions?.emotions)) return a.emotions.emotions;
  if (Array.isArray(a.emotions)) return a.emotions;
  return [];
}

async function testPersona(acct) {
  const ci = CHECK_INS[acct.caseId];
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${acct.name}`);
  console.log(`  "${ci.msg.slice(0, 80)}..."`);
  console.log(`${'═'.repeat(70)}`);

  // 1. Login
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: acct.username, passcode: acct.passcode }),
  });
  check('Login', login.status === 200, `status=${login.status}`);
  if (login.status !== 200) { console.log(`    Body: ${JSON.stringify(login.body).slice(0, 200)}`); return; }
  const cookie = login.cookie;

  // 2. Submit first check-in
  const c1 = await api('/api/checkin', {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      caseId: acct.caseId,
      turns: [{ speaker: 'person', text: ci.msg }],
      channel: 'app',
      consentAcknowledged: true,
    }),
  });
  check('Check-in 1 submitted', c1.status === 200, `status=${c1.status}`);
  if (c1.status !== 200) { console.log(`    Body: ${JSON.stringify(c1.body).slice(0, 300)}`); return; }

  const a1 = c1.body.assessment || {};
  const followUp1 = c1.body.followUp || '';
  const emotions1 = getEmotions(a1);

  console.log(`    📊 Score: ${a1.score} (${a1.band}) | Trend: ${a1.trend?.direction || 'new'} | Emotions: ${emotions1.map(e => `${e.label}(${Math.round((e.intensity || 0) * 100)}%)`).join(', ') || 'none'}`);
  if (a1.escalation) {
    console.log(`    ⚠️  Escalated: ${a1.escalation.escalated} | AdjScore: ${a1.escalation.priorityAdjustedScore}/${a1.escalation.threshold}`);
    if (a1.escalation.triggerReasons?.length) console.log(`       Reasons: ${a1.escalation.triggerReasons.join('; ')}`);
  }
  if (a1.explanation) {
    console.log(`    🔍 Headline: ${a1.explanation.headline}`);
    console.log(`    🔍 Signal phrases: ${(a1.explanation.signalPhrases || []).join(', ')}`);
    const drivers = a1.explanation.drivers || [];
    for (const d of drivers) {
      console.log(`       ${d.label}: ${d.detail} (contributes ${d.contribution.toFixed(1)}pts, ${d.sharePct.toFixed(1)}% of score)`);
    }
  }
  if (a1.interventions?.length) {
    console.log(`    💡 Interventions: ${a1.interventions.map(i => `${i.label}(${i.urgency})`).join(', ')}`);
  }
  if (a1.prediction?.predicted) {
    console.log(`    🔮 Prediction: escalate in ${a1.prediction.estimatedCheckIns} check-ins (~${a1.prediction.estimatedDays} days)`);
  }
  console.log(`    💬 Follow-up: "${followUp1.slice(0, 140)}${followUp1.length > 140 ? '...' : ''}"`);

  // ── CHECKS ──
  check('Score is a number', typeof a1.score === 'number', `score=${a1.score}`);
  check('Band is set', !!a1.band, `band=${a1.band}`);
  check('Has explanation', !!a1.explanation?.headline, '');
  check('Has interventions', a1.interventions?.length > 0, `count=${a1.interventions?.length || 0}`);

  const isGeneric = GENERIC_PATTERNS.some(g => followUp1.toLowerCase().includes(g.toLowerCase()));
  check('Follow-up is NOT generic', !isGeneric, isGeneric ? `GOT: "${followUp1.slice(0, 80)}"` : 'contextual');

  if (ci.shouldEscalate) {
    check('HIGH-RISK escalation triggered', a1.escalation?.triggered === true, `adjScore=${a1.escalation?.priorityAdjustedScore} reasons=${(a1.escalation?.triggerReasons || []).map(r => r.code || r).join(',')}`);
  }

  if (acct.caseId === 'SIH-CASE-0001') {
    check('Hindi check-in processed', true, 'accepted and scored');
  }

  // Emotions for expressive cases
  if (['SIH-CASE-0002', 'SIH-CASE-0005', 'SIH-CASE-0007'].includes(acct.caseId)) {
    check('Emotions detected', emotions1.length > 0, `found: ${emotions1.map(e => e.label).join(', ') || 'none'}`);
  }

  // 3. Second check-in
  await new Promise(r => setTimeout(r, 100));
  const c2 = await api('/api/checkin', {
    method: 'POST',
    cookie,
    body: JSON.stringify({
      caseId: acct.caseId,
      turns: [{ speaker: 'person', text: ci.second }],
      channel: 'app',
      consentAcknowledged: true,
    }),
  });
  check('Check-in 2 submitted', c2.status === 200, `status=${c2.status}`);

  let a2score = '--', a2band = '--', a2trend = '--';
  if (c2.status === 200) {
    const a2 = c2.body.assessment || {};
    const followUp2 = c2.body.followUp || '';
    a2score = a2.score; a2band = a2.band; a2trend = a2.trend?.direction || 'new';
    console.log(`    📊 2nd: Score ${a2.score} (${a2.band}) | Trend: ${a2.trend?.direction}`);
    console.log(`    💬 2nd: "${followUp2.slice(0, 120)}..."`);

    const isGeneric2 = GENERIC_PATTERNS.some(g => followUp2.toLowerCase().includes(g.toLowerCase()));
    check('2nd follow-up NOT generic', !isGeneric2, 'contextual');
    check('2nd has trend', !!a2.trend?.direction, `trend=${a2.trend?.direction}`);
  }

  summaryRows.push({ id: acct.caseId.slice(-1), score: a1.score, band: a1.band, esc: a1.escalation?.triggered, followUp: followUp1.slice(0, 35) });
  return { cookie, a1, followUp1, caseId: acct.caseId };
}

async function run() {
  console.log('╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║  COMPREHENSIVE PERSONA VERIFICATION — All 8 Cases × 2 Check-ins        ║');
  console.log('║  Real LLM calls, real scoring, real responses                          ║');
  console.log('╚══════════════════════════════════════════════════════════════════════════╝');

  const results = {};
  for (const acct of ACCOUNTS) {
    results[acct.caseId] = await testPersona(acct);
  }

  // ─── COUNSELLOR ───
  console.log(`\n${'═'.repeat(70)}`);
  console.log('  COUNSELLOR DASHBOARD');
  console.log(`${'═'.repeat(70)}`);

  const coLogin = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'counsellor', passcode: 'demo' }) });
  check('Counsellor login', coLogin.status === 200);

  if (coLogin.status === 200) {
    const cc = coLogin.cookie;
    const cases = await api('/api/counsellor/cases', { cookie: cc });
    check('Case queue', cases.status === 200, `count=${cases.body?.cases?.length || 0}`);

    if (cases.body?.cases) {
      console.log('\n  ┌───────┬────────┬───────┬──────────┬───────┬────────────────────────────────────┐');
      console.log('  │ Case  │ Score  │ Band  │ Escalated│ Trend │ Tags                               │');
      console.log('  ├───────┼────────┼───────┼──────────┼───────┼────────────────────────────────────┤');
      for (const c of cases.body.cases) {
        const a = c.assessment;
        console.log(`  │ ${c.pseudonym.slice(0,5).padEnd(5)} │ ${String(a?.score ?? '--').padStart(6)} │ ${(a?.band ?? '--').padStart(5)} │ ${a?.escalated ? '   YES  ' : '   no   '} │ ${(a?.trendDirection ?? '--').padStart(5)} │ ${(c.priorityTags || []).join(', ').slice(0, 34).padEnd(34)} │`);
      }
      console.log('  └───────┴────────┴───────┴──────────┴───────┴────────────────────────────────────┘');
    }

    const alerts = await api('/api/counsellor/alerts', { cookie: cc });
    check('Alerts', alerts.status === 200, `count=${alerts.body?.alerts?.length || 0}`);
    if (alerts.body?.alerts) {
      for (const al of alerts.body.alerts) {
        console.log(`    🚨 ${al.caseRecord.pseudonym}: adj=${al.assessment.priorityAdjustedScore} reasons=${al.assessment.triggerReasons.join('; ')}`);
      }
    }

    // Case detail for critical cases
    for (const cid of ['SIH-CASE-0007', 'SIH-CASE-0002']) {
      const det = await api(`/api/counsellor/cases/${cid}`, { cookie: cc });
      if (det.status === 200 && det.body) {
        const d = det.body;
        const latest = d.checkIns?.[d.checkIns.length - 1];
        const latestEmotions = getEmotions(latest?.assessment);
        console.log(`\n  🔍 ${d.caseRecord?.pseudonym} (${cid}):`);
        console.log(`     Score: ${d.latest?.score} (${d.latest?.band}) | Check-ins: ${d.checkIns?.length} | Trend points: ${d.trendData?.length}`);
        if (latestEmotions.length) console.log(`     Emotions: ${latestEmotions.map(e => `${e.label}(${Math.round(e.intensity*100)}%)`).join(', ')}`);
        if (latest?.assessment?.escalation) console.log(`     Escalation: adj=${latest.assessment.escalation.priorityAdjustedScore} triggered=${latest.assessment.escalation.triggered}`);
        if (latest?.assessment?.interventions?.length) console.log(`     Interventions: ${latest.assessment.interventions.map(i => i.code).join(', ')}`);
      }
    }

    // Review case B
    const review = await api('/api/counsellor/cases/SIH-CASE-0002/review', {
      method: 'POST', cookie: cc, body: JSON.stringify({ note: 'Witness protection recommended' }),
    });
    check('Case review', review.status === 200);
  }

  // ─── ADMIN ───
  console.log(`\n${'═'.repeat(70)}`);
  console.log('  ADMIN DASHBOARD');
  console.log(`${'═'.repeat(70)}`);

  const adminLogin = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'admin', passcode: 'demo' }) });
  check('Admin login', adminLogin.status === 200);

  if (adminLogin.status === 200) {
    const ac = adminLogin.cookie;

    const summary = await api('/api/admin/summary', { cookie: ac });
    check('Summary', summary.status === 200);
    if (summary.body) {
      console.log(`  📊 Total: ${summary.body.total} | Escalated: ${summary.body.escalatedCount} | Rising: ${summary.body.risingTrendCount} | Alerts: ${summary.body.alertCount}`);
      console.log(`  📊 Bands: ${JSON.stringify(summary.body.bandCounts)}`);
    }

    const trends = await api('/api/admin/trends', { cookie: ac });
    check('Trends', trends.status === 200);
    if (trends.body) {
      console.log(`  📈 Bands: ${JSON.stringify(trends.body.bandDistribution)}`);
      console.log(`  📈 Directions: ${JSON.stringify(trends.body.trendDirections)}`);
      console.log(`  📈 Avg check-ins/case: ${trends.body.averageCheckInsPerCase}`);
    }

    const geo = await api('/api/admin/geography?scope=national', { cookie: ac });
    check('Geography', geo.status === 200);
    if (geo.body?.groups) {
      for (const g of geo.body.groups) {
        console.log(`  🗺️  ${g.name}: total=${g.total} bands=${JSON.stringify(g.bandCounts)} avg=${g.avgScore}`);
      }
    }

    const natExport = await api('/api/export/national', { cookie: ac });
    check('National export', natExport.status === 200, `length=${(natExport.body || '').length}`);
    if (typeof natExport.body === 'string' && natExport.body.length > 0) {
      console.log(`  📄 Export preview: ${natExport.body.slice(0, 300)}...`);
    }

    const caseExport = await api('/api/export/case/SIH-CASE-0007', { cookie: ac });
    check('Case G export', caseExport.status === 200, `length=${(caseExport.body || '').length}`);
    if (typeof caseExport.body === 'string' && caseExport.body.length > 0) {
      console.log(`  📄 Case G export: ${caseExport.body.slice(0, 400)}...`);
    }
  }

  // ─── ACCESS CONTROL ───
  console.log(`\n${'═'.repeat(70)}`);
  console.log('  ACCESS CONTROL');
  console.log(`${'═'.repeat(70)}`);

  const victimLogin = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: 'victim', passcode: 'demo' }) });
  if (victimLogin.status === 200) {
    const vc = victimLogin.cookie;
    const r1 = await api('/api/counsellor/cases', { cookie: vc });
    check('Victim blocked from counsellor', r1.status === 403);
    const r2 = await api('/api/admin/summary', { cookie: vc });
    check('Victim blocked from admin', r2.status === 403);
    const r3 = await api('/api/checkin', {
      method: 'POST', cookie: vc,
      body: JSON.stringify({ caseId: 'SIH-CASE-0002', turns: [{ speaker: 'person', text: 'test' }] }),
    });
    check('Victim blocked from other case', r3.status === 403);
  }

  if (adminLogin.status === 200) {
    const r4 = await api('/api/counsellor/cases/SIH-CASE-0001', { cookie: adminLogin.cookie });
    check('Admin blocked from individual case', r4.status === 403);
  }

  // ─── FINAL ───
  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  FINAL: ${passed}/${passed + failed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(70)}`);

  console.log('\n  ┌──────┬───────┬──────────┬───────────┬──────────────────────────────────┐');
  console.log('  │ Case │ Score │ Band     │ Escalated │ Follow-up Preview                │');
  console.log('  ├──────┼───────┼──────────┼───────────┼──────────────────────────────────┤');
  for (const r of summaryRows) {
    console.log(`  │  ${r.id}   │  ${String(r.score).padStart(3)} │ ${String(r.band).padStart(8)} │    ${(r.esc ? '  YES' : '  no').padEnd(5)} │ ${(r.followUp || '').padEnd(32)} │`);
  }
  console.log('  └──────┴───────┴──────────┴───────────┴──────────────────────────────────┘');

  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
