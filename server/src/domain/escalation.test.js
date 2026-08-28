/**
 * Tests for the deterministic escalation rule.
 *
 * THIS IS THE MOST IMPORTANT TEST FILE IN THE DATA LAYER.
 *
 * A Phase 1 probe against both available Groq models found that neither
 * escalated a witness-intimidation check-in: gpt-oss-120b returned 55/100 with
 * requires_immediate_human_review=false, qwen3.8 returned 45/100, likewise
 * false. Spec Section 6 targets that persona as high/urgent. So escalation is
 * NOT the LLM's decision. The LLM extracts signals; this rule decides.
 *
 * The rule must be GENERIC — a function of (score, tags, signals, history) and
 * nothing else. The genericity tests at the bottom of this file exist to stop
 * anyone "fixing" a persona by special-casing it.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRIORITY_USE_CASE } from './priorityWeighting.js';
import {
  ESCALATION_THRESHOLD,
  TRIGGER,
  SIGNAL,
  evaluateEscalation,
} from './escalation.js';

/** Minimal, unremarkable input. Each test varies only what it is about. */
function input(overrides = {}) {
  return {
    distressScore: 30,
    priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY],
    signals: [],
    mismatchRun: 0,
    llmImmediateReview: false,
    ...overrides,
  };
}

describe('evaluateEscalation — scoring arithmetic', () => {
  test('applies the priority weight to the base score', () => {
    const r = evaluateEscalation(input({
      distressScore: 50,
      priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION],
    }));
    assert.equal(r.baseScore, 50);
    assert.ok(r.priorityWeight > 1);
    assert.equal(r.priorityAdjustedScore, Math.round(50 * r.priorityWeight));
  });

  test('the adjusted score is capped at 100', () => {
    const r = evaluateEscalation(input({
      distressScore: 95,
      priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION],
    }));
    assert.ok(r.priorityAdjustedScore <= 100);
  });

  test('reports the threshold it compared against, so the UI can explain it', () => {
    const r = evaluateEscalation(input());
    assert.equal(r.threshold, ESCALATION_THRESHOLD);
  });
});

describe('evaluateEscalation — the Phase 1 regression', () => {
  /**
   * THE REGRESSION TEST FOR THE PROBE FINDING.
   *
   * Both models scored this shape of case in the 45-55 range and declined to
   * escalate. Priority weighting must carry it over the line without the LLM
   * having to get it right.
   */
  test('a witness-intimidation case the LLM scored only 55 still escalates', () => {
    const r = evaluateEscalation(input({
      distressScore: 55,
      priorityTags: [
        PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY,
        PRIORITY_USE_CASE.WITNESS_INTIMIDATION,
      ],
      signals: [SIGNAL.INTIMIDATION],
      llmImmediateReview: false, // the model said no — the rule overrides it
    }));
    assert.ok(r.triggered, 'must escalate despite the model declining to');
    assert.ok(r.triggerReasons.length > 0);
  });

  test('the same score without the witness tag does not escalate', () => {
    // Proves the escalation came from the weighting rule, not from a raised
    // global threshold that would over-flag everyone.
    const r = evaluateEscalation(input({ distressScore: 55, signals: [] }));
    assert.equal(r.triggered, false);
  });
});

describe('evaluateEscalation — hard triggers', () => {
  test('an explicit model request for immediate review always escalates', () => {
    const r = evaluateEscalation(input({ distressScore: 0, llmImmediateReview: true }));
    assert.ok(r.triggered);
    assert.ok(r.triggerReasons.some((t) => t.code === TRIGGER.IMMEDIATE_REVIEW_REQUESTED));
  });

  test('an intimidation signal on a witness case escalates regardless of score', () => {
    const r = evaluateEscalation(input({
      distressScore: 5,
      priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION],
      signals: [SIGNAL.INTIMIDATION],
    }));
    assert.ok(r.triggered);
    assert.ok(r.triggerReasons.some((t) => t.code === TRIGGER.INTIMIDATION_ON_WITNESS_CASE));
  });

  /** THE PERSONA F TRIGGER. */
  test('a sustained surface/underlying mismatch escalates on its own', () => {
    const r = evaluateEscalation(input({ distressScore: 25, mismatchRun: 3 }));
    assert.ok(r.triggered, 'repeated "I am fine" with collapsing engagement must escalate');
    assert.ok(r.triggerReasons.some((t) => t.code === TRIGGER.SUSTAINED_SURFACE_MISMATCH));
  });

  test('a brief mismatch does not trigger — a pattern needs to be a pattern', () => {
    const r = evaluateEscalation(input({ distressScore: 25, mismatchRun: 1 }));
    assert.equal(r.triggered, false);
  });

  test('hopelessness plus disengagement escalates', () => {
    const r = evaluateEscalation(input({
      distressScore: 40,
      signals: [SIGNAL.HOPELESSNESS, SIGNAL.DISENGAGEMENT],
    }));
    assert.ok(r.triggered);
    assert.ok(r.triggerReasons.some((t) => t.code === TRIGGER.HOPELESSNESS_WITH_DISENGAGEMENT));
  });

  test('hopelessness alone at a low score does not hard-trigger', () => {
    const r = evaluateEscalation(input({ distressScore: 20, signals: [SIGNAL.HOPELESSNESS] }));
    assert.equal(r.triggered, false);
  });
});

