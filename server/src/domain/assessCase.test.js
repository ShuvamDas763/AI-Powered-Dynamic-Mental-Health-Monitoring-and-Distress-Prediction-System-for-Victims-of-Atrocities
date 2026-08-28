/**
 * Tests for the assessment pipeline — the piece that composes engagement,
 * scoring and escalation into one record the dashboard can render.
 *
 * The most important test in this file is the last one in the "score stays
 * calibrated" group. It pins the architecture we settled on after the Phase 1
 * probe: hard signals escalate a case through the RULE, they do not inflate the
 * SCORE. If someone later "fixes" a missed escalation by adding 40 points to the
 * distress score whenever intimidation appears, the score stops meaning anything
 * and that test fails.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CHECK_IN_STATUS, engagementMetrics } from './engagement.js';
import { BAND } from './distressScore.js';
import { SIGNAL, TRIGGER } from './escalation.js';
import { PRIORITY_USE_CASE } from './priorityWeighting.js';
import { LOCALE, SPEAKER, makeCase, makeCheckInHistory } from './records.js';
import {
  RECENT_SIGNAL_WINDOW,
  assessCaseHistory,
  assessLatest,
  collectRecentSignals,
} from './assessCase.js';

const NOW = Date.parse('2026-08-26T09:00:00.000Z');

const say = (text) => [
  { speaker: SPEAKER.SYSTEM, text: 'How have things been?' },
  { speaker: SPEAKER.PERSON, text },
];

const FORTY_WORDS =
  'things have been about the same as last time i spoke to someone at the office ' +
  'and i am still waiting to hear whether the next date has been fixed or moved again';

function fixture(rawHistory, caseOverrides = {}) {
  const caseRecord = makeCase({
    key: 'X',
    caseId: 'SIH-CASE-9999',
    pseudonym: 'Complainant X',
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY],
    ...caseOverrides,
  });
  const history = makeCheckInHistory(caseRecord.caseId, rawHistory, { now: NOW });
  return { caseRecord, history };
}

/** A steady, unremarkable history. Each test bends only what it is about. */
const STEADY = [
  { daysAgo: 28, turns: say(FORTY_WORDS), surfaceSentiment: 30, responseLatencyHours: 3 },
  { daysAgo: 21, turns: say(FORTY_WORDS), surfaceSentiment: 30, responseLatencyHours: 3 },
  { daysAgo: 14, turns: say(FORTY_WORDS), surfaceSentiment: 30, responseLatencyHours: 3 },
  { daysAgo: 7, turns: say(FORTY_WORDS), surfaceSentiment: 30, responseLatencyHours: 3 },
];

describe('assessCaseHistory — longitudinal series', () => {
  test('produces one assessment per check-in, so the trend chart is computed not drawn', () => {
    const { caseRecord, history } = fixture(STEADY);
    const series = assessCaseHistory(caseRecord, history, { now: NOW });
    assert.equal(series.length, history.length);
  });

  test('each assessment is attached to its own check-in, in order', () => {
    const { caseRecord, history } = fixture(STEADY);
    const series = assessCaseHistory(caseRecord, history, { now: NOW });
    assert.deepEqual(series.map((a) => a.checkInId), history.map((c) => c.id));
  });

  test('each assessment sees only the check-ins up to its own point in time', () => {
    // Otherwise the earliest point on the chart would already know the ending,
    // and the "rising trend" a counsellor is shown would be an artefact.
    const { caseRecord, history } = fixture([
      ...STEADY.slice(0, 3),
      { daysAgo: 3, status: CHECK_IN_STATUS.MISSED },
      { daysAgo: 1, status: CHECK_IN_STATUS.MISSED },
    ]);
    const series = assessCaseHistory(caseRecord, history, { now: NOW });
    assert.equal(series[0].engagement.total, 1);
    assert.equal(series[2].engagement.missedStreak, 0, 'early point must not see later misses');
    assert.equal(series.at(-1).engagement.missedStreak, 2);
  });

  test('assessLatest returns the final point of the same series', () => {
    const { caseRecord, history } = fixture(STEADY);
    const series = assessCaseHistory(caseRecord, history, { now: NOW });
    assert.deepEqual(assessLatest(caseRecord, history, { now: NOW }), series.at(-1));
  });

  test('empty history degrades to null rather than a fabricated zero score', () => {
    const { caseRecord } = fixture(STEADY);
    assert.deepEqual(assessCaseHistory(caseRecord, [], { now: NOW }), []);
    assert.equal(assessLatest(caseRecord, [], { now: NOW }), null);
  });

  test('malformed input does not throw', () => {
    const { caseRecord } = fixture(STEADY);
    for (const bad of [undefined, null, 'nope', [null]]) {
      assert.doesNotThrow(() => assessCaseHistory(caseRecord, bad, { now: NOW }));
      assert.doesNotThrow(() => assessCaseHistory(undefined, bad, { now: NOW }));
    }
  });

  test('identical inputs produce identical assessments', () => {
    const { caseRecord, history } = fixture(STEADY);
    assert.deepEqual(
      assessCaseHistory(caseRecord, history, { now: NOW }),
      assessCaseHistory(caseRecord, history, { now: NOW }),
    );
  });
});

