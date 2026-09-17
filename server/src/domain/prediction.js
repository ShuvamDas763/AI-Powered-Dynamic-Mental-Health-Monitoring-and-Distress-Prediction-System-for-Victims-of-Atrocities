/**
 * Early-Warning Trajectory Projection Engine.
 *
 * CONCEPTUAL REFACTOR
 * -------------------------------------------------------------------------
 * This engine replaces naive linear extrapolation with a defensible,
 * empirical early-warning trajectory model.
 *
 * Key Principles:
 *   1. No clinical diagnosis or validated crisis prediction claims.
 *   2. No hard-coded "7 days per check-in" assumption.
 *   3. Calculates actual elapsed days and interval variance from check-in timestamps.
 *   4. Evaluates evidence quality based on observation count, window width,
 *      missingness, and trend stability.
 *   5. Outputs an empirical time window (e.g. 14–24 days) rather than a single
 *      misleading point-in-time prediction.
 *
 * INSTITUTIONAL DISCLAIMER
 * -------------------------------------------------------------------------
 * "Trajectory projection is decision-support only and is not a clinical diagnosis
 *  or validated crisis prediction."
 */

import { ESCALATION_THRESHOLD } from './escalation.js';

export const MIN_OBSERVATIONS_FOR_TRAJECTORY = 3;
export const MAX_HORIZON_DAYS = 90;
export const TRAJECTORY_DISCLAIMER =
  'Trajectory projection is decision-support only and is not a clinical diagnosis or validated crisis prediction.';

/**
 * Project early-warning trajectory toward the support-review threshold.
 *
 * @param {object} assessment
 * @param {number} assessment.score Current composite distress score
 * @param {{ slope: number, points: number, direction: string, delta?: number }} assessment.trend
 * @param {Array<object>} [history] Full check-in history with timestamps and status
 * @param {object} [caseRecord] Case docket with nextHearingDate
 * @returns {{
 *   projected: boolean,
 *   predicted: boolean,
 *   estimatedWindowDays: { min: number, max: number } | null,
 *   estimatedDaysToThreshold: number | null,
 *   estimatedDate: string | null,
 *   trajectoryDirection: 'rising' | 'stable' | 'improving',
 *   evidenceQuality: 'preliminary' | 'moderate' | 'robust' | 'insufficient',
 *   confidence: 'low' | 'medium' | 'high',
 *   observations: number,
 *   observationWindowDays: number,
 *   missingnessRatio: number,
 *   reasoning: string,
 *   courtDateOverlap: boolean,
 *   courtDateRisk: boolean,
 *   disclaimer: string,
 * }}
 */
