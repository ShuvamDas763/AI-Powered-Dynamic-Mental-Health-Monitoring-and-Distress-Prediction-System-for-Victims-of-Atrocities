/**
 * Tests for priority use-case weighting.
 *
 * The weighting table is what turns a mediocre LLM score into a correct
 * escalation decision. A Phase 1 probe found that BOTH available models scored
 * a witness-intimidation check-in at only 45-55/100 with no escalation, when
 * spec Section 6 targets that persona as high/urgent. The weighting below is
 * the deterministic correction for that class of miss.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRIORITY_USE_CASE,
  PRIORITY_WEIGHTS,
  priorityWeightForTags,
  describePriorityWeight,
} from './priorityWeighting.js';

describe('priorityWeightForTags', () => {
  test('a case with only the baseline tag is not amplified', () => {
    assert.equal(priorityWeightForTags([PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY]), 1);
  });

  test('witness intimidation carries the highest weight in the table', () => {
    const witness = priorityWeightForTags([PRIORITY_USE_CASE.WITNESS_INTIMIDATION]);
    const others = Object.values(PRIORITY_USE_CASE)
      .filter((t) => t !== PRIORITY_USE_CASE.WITNESS_INTIMIDATION)
      .map((t) => priorityWeightForTags([t]));
    for (const w of others) assert.ok(witness >= w, 'witness intimidation should rank at least as high');
  });

  test('multiple tags take the highest weight, not the sum', () => {
    const tags = [
      PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY,
      PRIORITY_USE_CASE.WITNESS_INTIMIDATION,
      PRIORITY_USE_CASE.CASTE_VIOLENCE_FAMILY,
    ];
    const expected = Math.max(
      PRIORITY_WEIGHTS[PRIORITY_USE_CASE.WITNESS_INTIMIDATION],
      PRIORITY_WEIGHTS[PRIORITY_USE_CASE.CASTE_VIOLENCE_FAMILY],
      PRIORITY_WEIGHTS[PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY],
    );
    assert.equal(priorityWeightForTags(tags), expected);
    // Summing would compound to >3x and make every multi-tag case a crisis.
    assert.ok(priorityWeightForTags(tags) < 2);
  });

  /**
   * SAFETY PROPERTY: weighting may only ever raise urgency. If any weight were
   * below 1, adding a priority tag could de-escalate a case — the exact wrong
   * direction for this population.
   */
  test('no weight in the table is below 1', () => {
    for (const [tag, weight] of Object.entries(PRIORITY_WEIGHTS)) {
      assert.ok(weight >= 1, `${tag} has weight ${weight}, which would de-escalate`);
    }
  });

  test('every declared use-case tag has a weight', () => {
    for (const tag of Object.values(PRIORITY_USE_CASE)) {
      assert.equal(typeof PRIORITY_WEIGHTS[tag], 'number', `no weight declared for ${tag}`);
    }
  });

  test('unknown, empty and missing tags degrade to the baseline instead of throwing', () => {
    assert.equal(priorityWeightForTags(['not_a_real_tag']), 1);
    assert.equal(priorityWeightForTags([]), 1);
    assert.equal(priorityWeightForTags(undefined), 1);
    assert.equal(priorityWeightForTags(null), 1);
  });

  test('an unknown tag alongside a known one does not mask the known one', () => {
    const w = priorityWeightForTags(['not_a_real_tag', PRIORITY_USE_CASE.WITNESS_INTIMIDATION]);
    assert.equal(w, PRIORITY_WEIGHTS[PRIORITY_USE_CASE.WITNESS_INTIMIDATION]);
  });
});

describe('describePriorityWeight', () => {
  test('names the tag that drove the weight, for the explainability panel', () => {
    const d = describePriorityWeight([
      PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY,
      PRIORITY_USE_CASE.WITNESS_INTIMIDATION,
    ]);
    assert.equal(d.drivingTag, PRIORITY_USE_CASE.WITNESS_INTIMIDATION);
    assert.equal(d.weight, PRIORITY_WEIGHTS[PRIORITY_USE_CASE.WITNESS_INTIMIDATION]);
    assert.ok(d.label.length > 0, 'needs a human-readable label to show a counsellor');
  });

  test('every label is plain administrative language, never graphic', () => {
    // Content-safety rule: use-case labels classify a docket category. They must
    // not describe an act. Guards against someone "improving" a label later.
    const graphic = /\b(raped?|beaten|stabb(ed|ing)|blood|mutilat\w*|strangl\w*)\b/i;
    for (const tag of Object.values(PRIORITY_USE_CASE)) {
      const { label } = describePriorityWeight([tag]);
      assert.ok(!graphic.test(label), `label for ${tag} contains graphic wording: ${label}`);
    }
  });
});
