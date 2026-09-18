/**
 * Programmatic End-to-End Simulation of All 5 Key User Journeys
 *
 * Verifies backend API contracts, role guards, closed-loop interventions,
 * consent enforcement, crisis detection, and administrative data tiers.
 */

const BASE = 'http://localhost:3001/api';

async function req(path, options = {}, cookie = '') {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (cookie) headers['Cookie'] = cookie;
  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const setCookie = res.headers.get('set-cookie');
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body, cookie: setCookie || cookie };
}

async function login(username, passcode = 'demo') {
  const res = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, passcode }),
  });
  if (!res.ok) throw new Error(`Login failed for ${username}: ${JSON.stringify(res.body)}`);
  return res.cookie;
}

async function run() {
  console.log('🚀 Beginning Full 5-Journey E2E Test Suite against http://localhost:3001...\n');
  await req('/dev/reset', { method: 'POST' });
  console.log('  [Store reset to pristine demo fixtures]');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY A: Victim Check-in & Consent Flow (Scenario 1)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('▶ JOURNEY A: Victim Check-in & Consent Flow (Scenario 1)');
  const victimCookie = await login('victim');
  
  const meRes = await req('/auth/me', {}, victimCookie);
  assert(meRes.ok && meRes.body.user.role === 'victim', 'Victim session authenticated');
  assert(meRes.body.user.caseId === 'SIH-CASE-0001', 'Victim scoped to SIH-CASE-0001');

  const consentRes = await req('/consent?caseId=SIH-CASE-0001', {}, victimCookie);
  assert(consentRes.ok, 'Consent record retrieved');
  const consent = consentRes.body.record;
  assert(consent.purposes.monitoring === true, 'Monitoring consent is active');
  assert(consent.purposes.voice_analysis === true, 'Voice analysis consent is seeded');

  const checkinRes = await req('/checkin', {
    method: 'POST',
    body: JSON.stringify({
      caseId: 'SIH-CASE-0001',
      turns: [
        { speaker: 'system', text: 'पिछली बार बात होने के बाद से चीज़ें कैसी रहीं?' },
        { speaker: 'person', text: 'आज मन थोड़ा बेचैन है, लेकिन मैं ठीक हूँ।' },
      ],
      locale: 'hi',
      channel: 'app',
      consentAcknowledged: true,
    }),
  }, victimCookie);
  assert(checkinRes.ok, 'Routine Hindi check-in submitted successfully');
  assert(checkinRes.body.assessment && checkinRes.body.assessment.score !== undefined, 'Assessment score returned');
  assert(Boolean(checkinRes.body.followUp), 'Supportive follow-up message generated');
  console.log('  Follow-up response:', checkinRes.body.followUp);

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY B: Crisis Trigger & High-Priority Alert (Scenario 2)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n▶ JOURNEY B: Crisis Trigger & High-Priority Alert (Scenario 2)');
  const caseFCookie = await login('case-f');
  
  const crisisCheckinRes = await req('/checkin', {
    method: 'POST',
    body: JSON.stringify({
      caseId: 'SIH-CASE-0006',
      turns: [
        { speaker: 'system', text: 'How are you feeling today?' },
        { speaker: 'person', text: "I can't take the threats anymore, they will kill me, I don't want to live like this" },
      ],
      locale: 'en',
      channel: 'app',
      consentAcknowledged: true,
    }),
  }, caseFCookie);
  assert(crisisCheckinRes.ok, 'Crisis check-in accepted');
  assert(crisisCheckinRes.body.crisisResponse?.triggered === true, 'Crisis detection triggered immediately');
  console.log('  Crisis detected details:', JSON.stringify(crisisCheckinRes.body.crisisResponse));
  assert(Boolean(crisisCheckinRes.body.crisisResponse.category), `Category identified (${crisisCheckinRes.body.crisisResponse.category})`);
  assert(crisisCheckinRes.body.crisisResponse.helpline?.number === '14416', 'Tele-MANAS toll-free 14416 helpline provided');

  // Verify Counsellor sees the alert
  const counsellorCookie = await login('counsellor');
  const alertsRes = await req('/counsellor/alerts', {}, counsellorCookie);
  assert(alertsRes.ok, 'Counsellor alerts queue accessible');
  const foundCaseF = alertsRes.body.alerts.find(a => a.caseRecord.caseId === 'SIH-CASE-0006');
  assert(Boolean(foundCaseF), 'Crisis case SIH-CASE-0006 is present in alerts queue');
  assert(foundCaseF.assessment.score !== undefined, `Distress score recorded (${foundCaseF.assessment.score})`);
  assert(Array.isArray(foundCaseF.assessment.triggerReasons) && foundCaseF.assessment.triggerReasons.length > 0, 'Escalation trigger reasons recorded');

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY C: Counsellor Triage & Closed-Loop Interventions (Scenario 6)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n▶ JOURNEY C: Counsellor Triage & Closed-Loop Interventions (Scenario 6)');
  const casesRes = await req('/counsellor/cases', {}, counsellorCookie);
  assert(casesRes.ok, 'Counsellor cases queue retrieved');
  assert(casesRes.body.cases.length === 8, 'All 8 personas available in triage queue');

  const caseBRes = await req('/counsellor/cases/SIH-CASE-0002/interventions', {}, counsellorCookie);
  assert(caseBRes.ok, 'SIH-CASE-0002 interventions retrieved');
  const intvs = caseBRes.body.interventions;
  assert(intvs.length > 0, 'Interventions exist for SIH-CASE-0002');
  
  const targetIntv = intvs[0];
  console.log(`  Initial target intervention (${targetIntv.code}) status: ${targetIntv.status}`);
  
  // Test valid lifecycle progression:
  // If ASSIGNED -> contact -> CONTACTED
  let currentStatus = targetIntv.status;
  if (currentStatus === 'ASSIGNED') {
    const contactRes = await req(`/counsellor/cases/SIH-CASE-0002/interventions/${targetIntv.id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'contact', outcomeNote: 'Spoke with complainant directly' }),
    }, counsellorCookie);
    assert(contactRes.ok, 'Transition ASSIGNED -> CONTACTED succeeded');
    assert(contactRes.body.intervention.status === 'CONTACTED', 'Status updated to CONTACTED');
    currentStatus = 'CONTACTED';
  }

  if (currentStatus === 'CONTACTED') {
    const followUpRes = await req(`/counsellor/cases/SIH-CASE-0002/interventions/${targetIntv.id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'follow_up', outcomeCode: 'follow_up_required', outcomeNote: 'Trial hearing next Tuesday' }),
    }, counsellorCookie);
    assert(followUpRes.ok, 'Transition CONTACTED -> FOLLOW_UP_DUE succeeded');
    assert(followUpRes.body.intervention.status === 'FOLLOW_UP_DUE', 'Status updated to FOLLOW_UP_DUE');

    const completeRes = await req(`/counsellor/cases/SIH-CASE-0002/interventions/${targetIntv.id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'complete', outcomeCode: 'support_completed', outcomeNote: 'Protection cell assigned and verified' }),
    }, counsellorCookie);
    assert(completeRes.ok, 'Transition FOLLOW_UP_DUE -> COMPLETED succeeded');
    assert(completeRes.body.intervention.status === 'COMPLETED', 'Status updated to COMPLETED');

    const closeRes = await req(`/counsellor/cases/SIH-CASE-0002/interventions/${targetIntv.id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action: 'close', outcomeCode: 'support_completed' }),
    }, counsellorCookie);
    assert(closeRes.ok, 'Transition COMPLETED -> CLOSED succeeded');
    assert(closeRes.body.intervention.status === 'CLOSED', 'Status updated to CLOSED');
  }

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY D: Outreach Continuity & Consent Revocation (Scenarios 4 & 5)
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n▶ JOURNEY D: Outreach Continuity & Consent Revocation (Scenarios 4 & 5)');
  // Scenario 4: Operational Alert for Persona H (SIH-CASE-0008)
  const opAlertsRes = await req('/counsellor/operational-alerts?status=active', {}, counsellorCookie);
  assert(opAlertsRes.ok, 'Operational alerts retrieved');
  const alertH = opAlertsRes.body.operationalAlerts.find(a => a.caseId === 'SIH-CASE-0008');
  assert(Boolean(alertH), 'Persona H operational alert active in queue');

  const resolveRes = await req(`/counsellor/operational-alerts/${alertH.id}/resolve`, {
    method: 'POST',
    body: JSON.stringify({ note: 'Reached complainant via Gram Panchayat welfare worker' }),
  }, counsellorCookie);
  assert(resolveRes.ok, 'Operational alert resolved successfully');
  assert(resolveRes.body.alert.status === 'resolved', 'Alert status is resolved');

  // Scenario 5: Consent Revocation for Persona D (SIH-CASE-0004)
  const caseDCookie = await login('case-d');
  const revokeRes = await req('/consent/revoke', {
    method: 'POST',
    body: JSON.stringify({ caseId: 'SIH-CASE-0004', reason: 'User requested opt-out' }),
  }, caseDCookie);
  assert(revokeRes.ok, 'Consent revocation processed');
  assert(revokeRes.body.record.revokedAt !== null, 'revokedAt timestamp set');
  assert(revokeRes.body.record.purposes.monitoring === false, 'Monitoring disabled');

  // Verify check-in is blocked (HTTP 403 with consentRequired)
  const blockedCheckinRes = await req('/checkin', {
    method: 'POST',
    body: JSON.stringify({
      caseId: 'SIH-CASE-0004',
      turns: [{ speaker: 'person', text: 'Hello' }],
      channel: 'app',
      consentAcknowledged: false,
    }),
  }, caseDCookie);
  assert(blockedCheckinRes.status === 403, 'Check-in correctly rejected with HTTP 403');
  assert(blockedCheckinRes.body.consentRequired === true, 'consentRequired flag returned');

  // ═══════════════════════════════════════════════════════════════════════
  // JOURNEY E: Admin System Monitor & Data Isolation Tier
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n▶ JOURNEY E: Admin System Monitor & Data Isolation Tier');
  const adminCookie = await login('admin');
  
  const summaryRes = await req('/admin/summary', {}, adminCookie);
  assert(summaryRes.ok, 'National summary metrics retrieved');
  assert(summaryRes.body.totalMonitoredCases !== undefined, 'Total monitored cases reported');
  assert(summaryRes.body.cases === undefined, 'ZERO individual case objects leaked');

  const trendsRes = await req('/admin/trends', {}, adminCookie);
  assert(trendsRes.ok, 'Admin trend metrics retrieved');
  assert(Boolean(trendsRes.body.bandDistribution), 'Distress band distribution reported');

  const geoRes = await req('/admin/geography?scope=national', {}, adminCookie);
  assert(geoRes.ok, 'Geographic drill-down retrieved');
  assert(Array.isArray(geoRes.body.groups), 'Geographic groups list returned');

  // Verify Audit Log includes counsellor and consent actions
  const auditRes = await req('/admin/audit', {}, adminCookie);
  assert(auditRes.ok, 'Audit log retrieved by admin');
  assert(Array.isArray(auditRes.body.entries), 'Audit log contains entries array');
  const hasInterventionLog = auditRes.body.entries.some(e => e.action && e.action.startsWith('intervention_'));
  assert(hasInterventionLog, 'Counsellor intervention action recorded in audit log');
  console.log(`  Total audit events recorded: ${auditRes.body.entries.length}`);

  console.log(`\n🎉 ALL 5 USER JOURNEYS PASSED CLEANLY! (${passed}/${total} assertions passed)\n`);
}

run().catch(err => {
  console.error('\n❌ Test execution encountered an error:', err);
  process.exit(1);
});
