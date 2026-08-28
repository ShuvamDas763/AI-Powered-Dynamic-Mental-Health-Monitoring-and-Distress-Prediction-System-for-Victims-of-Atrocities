/**
 * Tests for deterministic engagement + longitudinal trend metrics.
 *
 * WHY THESE ARE NOT LLM-DERIVED
 * -----------------------------
 * Engagement is a fact about the record, not a judgement about text: how many
 * check-ins were missed, whether replies are getting shorter, whether the
 * person is taking longer to respond. Computing it in plain code makes it
 * reproducible, free, offline-safe, and — most importantly — immune to a
 * surface-positive reply talking the score down.
 *
 * This is the machinery that catches Persona F (spec Section 6): repeated
 * "I'm totally fine" paired with collapsing engagement.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  engagementMetrics,
  sentimentTrend,
  surfaceUnderlyingMismatch,
  CHECK_IN_STATUS,
} from './engagement.js';

/** Build a minimal completed check-in. */
function ci(sequence, { words = 30, latencyHours = 2, status = CHECK_IN_STATUS.COMPLETED } = {}) {
  return { sequence, status, wordCount: words, responseLatencyHours: latencyHours };
}

describe('engagementMetrics', () => {
  test('a person replying on schedule at stable length reads as engaged', () => {
    const history = [1, 2, 3, 4, 5, 6].map((s) => ci(s));
    const m = engagementMetrics(history);
    assert.equal(m.completionRate, 1);
    assert.equal(m.missedStreak, 0);
    assert.ok(m.disengagementScore < 25, `expected low disengagement, got ${m.disengagementScore}`);
  });

  test('missed check-ins raise disengagement', () => {
    const history = [
      ci(1), ci(2),
      ci(3, { status: CHECK_IN_STATUS.MISSED }),
      ci(4, { status: CHECK_IN_STATUS.MISSED }),
      ci(5, { status: CHECK_IN_STATUS.MISSED }),
    ];
    const m = engagementMetrics(history);
    assert.equal(m.missedStreak, 3);
    assert.ok(m.completionRate < 0.5);
    assert.ok(m.disengagementScore > 55, `expected high disengagement, got ${m.disengagementScore}`);
  });

  test('collapsing reply length raises disengagement even with nothing missed', () => {
    // This is Persona F's signature: still technically replying, but with less
    // and less. A completion-rate-only metric would score this as fully engaged.
    const history = [
      ci(1, { words: 45 }), ci(2, { words: 30 }), ci(3, { words: 18 }),
      ci(4, { words: 8 }), ci(5, { words: 3 }), ci(6, { words: 1 }),
    ];
    const m = engagementMetrics(history);
    assert.equal(m.completionRate, 1, 'nothing was missed');
    assert.ok(m.wordCountSlope < 0, 'reply length is trending down');
    assert.ok(m.disengagementScore > 40, `collapsing replies should register, got ${m.disengagementScore}`);
  });

  test('lengthening replies do not count as disengagement', () => {
    const history = [
      ci(1, { words: 5 }), ci(2, { words: 12 }), ci(3, { words: 25 }), ci(4, { words: 40 }),
    ];
    const m = engagementMetrics(history);
    assert.ok(m.wordCountSlope > 0);
    assert.ok(m.disengagementScore < 25);
  });

  test('rising response latency contributes', () => {
    const slow = engagementMetrics([
      ci(1, { latencyHours: 1 }), ci(2, { latencyHours: 12 }),
      ci(3, { latencyHours: 48 }), ci(4, { latencyHours: 96 }),
    ]);
    const prompt = engagementMetrics([
      ci(1, { latencyHours: 1 }), ci(2, { latencyHours: 1 }),
      ci(3, { latencyHours: 2 }), ci(4, { latencyHours: 1 }),
    ]);
    assert.ok(slow.disengagementScore > prompt.disengagementScore);
  });

  test('score stays within 0-100 under extreme input', () => {
    const awful = engagementMetrics([
      ci(1, { words: 500, latencyHours: 0 }),
      ...[2, 3, 4, 5, 6, 7, 8].map((s) => ci(s, { status: CHECK_IN_STATUS.MISSED })),
    ]);
    assert.ok(awful.disengagementScore >= 0 && awful.disengagementScore <= 100);
  });

  test('empty and single-entry histories return safe defaults rather than NaN', () => {
    for (const history of [[], [ci(1)]]) {
      const m = engagementMetrics(history);
      assert.ok(Number.isFinite(m.disengagementScore), 'must not be NaN');
      assert.ok(Number.isFinite(m.wordCountSlope));
      assert.ok(m.disengagementScore >= 0 && m.disengagementScore <= 100);
    }
  });

  test('is a pure function of its input', () => {
    const history = [ci(1, { words: 40 }), ci(2, { words: 10 })];
    assert.deepEqual(engagementMetrics(history), engagementMetrics(history));
  });
});

