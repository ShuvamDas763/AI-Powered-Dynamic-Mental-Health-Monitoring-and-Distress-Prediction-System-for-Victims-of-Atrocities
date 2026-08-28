/**
 * Tests for the six seeded personas.
 *
 * Two jobs here, and they are different in kind.
 *
 * 1. SPEC CONFORMANCE. Spec Section 6 states what each persona must demonstrate.
 *    These tests assert those targets are met by running the seed through the real
 *    generic pipeline — no persona-specific code path, no expected values copied
 *    out of the seed file. If someone retunes a scoring weight and a persona stops
 *    behaving as Section 6 describes, the suite names which one.
 *
 * 2. CONTENT SAFETY. Spec Section 12 forbids graphic content, invented case
 *    reporting, clinical diagnostic language, and any external PII. Those are hard
 *    rules, so they are enforced by a scan over every string in the seed rather
 *    than by having read the file carefully once. A reviewer adding a seventh
 *    persona gets told immediately if their wording crosses a line.
 *
 * The genericity requirement gets its own test: the same history assessed under a
 * different identity must produce an identical score and an identical escalation
 * decision. That is what "the rule is generic, not special-cased for the one
 * persona that exposed the bug" means in practice.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  PERSONA_KEYS,
  PERSONA_TARGETS,
  buildPersonaCases,
  buildPersonaCase,
} from './personas.js';
import { assessCaseHistory, assessLatest } from '../domain/assessCase.js';
import { BAND } from '../domain/distressScore.js';
import { CHECK_IN_STATUS, SUSTAINED_MISMATCH_RUN } from '../domain/engagement.js';
import { makeCase, SPEAKER } from '../domain/records.js';

/** A fixed clock, so every assertion about a score is deterministic. */
const NOW = Date.parse('2026-08-26T09:00:00.000Z');

const cases = buildPersonaCases({ now: NOW });
const byKey = new Map(cases.map((c) => [c.caseRecord.key, c]));

/** Every string a human could ever read out of the seed. */
function allSeedText() {
  const strings = [];
  for (const { caseRecord, history } of cases) {
    strings.push(caseRecord.pseudonym, caseRecord.district, caseRecord.state,
      caseRecord.caseStage, caseRecord.contextNote);
    for (const checkIn of history) {
      for (const turn of checkIn.turns) strings.push(turn.text);
      strings.push(...checkIn.signalPhrases);
    }
  }
  return strings.filter((s) => typeof s === 'string' && s.length > 0);
}

/** Just the words the personas themselves said. */
function allPersonReplies() {
  return cases.flatMap(({ history }) =>
    history.flatMap((c) => c.turns.filter((t) => t.speaker === SPEAKER.PERSON).map((t) => t.text)));
}

describe('the persona set as a whole', () => {
  test('all six personas from spec Section 6 are present', () => {
    assert.deepEqual(PERSONA_KEYS, ['A', 'B', 'C', 'D', 'E', 'F']);
    assert.equal(cases.length, 6);
  });

  test('every persona has a target declared from the spec', () => {
    for (const key of PERSONA_KEYS) {
      assert.ok(PERSONA_TARGETS[key], `no spec target recorded for ${key}`);
      assert.ok(PERSONA_TARGETS[key].specTarget.length > 0);
    }
  });

  test('case ids are unique, so no two personas can be conflated', () => {
    const ids = cases.map((c) => c.caseRecord.caseId);
    assert.equal(new Set(ids).size, ids.length);
  });

  /**
   * The demo has to open with charts already populated — spec Section 4 asks for
   * pre-populated history so nothing has to be typed in live.
   */
  test('every persona carries enough history for a trend chart on first load', () => {
    for (const { caseRecord, history } of cases) {
      assert.ok(history.length >= 6, `${caseRecord.key} has only ${history.length} check-ins`);
    }
  });

  test('both demo languages are represented, and the Hindi is really Devanagari', () => {
    const locales = new Set(cases.flatMap(({ history }) => history.map((c) => c.locale)));
    assert.ok(locales.has('en'));
    assert.ok(locales.has('hi'));

    const hindiReplies = cases
      .flatMap(({ history }) => history.filter((c) => c.locale === 'hi'))
      .flatMap((c) => c.turns.filter((t) => t.speaker === SPEAKER.PERSON).map((t) => t.text));
    assert.ok(hindiReplies.length > 0, 'no Hindi replies in the seed at all');
    for (const reply of hindiReplies) {
      assert.match(reply, /[ऀ-ॿ]/, `a Hindi check-in is not in Devanagari: ${reply}`);
    }
  });

  test('the escalation split is a real mix, not everyone flagged or nobody flagged', () => {
    // A monitoring demo where every case is urgent teaches an official to ignore
    // the panel; one where none are shows nothing. Section 6 asks for both.
    const flagged = cases.filter(({ caseRecord, history }) =>
      assessLatest(caseRecord, history, { now: NOW }).escalation.triggered);
    assert.ok(flagged.length >= 2, 'no meaningful alert state to demonstrate');
    assert.ok(flagged.length <= 4, 'nearly everything is escalated, which is the alert-fatigue failure');
  });
});

