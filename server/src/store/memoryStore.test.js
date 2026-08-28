/**
 * Tests for the in-memory store.
 *
 * Two things carry weight here.
 *
 * 1. A LIVE CHECK-IN IS NOT PRIVILEGED. Appending goes through the same record
 *    factory as the seed, so a caller cannot assert a word count, a status, or an
 *    engagement pattern. The demo's live conversation and its pre-populated
 *    history are scored by identical code.
 *
 * 2. THE AGGREGATE INPUT CARRIES NO IDENTITY. What the store hands the aggregate
 *    projection is asserted field by field. The admin tier cannot leak what it was
 *    never given, so this is the cheapest half of the two-tier guarantee — and it
 *    is checked here rather than only at the route.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createStore } from './memoryStore.js';
import { PROVENANCE, SPEAKER } from '../domain/records.js';
import { CHECK_IN_STATUS } from '../domain/engagement.js';
import { assessCaseHistory } from '../domain/assessCase.js';
import { PERSONA_KEYS, buildPersonaCases } from '../data/personas.js';

const NOW = Date.parse('2026-08-26T09:00:00.000Z');
const fresh = () => createStore({ now: NOW });

const reply = (text) => [
  { speaker: SPEAKER.SYSTEM, text: 'How have things been since we last checked in?' },
  { speaker: SPEAKER.PERSON, text },
];

describe('seeding', () => {
  test('all six personas are loaded with history and a scored series', () => {
    const s = fresh();
    assert.equal(s.listCases().length, PERSONA_KEYS.length);
    for (const c of s.listCases()) {
      assert.ok(s.getHistory(c.caseId).length >= 6, `${c.key} has too little history`);
      assert.equal(
        s.getAssessmentSeries(c.caseId).length,
        s.getHistory(c.caseId).length,
        `${c.key} has a series that does not match its history`,
      );
      assert.ok(s.getLatestAssessment(c.caseId));
    }
  });

  /**
   * The store unwraps finished records back into raw declarations so it can stay
   * appendable. This asserts that round trip is lossless, by scoring the personas
   * straight from the data layer and comparing. If the unwrap dropped a field, the
   * store's numbers would drift from the seed's and every chart would be subtly
   * wrong with nothing to show it.
   */
  test('unwrapping and rebuilding the seed reproduces the data layer exactly', () => {
    const s = fresh();
    for (const { caseRecord, history } of buildPersonaCases({ now: NOW })) {
      const direct = assessCaseHistory(caseRecord, history, { now: NOW });
      const viaStore = s.getAssessmentSeries(caseRecord.caseId);

      assert.deepEqual(
        viaStore.map((a) => a.score), direct.map((a) => a.score),
        `${caseRecord.key}: the store's scores differ from the data layer's`,
      );
      assert.deepEqual(viaStore.map((a) => a.band), direct.map((a) => a.band));
      assert.deepEqual(
        viaStore.map((a) => a.escalation.triggered), direct.map((a) => a.escalation.triggered),
        `${caseRecord.key}: escalation decisions differ between store and data layer`,
      );
      assert.deepEqual(
        viaStore.at(-1).escalation.triggerReasons.map((r) => r.code),
        direct.at(-1).escalation.triggerReasons.map((r) => r.code),
      );
      // The signal tags and quoted phrases have to survive the unwrap too, or the
      // explainability panel loses the evidence while the score keeps the effect.
      assert.deepEqual(
        s.getHistory(caseRecord.caseId).map((c) => [...c.signals]),
        history.map((c) => [...c.signals]),
        `${caseRecord.key}: signals were lost in the unwrap`,
      );
      assert.deepEqual(
        s.getHistory(caseRecord.caseId).map((c) => [...c.signalPhrases]),
        history.map((c) => [...c.signalPhrases]),
      );
      assert.deepEqual(
        s.getHistory(caseRecord.caseId).map((c) => c.wordCount),
        history.map((c) => c.wordCount),
      );
    }
  });

  test('a carried-forward reading is re-derived on rebuild, not frozen in', () => {
    // Persona A has a missed check-in that inherits the previous reading. If the
    // store had stored that inherited value as the check-in's own, the record
    // would stop disclosing that it was borrowed.
    const s = fresh();
    const a = s.listCases().find((c) => c.key === 'A');
    const missed = s.getHistory(a.caseId).find((c) => c.status === CHECK_IN_STATUS.MISSED);
    assert.ok(missed, 'persona A no longer has a missed check-in to test');
    assert.equal(missed.surfaceSentimentCarriedForward, true);
  });

  test('two stores built with the same clock are identical', () => {
    const scores = (s) => s.listCases().map((c) => s.getLatestAssessment(c.caseId).score);
    assert.deepEqual(scores(fresh()), scores(fresh()));
  });

  test('unknown case ids return empty rather than throwing', () => {
    const s = fresh();
    assert.equal(s.getCase('SIH-CASE-9999'), null);
    assert.deepEqual(s.getHistory('SIH-CASE-9999'), []);
    assert.deepEqual(s.getAssessmentSeries('SIH-CASE-9999'), []);
    assert.equal(s.getLatestAssessment('SIH-CASE-9999'), null);
    assert.equal(s.appendCheckIn('SIH-CASE-9999', {}), null);
  });
});

