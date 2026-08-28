/**
 * Tests for the record schema — the shapes every other layer agrees on.
 *
 * The load-bearing requirement here is that seed data cannot LIE. Engagement
 * metrics are computed from reply length and timing, so if a seed file could
 * hand-write `wordCount: 1` next to a forty-word reply, every downstream trend
 * chart would be fiction. The factory derives those fields from the actual text.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CHECK_IN_STATUS } from './engagement.js';
import {
  CHANNEL,
  LOCALE,
  PROVENANCE,
  SPEAKER,
  makeCase,
  makeCheckIn,
  makeCheckInHistory,
  makeAssessment,
  resolveOccurredAt,
} from './records.js';

/** A fixed clock, so every timestamp assertion is deterministic. */
const NOW = Date.parse('2026-08-26T09:00:00.000Z');

const reply = (text) => [
  { speaker: SPEAKER.SYSTEM, text: 'How have things been since we last spoke?' },
  { speaker: SPEAKER.PERSON, text },
];

describe('makeCheckIn — derived fields', () => {
  test('word count is derived from the reply, not taken on trust', () => {
    const c = makeCheckIn({ turns: reply('one two three four five') }, { now: NOW });
    assert.equal(c.wordCount, 5);
  });

  test('a hand-written wordCount cannot override the real text', () => {
    // Seed data must not be able to fake an engagement collapse.
    const c = makeCheckIn(
      { turns: reply('one two three four five'), wordCount: 40 },
      { now: NOW },
    );
    assert.equal(c.wordCount, 5);
  });

  test('only the person\'s words are counted, never the prompt', () => {
    const c = makeCheckIn({ turns: reply('fine') }, { now: NOW });
    assert.equal(c.wordCount, 1);
  });

  test('multiple person turns in one conversation are summed', () => {
    const c = makeCheckIn({
      turns: [
        { speaker: SPEAKER.SYSTEM, text: 'How are things?' },
        { speaker: SPEAKER.PERSON, text: 'about the same' },
        { speaker: SPEAKER.SYSTEM, text: 'Anything you need help with?' },
        { speaker: SPEAKER.PERSON, text: 'not really' },
      ],
    }, { now: NOW });
    assert.equal(c.wordCount, 5);
  });

  test('an emoji-only reply still counts as a reply', () => {
    const c = makeCheckIn({ turns: reply('🙃') }, { now: NOW });
    assert.equal(c.wordCount, 1);
  });

  test('a missed check-in has no words and no latency', () => {
    const c = makeCheckIn({ status: CHECK_IN_STATUS.MISSED }, { now: NOW });
    assert.equal(c.status, CHECK_IN_STATUS.MISSED);
    assert.equal(c.wordCount, 0);
    assert.equal(c.responseLatencyHours, null);
    assert.equal(c.turns.length, 0);
  });

  test('a check-in with text defaults to completed', () => {
    const c = makeCheckIn({ turns: reply('doing all right') }, { now: NOW });
    assert.equal(c.status, CHECK_IN_STATUS.COMPLETED);
  });

  test('a prompt with no reply infers missed, not completed-with-zero-words', () => {
    // Counting silence as a completed check-in would crash the reply-length trend
    // as if the person had answered in no words, and simultaneously fail to
    // register that they did not answer at all. One event, two wrong readings.
    const c = makeCheckIn({ turns: [{ speaker: SPEAKER.SYSTEM, text: 'How has this week been?' }] }, { now: NOW });
    assert.equal(c.status, CHECK_IN_STATUS.MISSED);
    assert.equal(c.wordCount, 0);
  });
});

describe('makeCheckIn — timestamps', () => {
  test('daysAgo is resolved against the supplied clock, so seeds never go stale', () => {
    const c = makeCheckIn({ daysAgo: 7, turns: reply('ok') }, { now: NOW });
    const expected = new Date(NOW - 7 * 86400000).toISOString();
    assert.equal(c.occurredAt, expected);
  });

  test('daysAgo 0 is now', () => {
    const c = makeCheckIn({ daysAgo: 0, turns: reply('ok') }, { now: NOW });
    assert.equal(c.occurredAt, new Date(NOW).toISOString());
  });

  test('an explicit occurredAt is respected', () => {
    const c = makeCheckIn(
      { occurredAt: '2026-01-01T00:00:00.000Z', turns: reply('ok') },
      { now: NOW },
    );
    assert.equal(c.occurredAt, '2026-01-01T00:00:00.000Z');
  });

  test('resolveOccurredAt is a pure function of (daysAgo, now)', () => {
    assert.equal(resolveOccurredAt(3, NOW), resolveOccurredAt(3, NOW));
    assert.ok(resolveOccurredAt(1, NOW) > resolveOccurredAt(2, NOW));
  });
});