describe('spec Section 6 targets, met through the generic pipeline', () => {
  for (const key of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const target = PERSONA_TARGETS[key];

    test(`${key} — ${target.specTarget}`, () => {
      const { caseRecord, history } = byKey.get(key);
      const latest = assessLatest(caseRecord, history, { now: NOW });

      assert.ok(
        target.bands.includes(latest.band),
        `${key} read as ${latest.band} (score ${latest.score}); spec expects ${target.bands.join(' or ')}`,
      );

      assert.equal(
        latest.escalation.triggered,
        target.escalates,
        `${key} escalated=${latest.escalation.triggered} at adjusted score ` +
        `${latest.escalation.priorityAdjustedScore}/${latest.escalation.threshold}; spec expects ${target.escalates}`,
      );

      if (target.expectTrigger) {
        const codes = latest.escalation.triggerReasons.map((r) => r.code);
        assert.ok(
          codes.includes(target.expectTrigger),
          `${key} escalated via [${codes.join(', ')}], but the spec target depends on ${target.expectTrigger}`,
        );
      }

      if (target.trendDirection) {
        assert.equal(
          latest.trend.direction,
          target.trendDirection,
          `${key} trend read as ${latest.trend.direction} (slope ${latest.trend.slope})`,
        );
      }

      for (const forbidden of target.forbiddenBands ?? []) {
        assert.notEqual(latest.band, forbidden, `${key} must never read as ${forbidden}`);
      }
    });
  }
});

describe('B — the case both models under-read', () => {
  const { caseRecord, history } = byKey.get('B');

  test('escalates on the named witness trigger, not on the analysis layer asking nicely', () => {
    const latest = assessLatest(caseRecord, history, { now: NOW });
    const codes = latest.escalation.triggerReasons.map((r) => r.code);
    assert.ok(codes.includes('intimidation_on_witness_case'));
    // The Phase 1 probe found both models leave this flag false on input of this
    // shape. The seed must not quietly set it and take credit for the catch.
    assert.ok(
      history.every((c) => c.immediateReviewRequested === false),
      'the seed is flattering the model by pre-setting immediateReviewRequested',
    );
    assert.ok(!codes.includes('immediate_review_requested'));
  });

  test('the witness docket tag is what raises the priority-adjusted score', () => {
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.ok(latest.escalation.priorityWeight > 1, 'witness weighting is not being applied');
    assert.ok(latest.escalation.priorityAdjustedScore >= latest.score);
  });
});

describe('E — the finding that only exists across time', () => {
  const { caseRecord, history } = byKey.get('E');

  test('reads low at the start of the record and elevated by the end', () => {
    const series = assessCaseHistory(caseRecord, history, { now: NOW });
    assert.equal(series.length, history.length, 'one assessment per check-in');
    assert.ok(
      [BAND.LOW, BAND.MODERATE].includes(series[0].band),
      `the first check-in already read as ${series[0].band}, so there is no trajectory to find`,
    );
    assert.ok([BAND.ELEVATED, BAND.HIGH].includes(series.at(-1).band));
  });

  test('the climb is monotone enough to read as a trend rather than noise', () => {
    const scores = assessCaseHistory(caseRecord, history, { now: NOW }).map((a) => a.score);
    const rises = scores.slice(1).filter((s, i) => s > scores[i]).length;
    assert.ok(rises >= scores.length - 3, `only ${rises} of ${scores.length - 1} steps rise`);
    assert.ok(scores.at(-1) - scores[0] >= 30, 'the series barely moves across a year of history');
  });

  test('no single check-in in isolation reads as high', () => {
    // The point of this persona: read any one message and it is unremarkable.
    // Assessing each check-in with no history behind it should stay below the
    // escalation threshold, so the finding is genuinely the trajectory's.
    for (const checkIn of history) {
      if (checkIn.status === CHECK_IN_STATUS.MISSED) continue;
      const alone = assessLatest(caseRecord, [checkIn], { now: NOW });
      assert.ok(
        !alone.escalation.triggered,
        `check-in ${checkIn.sequence} escalates on its own, so the trend is not doing the work`,
      );
    }
  });
});