describe('appending a live check-in', () => {
  const caseIdFor = (s, key) => s.listCases().find((c) => c.key === key).caseId;

  test('the new check-in lands at the end of the history and gets its own assessment', () => {
    const s = fresh();
    const id = caseIdFor(s, 'C');
    const before = s.getHistory(id).length;

    const assessment = s.appendCheckIn(id, {
      turns: reply('Still doing all right, nothing has changed since last time.'),
      surfaceSentiment: 20,
      responseLatencyHours: 2,
    }, { now: NOW });

    assert.equal(s.getHistory(id).length, before + 1);
    assert.equal(s.getAssessmentSeries(id).length, before + 1);
    assert.equal(s.getLatestAssessment(id), assessment);
  });

  test('word count is derived from the reply, so a caller cannot assert engagement', () => {
    const s = fresh();
    const id = caseIdFor(s, 'C');
    s.appendCheckIn(id, {
      turns: reply('one two three'),
      wordCount: 500,              // a caller trying to fake full engagement
      status: 'completed',
      surfaceSentiment: 20,
    }, { now: NOW });
    assert.equal(s.getHistory(id).at(-1).wordCount, 3);
  });

  test('a live check-in is marked live, not passed off as seeded history', () => {
    const s = fresh();
    const id = caseIdFor(s, 'C');
    const assessment = s.appendCheckIn(id, {
      turns: reply('all fine here'), surfaceSentiment: 20,
    }, { now: NOW });
    assert.equal(s.getHistory(id).at(-1).provenance, PROVENANCE.LIVE);
    assert.equal(assessment.provenance.source, PROVENANCE.LIVE);
  });

  test('a cached fallback declares itself as one', () => {
    // Demo-reliability path: the live call failed and a cached response was served.
    // It must not appear on screen as though the model reasoned about this person.
    const s = fresh();
    const id = caseIdFor(s, 'C');
    const assessment = s.appendCheckIn(id, {
      turns: reply('all fine here'), surfaceSentiment: 20, provenance: PROVENANCE.CACHED_FALLBACK,
    }, { now: NOW });
    assert.equal(assessment.provenance.source, PROVENANCE.CACHED_FALLBACK);
  });

  test('the whole series is recomputed, so earlier points stay prefix-only', () => {
    const s = fresh();
    const id = caseIdFor(s, 'E');
    const firstBefore = s.getAssessmentSeries(id)[0].score;
    s.appendCheckIn(id, { turns: reply('nothing has moved'), surfaceSentiment: 85 }, { now: NOW });
    const firstAfter = s.getAssessmentSeries(id)[0].score;
    assert.equal(
      firstAfter, firstBefore,
      'a new check-in changed the score of the first one, so the chart is not prefix-only',
    );
  });

  test('a live check-in is pinned to a moment and does not drift on rebuild', () => {
    const s = fresh();
    const id = caseIdFor(s, 'C');
    s.appendCheckIn(id, { turns: reply('all fine'), surfaceSentiment: 20 }, { now: NOW });
    const stamped = s.getHistory(id).at(-1).occurredAt;
    // Any later write triggers a full rebuild; the earlier live entry must not move.
    s.appendCheckIn(id, { turns: reply('still fine'), surfaceSentiment: 20 }, { now: NOW + 86_400_000 });
    assert.equal(s.getHistory(id).at(-2).occurredAt, stamped);
  });

  test('enough reassurance paired with silence eventually escalates a settled case', () => {
    // The system must be able to change its mind about someone. C reads as low
    // concern today; if C starts answering in one word, that has to register.
    const s = fresh();
    const id = caseIdFor(s, 'C');
    assert.equal(s.getLatestAssessment(id).escalation.triggered, false);
    for (let i = 0; i < 4; i++) {
      s.appendCheckIn(id, {
        turns: reply('Fine.'), surfaceSentiment: 18, responseLatencyHours: 30 + i * 6,
      }, { now: NOW + (i + 1) * 86_400_000 });
    }
    const latest = s.getLatestAssessment(id);
    assert.ok(latest.mismatch.sustained, 'a collapse into one-word replies went unnoticed');
    assert.ok(latest.escalation.triggered);
  });
});