describe('makeCheckIn — defaults and validation', () => {
  test('unknown status, channel and locale fall back to safe defaults', () => {
    const c = makeCheckIn(
      { turns: reply('ok'), status: 'nonsense', channel: 'telepathy', locale: 'xx' },
      { now: NOW },
    );
    assert.equal(c.status, CHECK_IN_STATUS.COMPLETED);
    assert.equal(c.channel, CHANNEL.APP);
    assert.equal(c.locale, LOCALE.EN);
  });

  test('surface sentiment is clamped to 0-100 and never NaN', () => {
    for (const [given, expected] of [[-20, 0], [140, 100], ['high', null], [42, 42]]) {
      const c = makeCheckIn({ turns: reply('ok'), surfaceSentiment: given }, { now: NOW });
      assert.equal(c.surfaceSentiment, expected);
    }
  });

  test('seed records are marked as seed provenance by default', () => {
    const c = makeCheckIn({ turns: reply('ok') }, { now: NOW });
    assert.equal(c.provenance, PROVENANCE.SEED);
  });

  test('records are frozen, so no layer can mutate shared history in place', () => {
    const c = makeCheckIn({ turns: reply('ok') }, { now: NOW });
    assert.ok(Object.isFrozen(c));
    assert.ok(Object.isFrozen(c.turns));
  });

  test('malformed input produces a valid record rather than throwing', () => {
    for (const bad of [undefined, {}, { turns: 'not an array' }, { turns: [null] }]) {
      const c = makeCheckIn(bad, { now: NOW });
      assert.ok(Number.isFinite(c.wordCount));
      assert.ok(typeof c.occurredAt === 'string');
    }
  });
});

describe('makeCheckIn — signals and quoted phrases', () => {
  test('signals outside the closed vocabulary are dropped, not passed through', () => {
    // A model that invents a signal code must not be able to introduce one that
    // no escalation rule can match and no reviewer knows exists.
    const c = makeCheckIn({
      turns: reply('ok'),
      signals: ['hopelessness', 'feeling_a_bit_low', 'intimidation'],
    }, { now: NOW });
    assert.deepEqual(c.signals, ['hopelessness', 'intimidation']);
  });

  test('duplicate signals are collapsed', () => {
    const c = makeCheckIn({
      turns: reply('ok'),
      signals: ['hopelessness', 'hopelessness'],
    }, { now: NOW });
    assert.deepEqual(c.signals, ['hopelessness']);
  });

  test('quoted phrases are kept verbatim so the panel shows what was said', () => {
    const c = makeCheckIn({
      turns: reply('nothing has moved'),
      signalPhrases: ['nothing has moved'],
    }, { now: NOW });
    assert.deepEqual(c.signalPhrases, ['nothing has moved']);
  });

  test('a missed check-in carries no signals — silence is not evidence', () => {
    const c = makeCheckIn({
      status: CHECK_IN_STATUS.MISSED,
      signals: ['hopelessness'],
      signalPhrases: ['nothing has moved'],
    }, { now: NOW });
    assert.deepEqual(c.signals, []);
    assert.deepEqual(c.signalPhrases, []);
  });

  test('signals and phrases default to empty arrays and are frozen', () => {
    const c = makeCheckIn({ turns: reply('ok') }, { now: NOW });
    assert.deepEqual(c.signals, []);
    assert.ok(Object.isFrozen(c.signals));
    assert.ok(Object.isFrozen(c.signalPhrases));
  });

  test('an immediate-review request is recorded but defaults to false', () => {
    assert.equal(makeCheckIn({ turns: reply('ok') }, { now: NOW }).immediateReviewRequested, false);
    assert.equal(
      makeCheckIn({ turns: reply('ok'), immediateReviewRequested: true }, { now: NOW })
        .immediateReviewRequested,
      true,
    );
    // Only a strict true counts — a truthy string from a JSON payload must not.
    assert.equal(
      makeCheckIn({ turns: reply('ok'), immediateReviewRequested: 'yes' }, { now: NOW })
        .immediateReviewRequested,
      false,
    );
  });
});

