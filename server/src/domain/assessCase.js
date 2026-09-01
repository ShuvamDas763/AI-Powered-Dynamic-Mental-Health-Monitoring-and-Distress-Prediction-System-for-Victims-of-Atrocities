/**
 * The assessment pipeline: case + check-in history -> scored, explained record.
 *
 * This is the seam where the four domain modules meet, and it is deliberately
 * thin. It does no scoring arithmetic of its own — it decides what each module
 * gets fed, and it turns the result into something a counsellor can read.
 *
 * WHY EVERY CHECK-IN GETS ITS OWN ASSESSMENT
 * -------------------------------------------------------------------------
 * The trend line on the dashboard is computed, not drawn. Each point is a real
 * assessment made from ONLY the check-ins up to that date. If a later assessment
 * could see the whole history, the earliest point on the chart would already know
 * how the story ends, and the "rising trend" a counsellor is shown would be an
 * artefact of the rendering rather than a finding about the person.
 *
 * WHY HARD SIGNALS BARELY MOVE THE SCORE
 * -------------------------------------------------------------------------
 * The obvious way to make an intimidation report escalate is to add 40 points to
 * the distress score. We do not do that. A score that can be shoved around to
 * force an alert is no longer a measurement, and the person it describes deserves
 * a number that means what it says. So signals contribute a small, weighted
 * amount to the score, and escalate the case through the deterministic rule in
 * escalation.js instead. A jury asking "if intimidation only adds a few points,
 * how does that case get flagged?" gets a real answer: it does not get flagged by
 * the score at all — it gets flagged by a named rule you can read.
 */

import { engagementMetrics, sentimentTrend, surfaceUnderlyingMismatch, CHECK_IN_STATUS } from './engagement.js';
import { compositeDistressScore, COMPONENT_WEIGHTS, BAND } from './distressScore.js';
import { SIGNAL, SIGNAL_LABELS, evaluateEscalation, describeSignal } from './escalation.js';
import { recommendInterventions } from './interventions.js';
import { makeAssessment, PROVENANCE } from './records.js';

/**
 * How many recent check-ins are searched for signals.
 *
 * Wider than "the latest check-in" on purpose. Someone who reports feeling
 * watched and then stops answering has not become safer, and a system that only
 * reads the most recent message would quietly treat that silence as the concern
 * having passed.
 */
export const RECENT_SIGNAL_WINDOW = 3;

/**
 * Slope-to-score scaling for the trend component. A worsening drift of 10 points
 * per check-in saturates the component; anything gentler scales linearly.
 */
export const TREND_SCALE = 10;

/**
 * How much each signal contributes to the pattern component.
 *
 * Small numbers by design — see the header note. These are 0-100 readings for a
 * component that carries only 8% of the final score, so the largest of them moves
 * the total by about six points. Escalation is the rule's job, not this table's.
 */
const PATTERN_WEIGHT = Object.freeze({
  [SIGNAL.INTIMIDATION]: 70,
  [SIGNAL.HOPELESSNESS]: 55,
  [SIGNAL.SOCIAL_ISOLATION]: 40,
  [SIGNAL.PROCESS_FATIGUE]: 30,
  [SIGNAL.ECONOMIC_PRESSURE]: 30,
  [SIGNAL.DEFLECTION]: 25,
  [SIGNAL.DISENGAGEMENT]: 20,
});

/** A sustained words/behaviour mismatch is itself a recognised pattern. */
const MISMATCH_PATTERN_WEIGHT = 65;

/** Plain-language names for the four score components. */
const COMPONENT_LABELS = Object.freeze({
  sentiment: 'What was said at this check-in',
  disengagement: 'Participation pattern',
  trendDelta: 'Direction of travel across check-ins',
  flaggedPatternBoost: 'Recognised concern patterns',
});

/** Band wording for the headline. Support levels, never conditions. */
const BAND_LABELS = Object.freeze({
  [BAND.LOW]: 'Low',
  [BAND.MODERATE]: 'Moderate',
  [BAND.ELEVATED]: 'Elevated',
  [BAND.HIGH]: 'High',
});