describe('assessCaseHistory — component wiring', () => {
  test('the sentiment component is the latest reading of what was said', () => {
    const { caseRecord, history } = fixture([
      ...STEADY.slice(0, 3),
      { daysAgo: 7, turns: say(FORTY_WORDS), surfaceSentiment: 64, responseLatencyHours: 3 },
    ]);
    assert.equal(assessLatest(caseRecord, history, { now: NOW }).components.sentiment, 64);
  });

  test('the disengagement component is exactly what the engagement module computed', () => {
    const { caseRecord, history } = fixture([
      ...STEADY,
      { daysAgo: 3, status: CHECK_IN_STATUS.MISSED },
      { daysAgo: 1, status: CHECK_IN_STATUS.MISSED },
    ]);
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.equal(
      latest.components.disengagement,
      engagementMetrics(history).disengagementScore,
    );
  });

  test('a worsening trend adds to the score', () => {
    const rising = fixture([
      { daysAgo: 28, turns: say(FORTY_WORDS), surfaceSentiment: 20, responseLatencyHours: 3 },
      { daysAgo: 21, turns: say(FORTY_WORDS), surfaceSentiment: 35, responseLatencyHours: 3 },
      { daysAgo: 14, turns: say(FORTY_WORDS), surfaceSentiment: 50, responseLatencyHours: 3 },
      { daysAgo: 7, turns: say(FORTY_WORDS), surfaceSentiment: 65, responseLatencyHours: 3 },
    ]);
    const latest = assessLatest(rising.caseRecord, rising.history, { now: NOW });
    assert.ok(latest.components.trendDelta > 0);
    assert.equal(latest.trend.direction, 'rising');
  });

  test('an improving trend contributes nothing rather than a negative', () => {
    // Getting better must not be able to subtract from the reading and mask a
    // separate concern such as a collapse in participation.
    const improving = fixture([
      { daysAgo: 28, turns: say(FORTY_WORDS), surfaceSentiment: 70, responseLatencyHours: 3 },
      { daysAgo: 21, turns: say(FORTY_WORDS), surfaceSentiment: 55, responseLatencyHours: 3 },
      { daysAgo: 14, turns: say(FORTY_WORDS), surfaceSentiment: 40, responseLatencyHours: 3 },
      { daysAgo: 7, turns: say(FORTY_WORDS), surfaceSentiment: 25, responseLatencyHours: 3 },
    ]);
    const latest = assessLatest(improving.caseRecord, improving.history, { now: NOW });
    assert.equal(latest.components.trendDelta, 0);
    assert.equal(latest.trend.direction, 'improving');
  });

  test('the pattern component takes the strongest signal, not the sum', () => {
    const one = fixture([
      ...STEADY.slice(0, 3),
      { daysAgo: 7, turns: say(FORTY_WORDS), surfaceSentiment: 30, signals: [SIGNAL.HOPELESSNESS] },
    ]);
    const many = fixture([
      ...STEADY.slice(0, 3),
      {
        daysAgo: 7,
        turns: say(FORTY_WORDS),
        surfaceSentiment: 30,
        signals: [SIGNAL.HOPELESSNESS, SIGNAL.PROCESS_FATIGUE, SIGNAL.ECONOMIC_PRESSURE],
      },
    ]);
    const a = assessLatest(one.caseRecord, one.history, { now: NOW });
    const b = assessLatest(many.caseRecord, many.history, { now: NOW });
    assert.equal(b.components.flaggedPatternBoost, a.components.flaggedPatternBoost);
  });
});