describe('makeCheckInHistory', () => {
  const raw = [
    { daysAgo: 21, turns: reply('a fairly full answer with several words in it'), surfaceSentiment: 20 },
    { daysAgo: 14, status: CHECK_IN_STATUS.MISSED },
    { daysAgo: 7, turns: reply('fine'), surfaceSentiment: 22 },
  ];

  test('history is ordered oldest-first, because every trend function assumes it', () => {
    const history = makeCheckInHistory('SIH-CASE-0001', raw, { now: NOW });
    const times = history.map((c) => Date.parse(c.occurredAt));
    for (let i = 1; i < times.length; i++) {
      assert.ok(times[i] > times[i - 1], 'history is not chronological');
    }
  });

  test('out-of-order seed input is sorted rather than silently trusted', () => {
    const shuffled = [raw[2], raw[0], raw[1]];
    const history = makeCheckInHistory('SIH-CASE-0001', shuffled, { now: NOW });
    assert.deepEqual(history.map((c) => c.daysAgo), [21, 14, 7]);
  });

  test('every check-in carries its case id and a 1-based sequence number', () => {
    const history = makeCheckInHistory('SIH-CASE-0001', raw, { now: NOW });
    assert.deepEqual(history.map((c) => c.sequence), [1, 2, 3]);
    for (const c of history) assert.equal(c.caseId, 'SIH-CASE-0001');
  });

  test('check-in ids are unique and stable across runs', () => {
    const a = makeCheckInHistory('SIH-CASE-0001', raw, { now: NOW });
    const b = makeCheckInHistory('SIH-CASE-0001', raw, { now: NOW });
    assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id));
    assert.equal(new Set(a.map((c) => c.id)).size, a.length);
  });

  /**
   * A missed check-in has no words, so it has no surface reading of its own.
   * The mismatch detector still needs to know whether the words were reading as
   * untroubled around it, so the previous reading is carried forward and the
   * record says so explicitly rather than inventing a number.
   */
  test('a missed check-in carries the previous surface reading forward, and says so', () => {
    const history = makeCheckInHistory('SIH-CASE-0001', raw, { now: NOW });
    const missed = history[1];
    assert.equal(missed.surfaceSentiment, 20);
    assert.equal(missed.surfaceSentimentCarriedForward, true);
    assert.equal(history[0].surfaceSentimentCarriedForward, false);
  });

  test('a leading missed check-in has nothing to carry forward and stays null', () => {
    const history = makeCheckInHistory('SIH-CASE-0001', [
      { daysAgo: 30, status: CHECK_IN_STATUS.MISSED },
      { daysAgo: 20, turns: reply('ok'), surfaceSentiment: 30 },
    ], { now: NOW });
    assert.equal(history[0].surfaceSentiment, null);
  });

  test('empty and malformed history degrade to an empty array', () => {
    for (const bad of [undefined, null, [], 'nope']) {
      assert.deepEqual(makeCheckInHistory('SIH-CASE-0001', bad, { now: NOW }), []);
    }
  });
});

describe('makeCase', () => {
  test('a case record carries only pseudonymous identity', () => {
    const c = makeCase({
      key: 'A',
      caseId: 'SIH-CASE-0001',
      pseudonym: 'Complainant A',
      district: 'Demo District 1',
      state: 'Demo State 1',
    });
    assert.equal(c.caseId, 'SIH-CASE-0001');
    assert.equal(c.pseudonym, 'Complainant A');
    // No field exists to hold a real name, phone number or address at all.
    for (const forbidden of ['name', 'fullName', 'phone', 'mobile', 'email', 'address', 'aadhaar']) {
      assert.ok(!(forbidden in c), `case record exposes a ${forbidden} field`);
    }
  });

  test('priority tags default to the baseline rather than empty', () => {
    const c = makeCase({ caseId: 'SIH-CASE-0001' });
    assert.ok(Array.isArray(c.priorityTags));
    assert.ok(c.priorityTags.length >= 1);
  });

  test('case records are frozen', () => {
    const c = makeCase({ caseId: 'SIH-CASE-0001' });
    assert.ok(Object.isFrozen(c));
    assert.ok(Object.isFrozen(c.priorityTags));
  });
});

describe('makeAssessment', () => {
  const base = {
    caseId: 'SIH-CASE-0001',
    checkInId: 'SIH-CASE-0001#3',
    score: 62,
    band: 'elevated',
    components: { sentiment: 60, disengagement: 70, trendDelta: 10, flaggedPatternBoost: 0 },
    contributions: { sentiment: 27, disengagement: 24.5, trendDelta: 1.2, flaggedPatternBoost: 0 },
  };

  test('provenance records whether the score came from a live call or a cached fallback', () => {
    const live = makeAssessment({ ...base, provenance: { source: PROVENANCE.LIVE, model: 'openai/gpt-oss-120b' } }, { now: NOW });
    assert.equal(live.provenance.source, PROVENANCE.LIVE);
    assert.equal(live.provenance.model, 'openai/gpt-oss-120b');

    const cached = makeAssessment({ ...base, provenance: { source: PROVENANCE.CACHED_FALLBACK } }, { now: NOW });
    assert.equal(cached.provenance.source, PROVENANCE.CACHED_FALLBACK);
  });

  test('an unrecognised provenance source degrades to the honest default, not to live', () => {
    // Claiming a score was live when it was not would be a false accuracy claim.
    const a = makeAssessment({ ...base, provenance: { source: 'made-up' } }, { now: NOW });
    assert.notEqual(a.provenance.source, PROVENANCE.LIVE);
    assert.ok(Object.values(PROVENANCE).includes(a.provenance.source));
  });

  test('provenance is always present even when the caller omits it', () => {
    const a = makeAssessment(base, { now: NOW });
    assert.ok(a.provenance);
    assert.ok(Object.values(PROVENANCE).includes(a.provenance.source));
    assert.equal(a.provenance.generatedAt, new Date(NOW).toISOString());
  });

  test('an assessment always carries an explanation structure', () => {
    const a = makeAssessment(base, { now: NOW });
    assert.ok(Array.isArray(a.explanation.drivers));
    assert.ok(Array.isArray(a.explanation.signalPhrases));
    assert.equal(typeof a.explanation.headline, 'string');
  });

  test('assessments are frozen', () => {
    const a = makeAssessment(base, { now: NOW });
    assert.ok(Object.isFrozen(a));
    assert.ok(Object.isFrozen(a.provenance));
  });
});