describe('case prioritisation', () => {
  test('every case appears exactly once in the queue', () => {
    const s = fresh();
    const queue = s.prioritisedQueue();
    assert.equal(queue.length, s.listCases().length);
    assert.equal(new Set(queue.map((r) => r.caseRecord.caseId)).size, queue.length);
  });

  test('escalated cases come first as a block, whatever their raw score', () => {
    const s = fresh();
    const flags = s.prioritisedQueue().map((r) => r.assessment.escalation.triggered);
    const firstUnescalated = flags.indexOf(false);
    if (firstUnescalated !== -1) {
      assert.ok(
        flags.slice(firstUnescalated).every((f) => f === false),
        'an escalated case sorted below an unescalated one',
      );
    }
  });

  test('within the escalated block, the priority-adjusted score orders them', () => {
    const s = fresh();
    const escalated = s.prioritisedQueue().filter((r) => r.assessment.escalation.triggered);
    for (let i = 1; i < escalated.length; i++) {
      assert.ok(
        escalated[i - 1].assessment.escalation.priorityAdjustedScore >=
        escalated[i].assessment.escalation.priorityAdjustedScore,
        'the escalated block is not ordered by priority-adjusted score',
      );
    }
  });

  test('the witness case ranks at the top of the queue', () => {
    // Spec Section 6 targets this case as the urgent one. It should not need a
    // counsellor to scroll to find it.
    const s = fresh();
    assert.equal(s.prioritisedQueue()[0].caseRecord.key, 'B');
  });

  test('the queue order is stable across repeated reads', () => {
    const s = fresh();
    assert.deepEqual(
      s.prioritisedQueue().map((r) => r.caseRecord.caseId),
      s.prioritisedQueue().map((r) => r.caseRecord.caseId),
    );
  });

  test('alerts are exactly the escalated cases, each with a stated reason', () => {
    const s = fresh();
    const alerts = s.alerts();
    assert.ok(alerts.length > 0);
    for (const row of alerts) {
      assert.equal(row.assessment.escalation.triggered, true);
      assert.ok(
        row.assessment.escalation.triggerReasons.length > 0,
        `${row.caseRecord.key} is in the alert panel with no reason attached`,
      );
      for (const reason of row.assessment.escalation.triggerReasons) {
        assert.ok(reason.code && reason.label, 'an alert reason has no readable label');
      }
    }
  });
});

describe('what the store hands the aggregate tier', () => {
  /**
   * The load-bearing privacy test on this module.
   *
   * Every field is allow-listed. If someone adds `pseudonym` to make an admin
   * chart easier to label, this fails — which is the whole reason the allow-list
   * is written out rather than described.
   */
  test('aggregate inputs contain no identifying field at all', () => {
    const ALLOWED = new Set([
      'district', 'state', 'caseStage', 'priorityTags', 'monthsSinceRegistration',
      'band', 'escalated', 'trendDirection', 'checkInCount',
    ]);
    const rows = fresh().aggregateInputs();
    assert.ok(rows.length > 0);
    for (const row of rows) {
      for (const key of Object.keys(row)) {
        assert.ok(ALLOWED.has(key), `aggregate input leaks a "${key}" field`);
      }
      for (const forbidden of ['caseId', 'pseudonym', 'key', 'name', 'turns', 'signalPhrases', 'history', 'score']) {
        assert.ok(!(forbidden in row), `aggregate input leaks ${forbidden}`);
      }
    }
  });

  test('no case text or quoted phrase survives into the aggregate input', () => {
    const serialised = JSON.stringify(fresh().aggregateInputs());
    for (const fragment of ['Complainant', 'SIH-CASE', 'totally fine', 'being watched']) {
      assert.ok(!serialised.includes(fragment), `aggregate input contains "${fragment}"`);
    }
  });

  test('one row per case, so counts are correct without identities', () => {
    const s = fresh();
    assert.equal(s.aggregateInputs().length, s.listCases().length);
  });

  test('the exact score is withheld — only the band crosses the boundary', () => {
    // A precise score is close to a fingerprint when a bucket is small. The band
    // is what an administrator actually needs for a distribution chart.
    for (const row of fresh().aggregateInputs()) {
      assert.equal(typeof row.band, 'string');
      assert.ok(!('score' in row));
      assert.ok(!('priorityAdjustedScore' in row));
    }
  });
});