describe('collectRecentSignals — silence after a signal is not reassurance', () => {
  test('a signal reported a couple of check-ins ago is still in scope', () => {
    const { history } = fixture([
      ...STEADY.slice(0, 2),
      { daysAgo: 14, turns: say(FORTY_WORDS), surfaceSentiment: 40, signals: [SIGNAL.INTIMIDATION] },
      { daysAgo: 7, status: CHECK_IN_STATUS.MISSED },
    ]);
    assert.ok(collectRecentSignals(history).includes(SIGNAL.INTIMIDATION));
  });

  test('a signal older than the window has aged out', () => {
    const older = [
      { daysAgo: 60, turns: say(FORTY_WORDS), surfaceSentiment: 40, signals: [SIGNAL.INTIMIDATION] },
      ...STEADY,
    ];
    const { history } = fixture(older);
    assert.ok(history.length > RECENT_SIGNAL_WINDOW);
    assert.ok(!collectRecentSignals(history).includes(SIGNAL.INTIMIDATION));
  });

  test('an intimidation report followed by silence still escalates a witness case', () => {
    // The exact shape that must never be read as "they stopped complaining, so
    // it must have resolved".
    const { caseRecord, history } = fixture(
      [
        ...STEADY.slice(0, 2),
        { daysAgo: 14, turns: say(FORTY_WORDS), surfaceSentiment: 45, signals: [SIGNAL.INTIMIDATION] },
        { daysAgo: 7, status: CHECK_IN_STATUS.MISSED },
      ],
      { priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION] },
    );
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.ok(latest.escalation.triggered);
    assert.ok(latest.escalation.triggerReasons.some(
      (r) => r.code === TRIGGER.INTIMIDATION_ON_WITNESS_CASE,
    ));
  });

  test('empty and malformed history yield no signals', () => {
    for (const bad of [undefined, null, [], 'nope']) {
      assert.deepEqual(collectRecentSignals(bad), []);
    }
  });
});

describe('assessCaseHistory — the score stays calibrated', () => {
  test('the case priority tag is what the escalation rule weighs against', () => {
    const plain = fixture(STEADY);
    const witness = fixture(STEADY, { priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION] });
    const a = assessLatest(plain.caseRecord, plain.history, { now: NOW });
    const b = assessLatest(witness.caseRecord, witness.history, { now: NOW });
    assert.equal(a.escalation.priorityWeight, 1);
    assert.ok(b.escalation.priorityWeight > 1);
    assert.equal(a.score, b.score, 'the score itself must not depend on the docket category');
  });

  /**
   * THE ARCHITECTURAL TEST.
   *
   * Escalation is the rule's job. A hard signal must be able to escalate a case
   * without pretending the person's distress reading is higher than the evidence
   * supports — otherwise the number on the counsellor's screen stops being a
   * measurement and becomes a lever for forcing alerts.
   */
  test('a hard signal escalates the case without inflating the score into the high band', () => {
    const { caseRecord, history } = fixture(
      [
        ...STEADY.slice(0, 3),
        {
          daysAgo: 7,
          turns: say(FORTY_WORDS),
          surfaceSentiment: 30,
          responseLatencyHours: 3,
          signals: [SIGNAL.INTIMIDATION],
        },
      ],
      { priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION] },
    );
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.ok(latest.escalation.triggered, 'the rule must escalate this');
    assert.notEqual(latest.band, BAND.HIGH, 'the score must not be inflated to force the alert');
  });
});

