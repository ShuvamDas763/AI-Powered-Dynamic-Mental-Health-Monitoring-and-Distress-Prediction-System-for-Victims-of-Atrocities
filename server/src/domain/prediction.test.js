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
});