describe('F — the deflection edge case', () => {
  const { caseRecord, history } = byKey.get('F');

  test('the words read as untroubled while the reading does not', () => {
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.ok(
      latest.components.sentiment <= 35,
      `surface reading is ${latest.components.sentiment}; this persona only tests anything if the words sound fine`,
    );
    assert.notEqual(latest.band, BAND.LOW, 'the system took the reassurance at face value');
    assert.ok(latest.escalation.triggered);
  });

  test('the collapse in participation is real text, not a declared number', () => {
    // wordCount is derived by the record factory, so this asserts the seed
    // actually contains a paragraph early and a single word late.
    const answered = history.filter((c) => c.status === CHECK_IN_STATUS.COMPLETED);
    assert.ok(answered[0].wordCount >= 30, 'no full-length baseline reply to fall away from');
    assert.ok(answered.at(-1).wordCount <= 3, 'replies never actually collapse');
  });

  test('the mismatch is a sustained run, not one odd message', () => {
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.ok(
      latest.mismatch.run >= SUSTAINED_MISMATCH_RUN,
      `mismatch run is only ${latest.mismatch.run}; Phase 8 needs a trend here, not a single message`,
    );
    assert.ok(latest.mismatch.sustained);
  });

  test('at least one check-in went unanswered, so silence is part of the pattern', () => {
    assert.ok(history.some((c) => c.status === CHECK_IN_STATUS.MISSED));
  });

  test('the pattern is invisible early and visible late', () => {
    const series = assessCaseHistory(caseRecord, history, { now: NOW });
    assert.equal(series[0].escalation.triggered, false, 'flagged on the very first cheerful reply');
    assert.equal(series.at(-1).escalation.triggered, true);
  });
});

describe('C — the case that must not be over-flagged', () => {
  const { caseRecord, history } = byKey.get('C');

  test('never escalates at any point in its history', () => {
    const series = assessCaseHistory(caseRecord, history, { now: NOW });
    for (const a of series) {
      assert.equal(a.escalation.triggered, false, `escalated at check-in ${a.checkInId}`);
    }
  });

  test('reads as untroubled without being mistaken for the deflection pattern', () => {
    // C's later replies score as low-concern exactly like F's do. What separates
    // them is participation, so this asserts the detector uses that and not the
    // surface reading alone.
    const latest = assessLatest(caseRecord, history, { now: NOW });
    assert.ok(latest.components.sentiment <= 35);
    assert.equal(latest.mismatch.sustained, false);
    assert.equal(latest.band, BAND.LOW);
  });

  test('answers every check-in at a consistent length', () => {
    assert.ok(history.every((c) => c.status === CHECK_IN_STATUS.COMPLETED));
    const words = history.map((c) => c.wordCount);
    assert.ok(Math.min(...words) / Math.max(...words) > 0.5, 'engagement is not actually steady');
  });
});

describe('the rule is generic, not special-cased per persona', () => {
  /**
   * The load-bearing genericity test.
   *
   * Reassessing the same history under a fabricated identity — different key, id,
   * pseudonym, district, note — must produce the same score and the same
   * escalation decision. Only the docket's own priority tags may matter, because
   * those describe the matter rather than the person.
   */
  test('identity has no effect on the score or the escalation decision', () => {
    for (const { caseRecord, history } of cases) {
      const real = assessLatest(caseRecord, history, { now: NOW });
      const disguised = assessLatest(makeCase({
        key: 'Z',
        caseId: 'SIH-CASE-9999',
        pseudonym: 'Complainant Z',
        district: 'Demo District 4',
        state: 'Demo State 2',
        caseStage: 'investigation',
        monthsSinceRegistration: 1,
        priorityTags: caseRecord.priorityTags,
        contextNote: 'unrelated note',
      }), history, { now: NOW });

      assert.equal(disguised.score, real.score, `${caseRecord.key} scores differently under another identity`);
      assert.equal(disguised.band, real.band);
      assert.equal(disguised.escalation.triggered, real.escalation.triggered);
      assert.deepEqual(
        disguised.escalation.triggerReasons.map((r) => r.code),
        real.escalation.triggerReasons.map((r) => r.code),
      );
    }
  });

  test('every persona is scored by the same function with a full explanation', () => {
    for (const { caseRecord, history } of cases) {
      const latest = assessLatest(caseRecord, history, { now: NOW });
      assert.ok(latest.explanation.headline.length > 0, `${caseRecord.key} has no headline`);
      assert.equal(latest.explanation.drivers.length, 4, `${caseRecord.key} is missing a component driver`);
      for (const driver of latest.explanation.drivers) {
        assert.ok(driver.detail.length > 0, `${caseRecord.key}: ${driver.component} has no explanation text`);
      }
    }
  });

  test('the explanation adds up to the score it explains', () => {
    for (const { caseRecord, history } of cases) {
      const latest = assessLatest(caseRecord, history, { now: NOW });
      const summed = latest.explanation.drivers.reduce((a, d) => a + d.contribution, 0);
      assert.ok(
        Math.abs(summed - latest.score) < 1.5,
        `${caseRecord.key}: drivers sum to ${summed} but the score shown is ${latest.score}`,
      );
    }
  });
});