export function projectTrajectory(assessment, history = [], caseRecord = null) {
  const score = Number.isFinite(assessment?.score) ? assessment.score : 0;
  const trend = assessment?.trend ?? {};
  const slope = Number.isFinite(trend.slope) ? trend.slope : 0;

  // Use actual history array if provided, otherwise fallback to trend.points count
  const validHistory = Array.isArray(history) ? history.filter((c) => c && typeof c === 'object') : [];
  const observations = validHistory.length > 0 ? validHistory.length : (trend.points || 0);

  // Derive actual elapsed observation window from real timestamps
  let observationWindowDays = 0;
  let missingCount = 0;

  if (validHistory.length >= 2) {
    const timestamps = validHistory
      .map((c) => (c.occurredAt ? new Date(c.occurredAt).getTime() : null))
      .filter((t) => Number.isFinite(t))
      .sort((a, b) => a - b);

    if (timestamps.length >= 2) {
      const elapsedMs = timestamps[timestamps.length - 1] - timestamps[0];
      observationWindowDays = Math.max(1, Math.round(elapsedMs / (24 * 60 * 60 * 1000)));
    } else {
      observationWindowDays = Math.max(1, (observations - 1) * 7);
    }
    missingCount = validHistory.filter((c) => c.status === 'missed').length;
  } else if (observations > 1) {
    observationWindowDays = (observations - 1) * 7;
  }

  const missingnessRatio = observations > 0 ? Math.round((missingCount / observations) * 100) / 100 : 0;

  // Trajectory direction
  const trajectoryDirection = slope > 0.5 ? 'rising' : slope < -0.5 ? 'improving' : 'stable';

  // Evaluate Evidence Quality
  let evidenceQuality = 'insufficient';
  let confidence = 'low';

  if (observations >= 6 && missingnessRatio <= 0.25) {
    evidenceQuality = 'robust';
    confidence = 'high';
  } else if (observations >= 4 && missingnessRatio <= 0.40) {
    evidenceQuality = 'moderate';
    confidence = 'medium';
  } else if (observations >= MIN_OBSERVATIONS_FOR_TRAJECTORY) {
    evidenceQuality = 'preliminary';
    confidence = 'low';
  }

  // Guard: Insufficient data
  if (observations < MIN_OBSERVATIONS_FOR_TRAJECTORY) {
    return {
      projected: false,
      predicted: false,
      estimatedWindowDays: null,
      estimatedDaysToThreshold: null,
      estimatedDate: null,
      trajectoryDirection,
      evidenceQuality: 'insufficient',
      confidence: 'low',
      observations,
      observationWindowDays,
      missingnessRatio,
      reasoning: `Trajectory requires at least ${MIN_OBSERVATIONS_FOR_TRAJECTORY} observations (${observations} recorded over ${observationWindowDays} days).`,
      courtDateOverlap: false,
      courtDateRisk: false,
      disclaimer: TRAJECTORY_DISCLAIMER,
    };
  }

  // Guard: Already crossed threshold
  if (score >= ESCALATION_THRESHOLD) {
    return {
      projected: false,
      predicted: false,
      estimatedWindowDays: null,
      estimatedDaysToThreshold: 0,
      estimatedDate: null,
      trajectoryDirection,
      evidenceQuality,
      confidence: 'high',
      observations,
      observationWindowDays,
      missingnessRatio,
      reasoning: `Case currently meets or exceeds the support-review threshold (score ${score} / threshold ${ESCALATION_THRESHOLD}). Active human review required.`,
      courtDateOverlap: false,
      courtDateRisk: false,
      disclaimer: TRAJECTORY_DISCLAIMER,
    };
  }

  // Guard: Improving or Stable
  if (slope <= 0) {
    return {
      projected: false,
      predicted: false,
      estimatedWindowDays: null,
      estimatedDaysToThreshold: null,
      estimatedDate: null,
      trajectoryDirection,
      evidenceQuality,
      confidence,
      observations,
      observationWindowDays,
      missingnessRatio,
      reasoning: trajectoryDirection === 'improving'
        ? 'Distress trend is improving across recent observations. No threshold crossing projected.'
        : 'Distress trend is stable. Score remains consistently below the review threshold.',
      courtDateOverlap: false,
      courtDateRisk: false,
      disclaimer: TRAJECTORY_DISCLAIMER,
    };
  }

  // Compute empirical check-in cadence (actual days between observations)
  const avgDaysPerCheckin = observations > 1 && observationWindowDays > 0
    ? Math.max(2, observationWindowDays / (observations - 1))
    : 7;

  // Project distance to threshold
  const gapToThreshold = ESCALATION_THRESHOLD - score;
  const checkInsToThreshold = gapToThreshold / slope;
  const nominalDays = checkInsToThreshold * avgDaysPerCheckin;

  // Empirical uncertainty window (bounded interval: ±25% to ±40% based on evidence quality)
  const uncertaintyFactor = evidenceQuality === 'robust' ? 0.20 : evidenceQuality === 'moderate' ? 0.30 : 0.40;
  const minDays = Math.max(3, Math.round(nominalDays * (1 - uncertaintyFactor)));
  const maxDays = Math.max(minDays + 2, Math.round(nominalDays * (1 + uncertaintyFactor)));

  // Guard: Beyond maximum defensible horizon
  if (minDays > MAX_HORIZON_DAYS) {
    return {
      projected: false,
      predicted: false,
      estimatedWindowDays: { min: minDays, max: maxDays },
      estimatedDaysToThreshold: minDays,
      estimatedDate: null,
      trajectoryDirection,
      evidenceQuality: 'preliminary',
      confidence: 'low',
      observations,
      observationWindowDays,
      missingnessRatio,
      reasoning: `Rising trajectory is too gradual to reliably project within a ${MAX_HORIZON_DAYS}-day institutional horizon. Ongoing routine check-ins recommended.`,
      courtDateOverlap: false,
      courtDateRisk: false,
      disclaimer: TRAJECTORY_DISCLAIMER,
    };
  }

  // Hearing overlap detection
  let courtDateOverlap = false;
  const now = Date.now();
  if (caseRecord?.nextHearingDate) {
    const hearingTime = new Date(caseRecord.nextHearingDate).getTime();
    const daysUntilHearing = Math.round((hearingTime - now) / (24 * 60 * 60 * 1000));
    if (daysUntilHearing >= minDays - 3 && daysUntilHearing <= maxDays + 3) {
      courtDateOverlap = true;
    }
  }

  const estimatedDateObj = new Date(now + Math.round((minDays + maxDays) / 2) * 24 * 60 * 60 * 1000);
  const estimatedDate = estimatedDateObj.toISOString().split('T')[0];

  const reasoning =
    `If the current pattern continues, the case may cross the support-review threshold ` +
    `in approximately ${minDays}–${maxDays} days based on ${observations} observations over ${observationWindowDays} days.` +
    (courtDateOverlap ? ' Notice: Next scheduled court hearing falls within this projected window.' : '');

  return {
    projected: true,
    predicted: true, // Backward compatibility alias
    estimatedWindowDays: { min: minDays, max: maxDays },
    estimatedDaysToThreshold: minDays, // Backward compatibility numeric alias
    estimatedDate,
    trajectoryDirection,
    evidenceQuality,
    confidence,
    observations,
    observationWindowDays,
    missingnessRatio,
    reasoning,
    courtDateOverlap,
    courtDateRisk: courtDateOverlap, // Backward compatibility alias
    disclaimer: TRAJECTORY_DISCLAIMER,
  };
}

/**
 * Backward compatibility wrapper for existing call sites.
 *
 * @param {object} assessment
 * @param {object} [caseRecord]
 * @param {Array<object>} [history]
 */
export function predictEscalation(assessment, caseRecord, history = []) {
  const actualHistory = Array.isArray(history) && history.length > 0
    ? history
    : (Array.isArray(assessment?.history) ? assessment.history : []);
  return projectTrajectory(assessment, actualHistory, caseRecord);
}

/**
 * Generate a short trajectory summary string for dashboard display.
 */
export function predictionSummary(trajectory) {
  if (!trajectory?.projected && !trajectory?.predicted) {
    return trajectory?.reasoning || 'No trajectory projected.';
  }

  const min = trajectory.estimatedWindowDays?.min ?? trajectory.estimatedDaysToThreshold;
  const max = trajectory.estimatedWindowDays?.max ?? (min + 7);

  return `Projected support review window: ${min}–${max} days (${trajectory.evidenceQuality} evidence).`;
}
