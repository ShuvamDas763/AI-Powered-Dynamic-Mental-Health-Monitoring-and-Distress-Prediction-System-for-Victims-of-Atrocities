import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { projectTrajectory, predictEscalation, predictionSummary, TRAJECTORY_DISCLAIMER } from './prediction.js';

describe('Early-Warning Trajectory Engine', () => {
  test('returns insufficient evidence when observations < 3', () => {
    const assessment = { score: 45, trend: { slope: 2.5, points: 2 } };
    const res = projectTrajectory(assessment, [{ occurredAt: '2026-09-01' }, { occurredAt: '2026-09-08' }]);

    assert.equal(res.projected, false);
    assert.equal(res.evidenceQuality, 'insufficient');
    assert.match(res.reasoning, /at least 3 observations/i);
    assert.equal(res.disclaimer, TRAJECTORY_DISCLAIMER);
  });

  test('does not project if case has already crossed threshold', () => {
    const assessment = { score: 75, trend: { slope: 3.0, points: 5 } };
    const res = projectTrajectory(assessment);

    assert.equal(res.projected, false);
    assert.equal(res.estimatedDaysToThreshold, 0);
    assert.match(res.reasoning, /meets or exceeds the support-review threshold/i);
  });

  test('does not project escalation if slope is improving (<= 0)', () => {
    const assessment = { score: 40, trend: { slope: -1.5, points: 5, direction: 'improving' } };
    const history = [
      { occurredAt: '2026-08-01' },
      { occurredAt: '2026-08-08' },
      { occurredAt: '2026-08-15' },
      { occurredAt: '2026-08-22' },
      { occurredAt: '2026-08-29' },
    ];
    const res = projectTrajectory(assessment, history);

    assert.equal(res.projected, false);
    assert.equal(res.trajectoryDirection, 'improving');
    assert.match(res.reasoning, /improving across recent observations/i);
  });

  test('computes empirical time window and evidence quality from actual timestamps', () => {
    // Score 45, threshold 70 -> gap is 25. Slope is 2.5 points per check-in -> ~10 check-ins.
    // 5 observations over 28 days -> avg 7 days per check-in -> ~70 nominal days.
    const assessment = { score: 45, trend: { slope: 2.5, points: 5 } };
    const history = [
      { occurredAt: '2026-08-01', status: 'completed' },
      { occurredAt: '2026-08-08', status: 'completed' },
      { occurredAt: '2026-08-15', status: 'completed' },
      { occurredAt: '2026-08-22', status: 'completed' },
      { occurredAt: '2026-08-29', status: 'completed' },
    ];
    const res = projectTrajectory(assessment, history);

    assert.equal(res.projected, true);
    assert.equal(res.predicted, true);
    assert.ok(res.estimatedWindowDays);
    assert.ok(res.estimatedWindowDays.min >= 3);
    assert.ok(res.estimatedWindowDays.max > res.estimatedWindowDays.min);
    assert.equal(res.trajectoryDirection, 'rising');
    assert.equal(res.evidenceQuality, 'moderate');
    assert.equal(res.observations, 5);
    assert.equal(res.observationWindowDays, 28);
    assert.match(res.reasoning, /cross the support-review threshold/i);
    assert.equal(res.disclaimer, TRAJECTORY_DISCLAIMER);
  });

  test('detects court hearing date overlap within projected window', () => {
    // Score 60, threshold 70 -> gap is 10. Slope 2.0 -> ~5 check-ins.
    // Daily check-ins: 4 check-ins over 12 days -> avg 4 days per check-in -> ~20 nominal days.
    const assessment = { score: 60, trend: { slope: 2.0, points: 4 } };
    const history = [
      { occurredAt: '2026-09-01', status: 'completed' },
      { occurredAt: '2026-09-05', status: 'completed' },
      { occurredAt: '2026-09-09', status: 'completed' },
      { occurredAt: '2026-09-13', status: 'completed' },
    ];

    const now = Date.now();
    const hearingDate = new Date(now + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const caseRecord = { nextHearingDate: hearingDate };

    const res = projectTrajectory(assessment, history, caseRecord);
    assert.equal(res.projected, true);
    assert.equal(res.courtDateOverlap, true);
    assert.equal(res.courtDateRisk, true);
    assert.match(res.reasoning, /Next scheduled court hearing falls within this projected window/i);
  });

  test('predictionSummary formats concise decision-support string', () => {
    const trajectory = {
      projected: true,
      estimatedWindowDays: { min: 14, max: 24 },
      evidenceQuality: 'moderate',
    };
    const summary = predictionSummary(trajectory);
    assert.match(summary, /14–24 days/);
    assert.match(summary, /moderate evidence/);
  });

  // ── P2-6 Specific Regression Tests ─────────────────────────────────

  test('non-uniform timestamps: correctly computes empirical spacing without assuming 7 days', () => {
    // 4 observations spaced 3 days, 10 days, 2 days apart -> total window is 15 days
    const assessment = { score: 50, trend: { slope: 2.0, points: 4 } };
    const history = [
      { occurredAt: '2026-09-01T10:00:00Z' },
      { occurredAt: '2026-09-04T10:00:00Z' }, // +3 days
      { occurredAt: '2026-09-14T10:00:00Z' }, // +10 days
      { occurredAt: '2026-09-16T10:00:00Z' }, // +2 days (total 15 days)
    ];
    const res = projectTrajectory(assessment, history);

    assert.equal(res.projected, true);
    assert.equal(res.observationWindowDays, 15);
    // avg days per checkin is 15 / 3 = 5 days (not 7 days!)
    // gap is 20, check-ins needed = 10, nominal days = 50 days.
    assert.ok(res.estimatedWindowDays);
    assert.ok(res.estimatedWindowDays.min > 0);
    assert.ok(res.estimatedWindowDays.max > res.estimatedWindowDays.min);
    assert.equal(Number.isNaN(res.estimatedWindowDays.min), false);
    assert.equal(Number.isNaN(res.estimatedWindowDays.max), false);
  });

  test('missing timestamps: does NOT manufacture 7-day interval and returns safe insufficient state', () => {
    // 5 observations but none have occurredAt timestamps
    const assessment = { score: 50, trend: { slope: 2.0, points: 5 } };
    const history = [
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
      { status: 'completed' },
    ];
    const res = projectTrajectory(assessment, history);

    assert.equal(res.projected, false);
    assert.equal(res.predicted, false);
    assert.equal(res.estimatedWindowDays, null);
    assert.equal(res.estimatedDaysToThreshold, null);
    assert.equal(res.estimatedDate, null);
    assert.equal(res.evidenceQuality, 'insufficient');
    assert.equal(res.confidence, 'low');
    assert.match(res.reasoning, /Trajectory projection requires valid observation timing/i);
    assert.equal(res.disclaimer, TRAJECTORY_DISCLAIMER);
  });

  test('invalid timestamps: returns safe no-projection state without crashing or inventing intervals', () => {
    const assessment = { score: 50, trend: { slope: 2.0, points: 4 } };
    const history = [
      { occurredAt: 'not-a-valid-date' },
      { occurredAt: null },
      { occurredAt: undefined },
      { occurredAt: 'invalid' },
    ];
    const res = projectTrajectory(assessment, history);

    assert.equal(res.projected, false);
    assert.equal(res.estimatedWindowDays, null);
    assert.equal(res.evidenceQuality, 'insufficient');
    assert.match(res.reasoning, /Trajectory projection requires valid observation timing/i);
  });

  test('only one usable timestamp: returns safe no-projection state', () => {
    const assessment = { score: 50, trend: { slope: 2.0, points: 4 } };
    const history = [
      { occurredAt: '2026-09-01T10:00:00Z' },
      { occurredAt: 'bad-date-1' },
      { occurredAt: 'bad-date-2' },
      { occurredAt: null },
    ];
    const res = projectTrajectory(assessment, history);

    assert.equal(res.projected, false);
    assert.equal(res.estimatedWindowDays, null);
    assert.equal(res.evidenceQuality, 'insufficient');
    assert.match(res.reasoning, /Trajectory projection requires valid observation timing/i);
  });

  test('flat trend (slope = 0): returns no projection with stable direction', () => {
    const assessment = { score: 45, trend: { slope: 0, points: 4 } };
    const history = [
      { occurredAt: '2026-09-01T10:00:00Z' },
      { occurredAt: '2026-09-08T10:00:00Z' },
      { occurredAt: '2026-09-15T10:00:00Z' },
      { occurredAt: '2026-09-22T10:00:00Z' },
    ];
    const res = projectTrajectory(assessment, history);

    assert.equal(res.projected, false);
    assert.equal(res.trajectoryDirection, 'stable');
    assert.equal(res.estimatedWindowDays, null);
    assert.match(res.reasoning, /trend is stable/i);
  });

  test('no NaN, no Infinity, and no negative numbers anywhere in output', () => {
    // Extreme values
    const assessment = { score: 69.9, trend: { slope: 0.00001, points: 4 } };
    const history = [
      { occurredAt: '2026-09-01T10:00:00Z' },
      { occurredAt: '2026-09-02T10:00:00Z' },
      { occurredAt: '2026-09-03T10:00:00Z' },
      { occurredAt: '2026-09-04T10:00:00Z' },
    ];
    const res = projectTrajectory(assessment, history);

    if (res.projected) {
      assert.ok(Number.isFinite(res.estimatedWindowDays.min));
      assert.ok(Number.isFinite(res.estimatedWindowDays.max));
      assert.ok(res.estimatedWindowDays.min > 0);
      assert.ok(res.estimatedWindowDays.max >= res.estimatedWindowDays.min);
    } else {
      assert.equal(res.estimatedWindowDays, null);
    }
  });
});