describe('evaluateEscalation — must not over-flag', () => {
  test('a stable, recovering, engaged case does not escalate', () => {
    // Persona C's shape. Over-flagging someone who is doing better wastes scarce
    // counsellor attention and teaches officials to ignore the alert panel.
    const r = evaluateEscalation(input({ distressScore: 20 }));
    assert.equal(r.triggered, false);
    assert.equal(r.triggerReasons.length, 0);
  });

  test('a moderate case with no hard trigger stays unescalated', () => {
    // Persona D's shape: real need, but support-tier rather than crisis-tier.
    const r = evaluateEscalation(input({
      distressScore: 45,
      priorityTags: [PRIORITY_USE_CASE.CASTE_VIOLENCE_FAMILY],
    }));
    assert.equal(r.triggered, false);
  });
});

describe('evaluateEscalation — safety properties', () => {
  /** Raising distress must never remove an escalation. */
  test('escalation is monotonic in the distress score', () => {
    for (const tags of Object.values(PRIORITY_USE_CASE).map((t) => [t])) {
      let escalatedAt = null;
      for (let s = 0; s <= 100; s += 5) {
        const { triggered } = evaluateEscalation(input({ distressScore: s, priorityTags: tags }));
        if (triggered && escalatedAt === null) escalatedAt = s;
        if (escalatedAt !== null) {
          assert.ok(triggered, `score ${s} de-escalated a case that escalated at ${escalatedAt}`);
        }
      }
    }
  });

  /** Adding a priority tag must never remove an escalation. */
  test('adding a priority tag never de-escalates', () => {
    for (let s = 0; s <= 100; s += 5) {
      const baseline = evaluateEscalation(input({ distressScore: s }));
      for (const tag of Object.values(PRIORITY_USE_CASE)) {
        const tagged = evaluateEscalation(input({
          distressScore: s,
          priorityTags: [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY, tag],
        }));
        assert.ok(
          tagged.priorityAdjustedScore >= baseline.priorityAdjustedScore,
          `adding ${tag} lowered the adjusted score at ${s}`,
        );
        if (baseline.triggered) assert.ok(tagged.triggered, `adding ${tag} de-escalated at ${s}`);
      }
    }
  });

  test('adding a signal never de-escalates', () => {
    for (const signal of Object.values(SIGNAL)) {
      const without = evaluateEscalation(input({ distressScore: 60 }));
      const with_ = evaluateEscalation(input({ distressScore: 60, signals: [signal] }));
      if (without.triggered) assert.ok(with_.triggered, `adding ${signal} de-escalated`);
    }
  });

  test('every trigger reason carries a plain-language label for the counsellor', () => {
    const r = evaluateEscalation(input({
      distressScore: 90,
      priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION],
      signals: [SIGNAL.INTIMIDATION, SIGNAL.HOPELESSNESS, SIGNAL.DISENGAGEMENT],
      mismatchRun: 4,
      llmImmediateReview: true,
    }));
    assert.ok(r.triggerReasons.length >= 4, 'expected several triggers to fire together');
    const clinical = /\b(depress\w*|ptsd|anxiety disorder|diagnos\w*|psychiatric)\b/i;
    for (const reason of r.triggerReasons) {
      assert.ok(reason.code, 'reason needs a stable code');
      assert.ok(reason.label && reason.label.length > 0, `${reason.code} has no label`);
      assert.ok(!clinical.test(reason.label), `${reason.code} label is clinical: ${reason.label}`);
    }
  });

  test('malformed input degrades safely instead of throwing', () => {
    for (const bad of [undefined, {}, { distressScore: null }, { priorityTags: 'witness' }, { signals: null }]) {
      const r = evaluateEscalation(bad);
      assert.equal(typeof r.triggered, 'boolean');
      assert.ok(Number.isFinite(r.priorityAdjustedScore));
    }
  });
});

describe('evaluateEscalation — genericity (no persona special-casing)', () => {
  /**
   * The user requirement this file exists to guarantee: the rule is generic
   * (score x use-case weighting + signal triggers), not something tuned for the
   * one persona that exposed the bug.
   */
  test('the rule never reads a case identifier', () => {
    const shared = {
      distressScore: 55,
      priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION],
      signals: [SIGNAL.INTIMIDATION],
    };
    const asB = evaluateEscalation({ ...input(shared), caseId: 'SIH-CASE-0002', personaKey: 'B' });
    const asC = evaluateEscalation({ ...input(shared), caseId: 'SIH-CASE-0003', personaKey: 'C' });
    const anonymous = evaluateEscalation(input(shared));
    assert.deepEqual(asB, anonymous, 'identity changed the outcome');
    assert.deepEqual(asC, anonymous, 'identity changed the outcome');
  });

  test('the escalation module source contains no persona or case identifiers', () => {
    // A static check, because a runtime test can only cover the inputs it thinks
    // to try. If someone adds `if (personaKey === 'B')`, this fails immediately.
    const source = readFileSync(new URL('./escalation.js', import.meta.url), 'utf8');
    const forbidden = [
      /persona/i,
      /\bSIH-CASE\b/i,
      /caseId/,
      /pseudonym/i,
      /\bComplainant [A-F]\b/,
    ];
    for (const pattern of forbidden) {
      assert.ok(
        !pattern.test(source),
        `escalation.js references ${pattern} — the rule must not know about specific cases`,
      );
    }
  });

  test('identical inputs always produce identical decisions', () => {
    const i = input({ distressScore: 62, signals: [SIGNAL.DISENGAGEMENT], mismatchRun: 2 });
    assert.deepEqual(evaluateEscalation(i), evaluateEscalation(i));
  });
});