describe('seed integrity', () => {
  test('scores are reproducible across builds with the same clock', () => {
    const a = buildPersonaCases({ now: NOW }).map(({ caseRecord, history }) =>
      assessLatest(caseRecord, history, { now: NOW }).score);
    const b = buildPersonaCases({ now: NOW }).map(({ caseRecord, history }) =>
      assessLatest(caseRecord, history, { now: NOW }).score);
    assert.deepEqual(a, b);
  });

  test('the history is relative, so a demo six months from now still reads the same', () => {
    const later = Date.parse('2027-03-14T09:00:00.000Z');
    for (const key of PERSONA_KEYS) {
      const nowScore = assessLatest(byKey.get(key).caseRecord, byKey.get(key).history, { now: NOW }).score;
      const shifted = buildPersonaCase(key, { now: later });
      const laterScore = assessLatest(shifted.caseRecord, shifted.history, { now: later }).score;
      assert.equal(laterScore, nowScore, `${key} scores differently when the demo runs on a later date`);
      assert.ok(Date.parse(shifted.history.at(-1).occurredAt) > NOW, `${key}'s latest check-in is stale`);
    }
  });

  test('every seeded reading is marked as demonstration data, never as live model output', () => {
    for (const { caseRecord, history } of cases) {
      const latest = assessLatest(caseRecord, history, { now: NOW });
      assert.equal(latest.provenance.source, 'seed', `${caseRecord.key} claims a non-seed provenance`);
    }
  });

  test('history is chronological for every persona', () => {
    for (const { caseRecord, history } of cases) {
      for (let i = 1; i < history.length; i++) {
        assert.ok(
          Date.parse(history[i].occurredAt) > Date.parse(history[i - 1].occurredAt),
          `${caseRecord.key} history is out of order at index ${i}`,
        );
      }
    }
  });
});

/**
 * CONTENT SAFETY — spec Section 12, treated as hard rules.
 *
 * These scan the seed rather than trusting that it was written carefully. The
 * point is that the next person to add a persona finds out immediately.
 */