describe('sentimentTrend', () => {
  test('rising distress across check-ins reports a rising direction', () => {
    const t = sentimentTrend([20, 35, 50, 65]);
    assert.equal(t.direction, 'rising');
    assert.ok(t.slope > 0);
    assert.ok(t.delta > 0);
  });

  test('falling distress reports an improving direction', () => {
    const t = sentimentTrend([70, 55, 40, 25]);
    assert.equal(t.direction, 'improving');
    assert.ok(t.slope < 0);
  });

  test('flat values report as stable, not as a spurious trend', () => {
    const t = sentimentTrend([40, 41, 40, 39]);
    assert.equal(t.direction, 'stable');
  });

  test('fewer than two points is stable with zero slope, not NaN', () => {
    for (const input of [[], [50]]) {
      const t = sentimentTrend(input);
      assert.equal(t.direction, 'stable');
      assert.ok(Number.isFinite(t.slope));
      assert.ok(Number.isFinite(t.delta));
    }
  });
});

describe('surfaceUnderlyingMismatch', () => {
  /**
   * The Persona F detector, and the reason it is deterministic: it compares what
   * the person's words *sound like* against what their behaviour shows. An LLM
   * reading one upbeat message in isolation has no way to see this.
   */
  test('surface-positive replies plus collapsing engagement is a sustained mismatch', () => {
    const checkIns = [
      { sequence: 1, surfaceSentiment: 20, wordCount: 40, status: CHECK_IN_STATUS.COMPLETED },
      { sequence: 2, surfaceSentiment: 18, wordCount: 20, status: CHECK_IN_STATUS.COMPLETED },
      { sequence: 3, surfaceSentiment: 22, wordCount: 8, status: CHECK_IN_STATUS.COMPLETED },
      { sequence: 4, surfaceSentiment: 15, wordCount: 3, status: CHECK_IN_STATUS.MISSED },
      { sequence: 5, surfaceSentiment: 19, wordCount: 1, status: CHECK_IN_STATUS.COMPLETED },
    ];
    const m = surfaceUnderlyingMismatch(checkIns);
    assert.ok(m.sustained, 'should flag as sustained');
    assert.ok(m.run >= 3, `expected a run of 3+, got ${m.run}`);
    assert.ok(m.detail.length > 0, 'needs an explanation string for the counsellor');
  });

  test('genuinely stable positive cases are NOT flagged', () => {
    // Persona C must not be caught by this. Over-flagging a recovering person is
    // a real harm, not a conservative default.
    const checkIns = [1, 2, 3, 4, 5].map((s) => ({
      sequence: s, surfaceSentiment: 20, wordCount: 35, status: CHECK_IN_STATUS.COMPLETED,
    }));
    const m = surfaceUnderlyingMismatch(checkIns);
    assert.equal(m.sustained, false);
    assert.equal(m.run, 0);
  });

  test('distress that the words openly express is not a mismatch', () => {
    // Persona E says plainly that they are tired. Nothing is being masked, so
    // this routes on score alone rather than through the mismatch trigger.
    const checkIns = [1, 2, 3, 4].map((s) => ({
      sequence: s, surfaceSentiment: 75, wordCount: 8, status: CHECK_IN_STATUS.COMPLETED,
    }));
    const m = surfaceUnderlyingMismatch(checkIns);
    assert.equal(m.sustained, false);
  });

  test('a single upbeat reply with low engagement is not yet sustained', () => {
    const checkIns = [
      { sequence: 1, surfaceSentiment: 60, wordCount: 40, status: CHECK_IN_STATUS.COMPLETED },
      { sequence: 2, surfaceSentiment: 18, wordCount: 2, status: CHECK_IN_STATUS.COMPLETED },
    ];
    const m = surfaceUnderlyingMismatch(checkIns);
    assert.equal(m.sustained, false, 'one data point is noise, not a pattern');
  });

  test('empty history does not throw', () => {
    const m = surfaceUnderlyingMismatch([]);
    assert.equal(m.sustained, false);
    assert.equal(m.run, 0);
  });
});