const isRecord = (c) => c !== null && typeof c === 'object';
const clean = (history) => (Array.isArray(history) ? history.filter(isRecord) : []);
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Signals reported across the recent window, deduplicated.
 *
 * Exported so the counsellor view and the alert panel read the same window the
 * escalation rule did, rather than each deciding for itself what "recent" means.
 */
export function collectRecentSignals(history) {
  const recent = clean(history).slice(-RECENT_SIGNAL_WINDOW);
  const signals = recent.flatMap((c) => (Array.isArray(c.signals) ? c.signals : []));
  return [...new Set(signals)];
}

/** Quoted phrases across the recent window, deduplicated. */
function collectRecentPhrases(history) {
  const recent = clean(history).slice(-RECENT_SIGNAL_WINDOW);
  const phrases = recent.flatMap((c) => (Array.isArray(c.signalPhrases) ? c.signalPhrases : []));
  return [...new Set(phrases)];
}

/**
 * The pattern component, and which signal produced it.
 *
 * Takes the MAXIMUM rather than the sum, for the same reason the priority table
 * does: summing would let a case tagged with several ordinary signals outrank a
 * case carrying one serious one.
 */
function patternComponent(signals, mismatch) {
  const candidates = signals
    .map((s) => ({ weight: PATTERN_WEIGHT[s] ?? 0, signal: s }))
    .filter((c) => c.weight > 0);

  if (mismatch.sustained) {
    candidates.push({ weight: MISMATCH_PATTERN_WEIGHT, signal: SIGNAL.DEFLECTION });
  }

  if (candidates.length === 0) return { value: 0, drivingSignal: null };
  const strongest = candidates.reduce((a, b) => (b.weight > a.weight ? b : a));
  return { value: strongest.weight, drivingSignal: strongest.signal };
}

/**
 * The trend component.
 *
 * Only a WORSENING drift contributes. An improving trend returns zero rather than
 * a negative, because getting better must never be able to subtract from the
 * reading and mask a separate concern — such as a collapse in participation
 * happening at the same time.
 */
function trendComponent(trend) {
  return trend.slope > 0 ? Math.min(100, trend.slope * TREND_SCALE) : 0;
}

/** How the participation figures are explained, in the figures themselves. */
function describeEngagement(history, metrics) {
  const missed = history.filter((c) => c.status === CHECK_IN_STATUS.MISSED).length;
  const pct = Math.round(metrics.completionRate * 100);
  const parts = [`${missed} of ${history.length} check-ins unanswered (${pct}% completed)`];
  if (metrics.missedStreak > 0) {
    parts.push(`${metrics.missedStreak} missed in a row most recently`);
  }
  if (metrics.wordCountSlope < -0.5) {
    parts.push('replies getting shorter over time');
  }
  if (metrics.latencySlope > 0.5) {
    parts.push('replies taking longer to arrive');
  }
  return `${parts.join('; ')}.`;
}

/** How the surface reading is explained — including when it was not fresh. */
function describeSentiment(latest, value) {
  if (latest.status === CHECK_IN_STATUS.MISSED || latest.surfaceSentimentCarriedForward) {
    return `No reply at this check-in, so the last known reading of ${value}/100 is carried forward and shown as such.`;
  }
  if (latest.surfaceSentiment === null) {
    return 'No reading available for what was said at this check-in.';
  }
  return `What was said read at ${value}/100 on the concern scale.`;
}

/** How the trajectory is explained. */
function describeTrend(trend, points) {
  if (points < 2) return 'Not enough check-ins yet to read a direction.';
  const movement = {
    rising: 'moving toward more concern',
    improving: 'moving toward less concern',
    stable: 'holding steady',
  }[trend.direction];
  return `Readings across ${points} check-ins are ${movement} (change of ${round1(trend.delta)} points end to end).`;
}

/** How the pattern component is explained. */
function describePattern(drivingSignal, mismatch) {
  if (mismatch.sustained) {
    return `${mismatch.detail} Recognised pattern: ${SIGNAL_LABELS[SIGNAL.DEFLECTION]}.`;
  }
  if (drivingSignal) return `Recognised pattern: ${describeSignal(drivingSignal)}.`;
  return 'No recognised concern pattern at this check-in.';
}