describe('content safety', () => {
  /**
   * Language that would describe an act rather than a situation.
   *
   * Written as specific word forms rather than loose stems on purpose: an earlier
   * throwaway version of this check used /stabb?\w*​/ and flagged the word
   * "stability", which is the kind of false positive that gets a safety test
   * disabled instead of fixed.
   */
  const GRAPHIC = [
    /\bassault(ed|ing|s)?\b/i, /\brap(e|ed|ing)\b/i, /\bstab(bed|bing|s)\b/i,
    /\bbeat(en|ing)?\b/i, /\bkill(ed|ing|s)?\b/i, /\bmurder(ed|ing|s)?\b/i,
    /\bblood(y|ied)?\b/i, /\bbleed(ing)?\b/i, /\bwound(ed|s)?\b/i,
    /\binjur(y|ies|ed)\b/i, /\bburn(ed|t|ing)\b/i, /\bstrangl\w*/i,
    /\bmutilat\w*/i, /\bcorpse\b/i, /\bweapon(s)?\b/i, /\bknife\b/i,
    /\bdragged\b/i, /\bmolest\w*/i, /\bहत्या\b/, /\bखून\b/, /\bमारपीट\b/,
  ];

  /**
   * Clinical framing. The system reports support signals, not conditions — it has
   * no validation data and no clinician in the loop, so naming a condition would
   * be a claim it cannot back. Spec Section 8.
   */
  const DIAGNOSTIC = [
    /\bdepress\w*/i, /\bptsd\b/i, /\btrauma(tis|tiz)\w*/i, /\banxiety\b/i,
    /\bdiagnos\w*/i, /\bpsychiatric\b/i, /\bmental illness\b/i, /\bdisorder(s)?\b/i,
    /\bsuicid\w*/i, /\bself[- ]harm\b/i, /\bsymptom(s)?\b/i, /\bpatient(s)?\b/i,
    /\bpatholog\w*/i, /\btherapy\b/i, /\bclinical\w*/i,
  ];

  /** Anything shaped like a real-world identifier. */
  const PII = [
    /\b\d{10,}\b/,                       // phone or Aadhaar-length digit runs
    /\b\d{4}\s?\d{4}\s?\d{4}\b/,         // spaced Aadhaar shape
    /[\w.+-]+@[\w-]+\.\w+/,              // email
    /\bhttps?:\/\//i,                    // external link
  ];

  test('no seed text describes an act of violence', () => {
    for (const text of allSeedText()) {
      for (const pattern of GRAPHIC) {
        assert.ok(!pattern.test(text), `graphic language matching ${pattern} in seed text: "${text}"`);
      }
    }
  });

  test('no seed text uses clinical or diagnostic language', () => {
    for (const text of allSeedText()) {
      for (const pattern of DIAGNOSTIC) {
        assert.ok(!pattern.test(text), `diagnostic language matching ${pattern} in seed text: "${text}"`);
      }
    }
  });

  test('no seed text contains anything shaped like real personal data', () => {
    for (const text of allSeedText()) {
      for (const pattern of PII) {
        assert.ok(!pattern.test(text), `possible PII matching ${pattern} in seed text: "${text}"`);
      }
    }
  });

  test('identities are pseudonyms and geography is placeholder-only', () => {
    for (const { caseRecord } of cases) {
      assert.match(caseRecord.pseudonym, /^Complainant [A-F]$/, `${caseRecord.key} has a non-pseudonymous label`);
      assert.match(caseRecord.district, /^Demo District \d+$/, `${caseRecord.key} names a real-looking district`);
      assert.match(caseRecord.state, /^Demo State \d+$/, `${caseRecord.key} names a real-looking state`);
      assert.match(caseRecord.caseId, /^SIH-CASE-\d{4}$/);
    }
  });

  /**
   * A proper-noun guard on the personas' own words.
   *
   * Mid-sentence capitalised tokens are where an invented name of a person, place,
   * police station or court would show up. The allow-list is deliberately tiny and
   * is meant to be extended by hand with a moment's thought, not widened to make a
   * failure go away.
   */
  test('no persona reply names a person, place or institution', () => {
    const ALLOWED = new Set(['I', 'Sundays']);
    for (const reply of allPersonReplies()) {
      // Drop the first word of each sentence, then look for what is left capitalised.
      const midSentence = reply
        .split(/(?:^|[.!?]\s+)\S+/).join(' ')
        .match(/\b[A-Z][a-z]+\b/g) ?? [];
      for (const token of midSentence) {
        assert.ok(ALLOWED.has(token), `possible proper noun "${token}" in a persona reply: "${reply}"`);
      }
    }
  });

  test('third parties are referred to by relationship, never given a name', () => {
    // Positive check on the convention the guard above enforces negatively.
    const joined = allPersonReplies().join(' ');
    assert.match(joined, /\bmy (brother|daughter)\b/, 'expected relational references in the seed');
  });

  test('no explanation generated for any persona uses diagnostic language', () => {
    for (const { caseRecord, history } of cases) {
      for (const a of assessCaseHistory(caseRecord, history, { now: NOW })) {
        const text = [a.explanation.headline, ...a.explanation.drivers.map((d) => `${d.label} ${d.detail}`),
          ...a.escalation.triggerReasons.map((r) => r.label)].join(' ');
        for (const pattern of DIAGNOSTIC) {
          assert.ok(!pattern.test(text), `${caseRecord.key}: explanation matched ${pattern}: "${text}"`);
        }
      }
    }
  });

  test('no explanation claims an accuracy figure or a prediction it cannot support', () => {
    const OVERCLAIM = [/\baccura\w*/i, /\bpredict\w*/i, /\bconfiden\w*/i, /\b\d+(\.\d+)?%\s*(accurate|reliable)/i];
    for (const { caseRecord, history } of cases) {
      const a = assessLatest(caseRecord, history, { now: NOW });
      const text = [a.explanation.headline, ...a.explanation.drivers.map((d) => d.detail)].join(' ');
      for (const pattern of OVERCLAIM) {
        assert.ok(!pattern.test(text), `${caseRecord.key}: explanation overclaims via ${pattern}: "${text}"`);
      }
    }
  });
});
