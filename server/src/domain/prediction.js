/**
 * Trend prediction — extrapolates current trajectory to estimate time to escalation.
 *
 * WHY THIS EXISTS
 * -------------------------------------------------------------------------
 * The problem statement requires the system to "predict escalation of
 * psychological distress BEFORE a crisis situation emerges." The scoring
 * engine already computes a trend (slope) across check-ins. This module
 * uses that slope to extrapolate when the score would cross the escalation
 * threshold, giving counsellors a concrete time estimate.
 *
 * IMPORTANT SCOPE NOTE
 * -------------------------------------------------------------------------
 * This is trend extrapolation, NOT clinical prediction. It assumes the
 * current trajectory continues at the same rate — which is often wrong
 * (people improve, situations change, interventions work). It is useful
 * as a decision-support tool: "if nothing changes, this case will cross
 * the threshold in approximately X days." It is NOT a claim about what
 * WILL happen.
 *
 * The prediction is deliberately conservative: it only fires when:
 *   1. There are at least 3 check-ins (enough data for a trend)
 *   2. The trend is worsening (slope > 0)
 *   3. The current score is below the escalation threshold (otherwise
 *      it has already escalated)
 *   4. The extrapolated crossing is within a reasonable horizon (90 days)
 */

import { ESCALATION_THRESHOLD } from './escalation.js';

/** How many check-ins minimum before a prediction is meaningful. */
const MIN_CHECK_INS_FOR_PREDICTION = 3;

/** Maximum prediction horizon in days — beyond this, uncertainty is too high. */
const MAX_HORIZON_DAYS = 90;

/**
 * Predict when a case would cross the escalation threshold,
 * given its current trajectory.
 *
 * @param {{ score: number, trend: { slope: number, points: number, direction: string } }} assessment
 * @param {{ nextHearingDate?: string }} [caseRecord]
 * @returns {{
 *   predicted: boolean,
 *   estimatedDaysToThreshold: number|null,
 *   estimatedDate: string|null,
 *   confidence: 'low'|'medium'|'high',
 *   reasoning: string,
 *   courtDateRisk: boolean,
 * }}
 */
export function predictEscalation(assessment, caseRecord) {
  const score = assessment?.score ?? 0;
  const trend = assessment?.trend ?? {};
  const slope = trend.slope ?? 0;
  const points = trend.points ?? 0;

  // Not enough data for prediction
  if (points < MIN_CHECK_INS_FOR_PREDICTION) {
    return {
      predicted: false,
      estimatedDaysToThreshold: null,
      estimatedDate: null,
      confidence: 'low',
      reasoning: `Not enough check-ins yet for trend prediction (${points}/${MIN_CHECK_INS_FOR_PREDICTION} minimum).`,
      courtDateRisk: false,
    };
  }

  // Already escalated — no need to predict
  if (score >= ESCALATION_THRESHOLD) {
    return {
      predicted: false,
      estimatedDaysToThreshold: 0,
      estimatedDate: null,
      confidence: 'high',
      reasoning: `Case has already crossed the escalation threshold (score: ${score}, threshold: ${ESCALATION_THRESHOLD}).`,
      courtDateRisk: false,
    };
  }

  // Trend is improving or stable — no escalation predicted
  if (slope <= 0) {
    return {
      predicted: false,
      estimatedDaysToThreshold: null,
      estimatedDate: null,
      confidence: 'medium',
      reasoning: trend.direction === 'improving'
        ? 'Trend is improving — no escalation predicted.'
        : 'Trend is stable — no escalation predicted.',
      courtDateRisk: false,
    };
  }

  // Extrapolate: how many check-ins until score crosses threshold?
  // Slope is points per check-in. Average check-in interval varies,
  // but we estimate ~7 days between check-ins for the time projection.
  const gapToThreshold = ESCALATION_THRESHOLD - score;
  const checkInsToThreshold = gapToThreshold / slope;
  const estimatedDays = Math.round(checkInsToThreshold * 7);

  // Beyond reasonable horizon
  if (estimatedDays > MAX_HORIZON_DAYS) {
    return {
      predicted: false,
      estimatedDaysToThreshold: estimatedDays,
      estimatedDate: null,
      confidence: 'low',
      reasoning: `Current trajectory suggests escalation in approximately ${estimatedDays} days, which is beyond the reliable prediction horizon.`,
      courtDateRisk: false,
    };
  }

  // Calculate estimated date
  const now = new Date();
  const estimatedDate = new Date(now.getTime() + estimatedDays * 24 * 60 * 60 * 1000);
  const dateStr = estimatedDate.toISOString().split('T')[0];

  // Confidence based on number of data points
  const confidence = points >= 6 ? 'high' : points >= 4 ? 'medium' : 'low';

  // Check if court date is within the prediction window
  let courtDateRisk = false;
  if (caseRecord?.nextHearingDate) {
    const hearingDate = new Date(caseRecord.nextHearingDate);
    const daysUntilHearing = Math.round((hearingDate - now) / (24 * 60 * 60 * 1000));
    if (daysUntilHearing > 0 && daysUntilHearing <= estimatedDays) {
      courtDateRisk = true;
    }
  }

  const reasoning = `Current score is ${score} (threshold: ${ESCALATION_THRESHOLD}). ` +
    `Trend is worsening at ${slope.toFixed(1)} points per check-in. ` +
    `At this rate, the case would cross the threshold in approximately ${estimatedDays} days ` +
    `(~${checkInsToThreshold.toFixed(1)} check-ins). ` +
    `Confidence: ${confidence} (${points} data points).` +
    (courtDateRisk ? ' WARNING: Court date falls within the prediction window.' : '');

  return {
    predicted: true,
    estimatedDaysToThreshold: estimatedDays,
    estimatedDate: dateStr,
    confidence,
    reasoning,
    courtDateRisk,
  };
}

/**
 * Generate a short prediction summary for the counsellor dashboard.
 *
 * @param {ReturnType<typeof predictEscalation>} prediction
 * @returns {string}
 */
export function predictionSummary(prediction) {
  if (!prediction.predicted) {
    return prediction.reasoning;
  }

  const urgency = prediction.estimatedDaysToThreshold <= 14
    ? 'Urgent'
    : prediction.estimatedDaysToThreshold <= 30
    ? 'Attention needed'
    : 'Monitor closely';

  return `${urgency}: estimated escalation in ~${prediction.estimatedDaysToThreshold} days ` +
    `(${prediction.estimatedDate}). ${prediction.courtDateRisk ? 'Court date within window.' : ''}`;
}
