/**
 * Script to reset and verify all 8 synthetic demo personas and scenarios.
 *
 * Usage:
 *   node scripts/reset-demo.js
 */

import { store } from '../src/store/memoryStore.js';

console.log('🔄 Resetting in-memory store to pristine demo fixtures...');
store.reset();

const cases = store.listCases();
const alerts = store.alerts();
const opAlerts = store.getOperationalAlerts ? store.getOperationalAlerts() : [];

console.log(`\n✅ In-memory store successfully seeded:`);
console.log(`   - Total Cases: ${cases.length}`);
console.log(`   - Total Alerts: ${alerts.length}`);
console.log(`   - Total Operational Alerts: ${opAlerts.length}`);

console.log('\n📋 Verified Demo Scenarios:');
const scenarios = [
  { id: 'SIH-CASE-0001', code: 'Scenario 1 (Persona A)', desc: 'Routine Baseline Check-in (Low distress, stable trajectory)' },
  { id: 'SIH-CASE-0002', code: 'Scenario 2 & 6 (Persona B)', desc: 'Escalation & Intervention Assigned (DLSA protection referral)' },
  { id: 'SIH-CASE-0003', code: 'Scenario 7 (Persona C)', desc: 'Resolved Case Flow (Support completed, outcome recorded)' },
  { id: 'SIH-CASE-0004', code: 'Scenario 5 (Persona D)', desc: 'Consent Revoked Flow (Outreach fallback, checkin blocked)' },
  { id: 'SIH-CASE-0005', code: 'Scenario 3 (Persona E)', desc: 'Deflection & Mismatch (High clinical distress masked by positive text)' },
  { id: 'SIH-CASE-0006', code: 'Scenario 2 (Persona F)', desc: 'Crisis Spike (Intimidation & severe risk trigger)' },
  { id: 'SIH-CASE-0007', code: 'Scenario 8 (Persona G)', desc: 'Multi-session recovery trajectory' },
  { id: 'SIH-CASE-0008', code: 'Scenario 4 (Persona H)', desc: 'Continuity Alert / Unreachable (Counsellor review flagged)' },
];

for (const sc of scenarios) {
  const c = store.getCase(sc.id);
  const h = store.getHistory(sc.id);
  const intvs = store.getInterventions(sc.id);
  const consent = store.getConsent(sc.id);
  const consentStatus = consent ? (consent.revokedAt ? 'REVOKED' : 'ACTIVE') : 'N/A';
  console.log(`  • [${sc.code}] ${sc.id} (${c ? c.pseudonym : 'MISSING'}):`);
  console.log(`      Status: ${c ? 'OK' : 'FAIL'} | Check-ins: ${h.length} | Interventions: ${intvs.length} | Consent: ${consentStatus}`);
  console.log(`      Detail: ${sc.desc}`);
}

console.log('\n🎉 Demo environment is ready for evaluation.\n');