describe('assessCaseHistory — explainability', () => {
  test('every assessment lists its drivers, strongest first', () => {
    const { caseRecord, history } = fixture(STEADY);
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.ok(latest.explanation.drivers.length >= 4, 'all four components should be listed');
    const shares = latest.explanation.drivers.map((d) => d.contribution);
    for (let i = 1; i < shares.length; i++) {
      assert.ok(shares[i] <= shares[i - 1], 'drivers are not ordered by contribution');
    }
  });

  test('each driver names the component, its value and its share of the score', () => {
    const { caseRecord, history } = fixture(STEADY);
    const latest = assessLatest(caseRecord, history, { now: NOW });
    for (const d of latest.explanation.drivers) {
      assert.ok(d.component, 'driver has no component key');
      assert.ok(d.label && d.label.length > 0, `${d.component} has no label`);
      assert.ok(d.detail && d.detail.length > 0, `${d.component} has no detail`);
      assert.ok(Number.isFinite(d.value));
      assert.ok(Number.isFinite(d.contribution));
      assert.ok(Number.isFinite(d.sharePct));
    }
    const totalShare = latest.explanation.drivers.reduce((s, d) => s + d.sharePct, 0);
    assert.ok(Math.abs(totalShare - 100) < 1.5, `shares sum to ${totalShare}, not ~100`);
  });

  test('the person\'s own words are carried through to the explanation', () => {
    const { caseRecord, history } = fixture([
      ...STEADY.slice(0, 3),
      {
        daysAgo: 7,
        turns: say('nothing has moved on the case'),
        surfaceSentiment: 60,
        signals: [SIGNAL.PROCESS_FATIGUE],
        signalPhrases: ['nothing has moved'],
      },
    ]);
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.ok(latest.explanation.signalPhrases.includes('nothing has moved'));
  });

  test('a disengagement driver explains itself with the actual participation figures', () => {
    const { caseRecord, history } = fixture([
      ...STEADY,
      { daysAgo: 3, status: CHECK_IN_STATUS.MISSED },
      { daysAgo: 1, status: CHECK_IN_STATUS.MISSED },
    ]);
    const latest = assessLatest(caseRecord, history, { now: NOW });
    const driver = latest.explanation.drivers.find((d) => d.component === 'disengagement');
    assert.match(driver.detail, /2/, 'the detail should cite the missed check-ins it counted');
  });

  test('no explanation text uses clinical or diagnostic language', () => {
    // Content-safety rule: risk and support signals, never diagnoses.
    const clinical = /\b(depress\w*|ptsd|trauma\w*|anxiety disorder|diagnos\w*|psychiatric|mental illness|disorder)\b/i;
    const histories = [
      STEADY,
      [...STEADY, { daysAgo: 3, status: CHECK_IN_STATUS.MISSED }],
      [...STEADY.slice(0, 2), { daysAgo: 7, turns: say(FORTY_WORDS), surfaceSentiment: 85, signals: [SIGNAL.HOPELESSNESS, SIGNAL.DISENGAGEMENT] }],
    ];
    for (const raw of histories) {
      const { caseRecord, history } = fixture(raw);
      for (const a of assessCaseHistory(caseRecord, history, { now: NOW })) {
        const text = [
          a.explanation.headline,
          ...a.explanation.drivers.flatMap((d) => [d.label, d.detail]),
        ].join(' | ');
        assert.ok(!clinical.test(text), `clinical language in explanation: ${text}`);
      }
    }
  });

  test('the headline states the band without asserting a cause it cannot know', () => {
    const { caseRecord, history } = fixture(STEADY);
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.ok(latest.explanation.headline.length > 0);
    assert.ok(!/\bbecause of\b/i.test(latest.explanation.headline));
  });

  test('a carried-forward surface reading is disclosed, not presented as fresh', () => {
    const { caseRecord, history } = fixture([
      ...STEADY.slice(0, 3),
      { daysAgo: 7, status: CHECK_IN_STATUS.MISSED },
    ]);
    const latest = assessLatest(caseRecord, history, { now: NOW });
    const driver = latest.explanation.drivers.find((d) => d.component === 'sentiment');
    assert.match(driver.detail, /no reply|last known|previous/i);
  });
});

describe('assessCaseHistory — locale', () => {
  test('the pipeline is locale-agnostic: the same shape in Hindi scores the same', () => {
    // Engagement is counted in words and timings, which are language-independent.
    const en = fixture(STEADY);
    const hi = fixture(STEADY.map((c) => ({ ...c, locale: LOCALE.HI })));
    assert.equal(
      assessLatest(en.caseRecord, en.history, { now: NOW }).components.disengagement,
      assessLatest(hi.caseRecord, hi.history, { now: NOW }).components.disengagement,
    );
  });
});