/**
 * Assess one point in time from the check-ins up to and including it.
 *
 * `history` must be the PREFIX, not the whole record. Callers should go through
 * assessCaseHistory rather than slicing themselves.
 */
function assessPrefix(caseRecord, prefix, options) {
  const latest = prefix.at(-1);
  const metrics = engagementMetrics(prefix);
  const readings = prefix.map((c) => c.surfaceSentiment).filter((v) => typeof v === 'number');
  const trend = sentimentTrend(readings);
  const mismatch = surfaceUnderlyingMismatch(prefix);
  const signals = collectRecentSignals(prefix);
  const pattern = patternComponent(signals, mismatch);

  const sentimentValue = typeof latest.surfaceSentiment === 'number' ? latest.surfaceSentiment : 0;

  const { score, band, components, contributions } = compositeDistressScore({
    sentiment: sentimentValue,
    disengagement: metrics.disengagementScore,
    trendDelta: trendComponent(trend),
    flaggedPatternBoost: pattern.value,
  });

  // Escalation reads the SCORE plus the docket's own sensitivity and the hard
  // signals — never the person's identity. See escalation.js.
  const escalation = evaluateEscalation({
    distressScore: score,
    priorityTags: caseRecord?.priorityTags ?? [],
    signals,
    mismatchRun: mismatch.run,
    llmImmediateReview: latest.immediateReviewRequested === true,
    crisisDetected: latest.crisisDetected === true,
  });

  const details = {
    sentiment: describeSentiment(latest, components.sentiment),
    disengagement: describeEngagement(prefix, metrics),
    trendDelta: describeTrend(trend, readings.length),
    flaggedPatternBoost: describePattern(pattern.drivingSignal, mismatch),
  };

  // Contributions are already weighted points out of 100, so ordering by them
  // answers the question a counsellor actually asks: what drove this number?
  const totalContribution = Object.values(contributions).reduce((a, b) => a + b, 0);
  const drivers = Object.keys(COMPONENT_WEIGHTS)
    .map((component) => ({
      component,
      label: COMPONENT_LABELS[component],
      detail: details[component],
      value: components[component],
      weightPct: Math.round(COMPONENT_WEIGHTS[component] * 100),
      contribution: round1(contributions[component]),
      sharePct: totalContribution > 0
        ? round1((contributions[component] / totalContribution) * 100)
        : 0,
    }))
    .sort((a, b) => b.contribution - a.contribution);

  // Intervention recommendations — deterministic lookup, not LLM-generated.
  const interventions = recommendInterventions({
    band,
    priorityTags: caseRecord?.priorityTags ?? [],
    signals,
  });

  return makeAssessment({
    caseId: caseRecord?.caseId ?? null,
    checkInId: latest.id,
    score,
    band,
    components,
    contributions,
    engagement: metrics,
    trend: { ...trend, points: readings.length },
    mismatch,
    escalation,
    interventions,
    explanation: {
      headline: `${BAND_LABELS[band]} support signal at this check-in. Largest contributor: ${drivers[0].label.toLowerCase()}.`,
      drivers,
      signalPhrases: collectRecentPhrases(prefix),
    },
    provenance: {
      // The pipeline itself is deterministic; provenance describes where the
      // SENTIMENT reading came from, since that is the only model-derived input.
      source: latest.provenance ?? PROVENANCE.SEED,
      model: options?.model ?? null,
      fallbackReason: options?.fallbackReason ?? null,
    },
  }, options);
}

/**
 * One assessment per check-in, oldest first.
 *
 * Each is computed from the prefix ending at that check-in, so the resulting
 * series is a genuine longitudinal record rather than the latest number
 * back-projected across old dates.
 */
export function assessCaseHistory(caseRecord, history, options = {}) {
  const records = clean(history);
  return records.map((_, index) => assessPrefix(caseRecord, records.slice(0, index + 1), options));
}

/** The current assessment for a case, or null when there is no history yet. */
export function assessLatest(caseRecord, history, options = {}) {
  const records = clean(history);
  if (records.length === 0) return null;
  return assessPrefix(caseRecord, records, options);
}
