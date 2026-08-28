/**
 * Persona report — prints what the generic pipeline makes of the seeded personas.
 *
 * A demo-prep tool, not a test. `npm run personas` gives a teammate the whole
 * demo dataset on one screen: what each persona's current reading is, why, and
 * whether it escalated. Useful when rehearsing answers to "why is that one
 * flagged and that one not?".
 *
 * The numbers here are computed, never read from the seed file. If a scoring
 * weight changes, this output changes with it.
 */

import { buildPersonaCases, PERSONA_TARGETS } from '../src/data/personas.js';
import { assessCaseHistory } from '../src/domain/assessCase.js';
import { CHECK_IN_STATUS } from '../src/domain/engagement.js';

const NOW = Date.parse('2026-08-26T09:00:00.000Z');
const pad = (s, n) => String(s).padEnd(n);

// Rounded for the console only. The scoring pipeline keeps full precision — a
// component printed as 25.1 is 25.119047619047617 where it matters.
const r1 = (v) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v);

let checked = 0;
let matched = 0;

for (const { caseRecord, history } of buildPersonaCases({ now: NOW })) {
  const series = assessCaseHistory(caseRecord, history, { now: NOW });
  const latest = series.at(-1);
  const target = PERSONA_TARGETS[caseRecord.key];
  const missed = history.filter((c) => c.status === CHECK_IN_STATUS.MISSED).length;

  // Same conditions the test suite asserts, restated here so a teammate reading
  // the console can see at a glance whether the seed still hits its spec target.
  const bandOk = target.bands.includes(latest.band);
  const escalationOk = latest.escalation.triggered === target.escalates;
  const triggerOk = !target.expectTrigger
    || latest.escalation.triggerReasons.some((t) => t.code === target.expectTrigger);
  const ok = bandOk && escalationOk && triggerOk;
  checked += 1;
  if (ok) matched += 1;

  console.log(`\n${'='.repeat(78)}`);
  console.log(`${caseRecord.key} — ${caseRecord.pseudonym}  [${caseRecord.caseStage}, ${caseRecord.monthsSinceRegistration}mo, ${caseRecord.preferredLocale}]`);
  console.log(`spec target : ${target.specTarget}`);
  console.log(`expected    : band ${target.bands.join('|')}, escalates=${target.escalates}${target.expectTrigger ? `, via ${target.expectTrigger}` : ''}`);
  console.log(`tags        : ${caseRecord.priorityTags.join(', ')}`);
  console.log(`history     : ${history.length} check-ins (${missed} missed), words ${history.map((c) => c.wordCount).join('/')}`);
  console.log(`${'-'.repeat(78)}`);
  console.log(`ACTUAL      : score ${latest.score} band ${pad(latest.band, 9)} adjusted ${latest.escalation.priorityAdjustedScore} (x${latest.escalation.priorityWeight})  escalated=${latest.escalation.triggered}`);
  console.log(`vs target   : ${ok ? 'MATCHES SPEC' : `MISMATCH — band:${bandOk ? 'ok' : 'no'} escalation:${escalationOk ? 'ok' : 'no'} trigger:${triggerOk ? 'ok' : 'no'}`}`);
  console.log(`triggers    : ${latest.escalation.triggerReasons.map((r) => r.code).join(', ') || '(none)'}`);
  console.log(`components  : sent ${r1(latest.components.sentiment)} / diseng ${r1(latest.components.disengagement)} / trend ${r1(latest.components.trendDelta)} / pattern ${r1(latest.components.flaggedPatternBoost)}`);
  console.log(`trend       : ${latest.trend.direction} (slope ${r1(latest.trend.slope)}, delta ${r1(latest.trend.delta)}, ${latest.trend.points} points)`);
  console.log(`mismatch    : sustained=${latest.mismatch.sustained} run=${latest.mismatch.run}`);
  console.log(`headline    : ${latest.explanation.headline}`);
  console.log(`series      : ${series.map((a) => a.score).join(' -> ')}`);
  console.log(`bands       : ${series.map((a) => a.band[0].toUpperCase()).join(' ')}`);
}

console.log(`\n${'='.repeat(78)}`);
console.log(`${matched}/${checked} personas match their spec Section 6 target.`);
console.log('');

