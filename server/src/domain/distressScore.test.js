/**
 * Tests for the composite distress score.
 *
 * The score is a weighted blend of four components, three of which are computed
 * in plain code. Only the sentiment component comes from the LLM. That split is
 * deliberate: it means a check-in can still be scored correctly when the API is
 * unavailable, and it means no single upbeat sentence can dominate the result.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BAND,
  COMPONENT_WEIGHTS,
  compositeDistressScore,
  bandForScore,
} from './distressScore.js';

/** All-zero components, so each test varies only what it is about. */
const CALM = { sentiment: 10, disengagement: 5, trendDelta: 0, flaggedPatternBoost: 0 };

describe('compositeDistressScore', () => {
  test('a calm, engaged, stable case lands in the low band', () => {
    const r = compositeDistressScore(CALM);
    assert.ok(r.score <= 30, `expected low, got ${r.score}`);
    assert.equal(r.band, BAND.LOW);
  });

  test('high everything lands in the high band', () => {
    const r = compositeDistressScore({
      sentiment: 90, disengagement: 85, trendDelta: 30, flaggedPatternBoost: 10,
    });
    assert.ok(r.score >= 75, `expected high, got ${r.score}`);
    assert.equal(r.band, BAND.HIGH);
  });

  test('score is always an integer within 0-100, however extreme the input', () => {
    const cases = [
      { sentiment: 200, disengagement: 200, trendDelta: 200, flaggedPatternBoost: 200 },
      { sentiment: -50, disengagement: -50, trendDelta: -50, flaggedPatternBoost: -50 },
      { sentiment: 0, disengagement: 0, trendDelta: 0, flaggedPatternBoost: 0 },
    ];
    for (const c of cases) {
      const { score } = compositeDistressScore(c);
      assert.ok(Number.isInteger(score), `${score} is not an integer`);
      assert.ok(score >= 0 && score <= 100, `${score} out of range`);
    }
  });

  /**
   * THE PERSONA F PROPERTY.
   *
   * A surface-positive message (low sentiment reading) paired with collapsed
   * engagement must not be scored as a low-risk case. If sentiment were weighted
   * so heavily that disengagement could not move the result, the system would
   * over-trust "I'm totally fine".
   */
  test('collapsed engagement lifts a surface-positive case out of the low band', () => {
    const surfaceOnly = compositeDistressScore({ ...CALM, sentiment: 20, disengagement: 5 });
    const surfacePlusDisengaged = compositeDistressScore({ ...CALM, sentiment: 20, disengagement: 90 });
    assert.ok(
      surfacePlusDisengaged.score > surfaceOnly.score + 15,
      'disengagement must move the score meaningfully',
    );
    assert.notEqual(surfacePlusDisengaged.band, BAND.LOW, 'must not read as low-risk');
  });

  test('each component can move the score on its own', () => {
    const base = compositeDistressScore(CALM).score;
    for (const key of ['sentiment', 'disengagement', 'trendDelta', 'flaggedPatternBoost']) {
      const bumped = compositeDistressScore({ ...CALM, [key]: CALM[key] + 40 }).score;
      assert.ok(bumped > base, `${key} has no effect on the score`);
    }
  });

  /** MONOTONICITY: nothing that indicates more distress may lower the score. */
  test('raising any single component never lowers the score', () => {
    for (const key of ['sentiment', 'disengagement', 'trendDelta', 'flaggedPatternBoost']) {
      let previous = -1;
      for (const v of [0, 10, 25, 50, 75, 100]) {
        const { score } = compositeDistressScore({ ...CALM, [key]: v });
        assert.ok(score >= previous, `raising ${key} to ${v} lowered the score`);
        previous = score;
      }
    }
  });

  test('the components that produced a score are returned for the explanation panel', () => {
    const r = compositeDistressScore({
      sentiment: 60, disengagement: 40, trendDelta: 10, flaggedPatternBoost: 5,
    });
    assert.equal(r.components.sentiment, 60);
    assert.equal(r.components.disengagement, 40);
    assert.ok(r.contributions, 'needs per-component contribution values to explain the score');
    for (const key of Object.keys(COMPONENT_WEIGHTS)) {
      assert.ok(Number.isFinite(r.contributions[key]), `no contribution reported for ${key}`);
    }
  });

  test('the blend weights sum to 1 so the score keeps a 0-100 meaning', () => {
    const sum = Object.values(COMPONENT_WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `weights sum to ${sum}, not 1`);
  });

  test('sentiment is weighted highest but under half, so it cannot dominate alone', () => {
    const entries = Object.entries(COMPONENT_WEIGHTS).sort((a, b) => b[1] - a[1]);
    assert.equal(entries[0][0], 'sentiment', 'sentiment should be the largest single component');
    assert.ok(
      COMPONENT_WEIGHTS.sentiment < 0.5,
      'if sentiment exceeded half, one upbeat message could outvote all behavioural evidence',
    );
  });

  test('missing or malformed components degrade to 0 rather than producing NaN', () => {
    for (const input of [{}, undefined, { sentiment: null }, { sentiment: 'high' }]) {
      const { score } = compositeDistressScore(input);
      assert.ok(Number.isFinite(score), `input ${JSON.stringify(input)} produced ${score}`);
    }
  });

  test('is deterministic', () => {
    const input = { sentiment: 55, disengagement: 33, trendDelta: 12, flaggedPatternBoost: 3 };
    assert.deepEqual(compositeDistressScore(input), compositeDistressScore(input));
  });
});

describe('bandForScore', () => {
  test('bands are ordered and cover the whole 0-100 range with no gaps', () => {
    let seen = null;
    const order = [BAND.LOW, BAND.MODERATE, BAND.ELEVATED, BAND.HIGH];
    for (let s = 0; s <= 100; s++) {
      const band = bandForScore(s);
      assert.ok(order.includes(band), `score ${s} produced unknown band ${band}`);
      if (seen !== null) {
        assert.ok(
          order.indexOf(band) >= order.indexOf(seen),
          `band went backwards at score ${s}`,
        );
      }
      seen = band;
    }
  });

  test('0 is low and 100 is high', () => {
    assert.equal(bandForScore(0), BAND.LOW);
    assert.equal(bandForScore(100), BAND.HIGH);
  });

  test('band names carry no clinical or diagnostic language', () => {
    // Content-safety rule: these are support/risk levels, never diagnoses.
    const clinical = /\b(depress\w*|ptsd|anxiety|disorder|diagnos\w*|psychiatric|acute|chronic)\b/i;
    for (const band of Object.values(BAND)) {
      assert.ok(!clinical.test(band), `band "${band}" reads as clinical language`);
    }
  });
});
