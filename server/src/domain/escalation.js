/**
 * The deterministic escalation rule.
 *
 * ESCALATION IS NOT THE MODEL'S DECISION
 * -------------------------------------------------------------------------
 * A pre-build probe of both LLMs available on this account fed each a
 * witness-intimidation check-in. One scored it 55/100, the other 45/100, and
 * BOTH set "requires immediate review" to false. Spec Section 6 targets that
 * case as high/urgent. Had escalation been left to the model, that case would
 * have sat in a queue.
 *
 * So the division of labour is:
 *   the model  ->  extracts signals from what was said
 *   this file  ->  decides what happens about them
 *
 * A model's judgement varies between versions, providers and temperatures. An
 * escalation rule has to be stable, inspectable, and explainable to the person
 * it concerns and to whoever reviews the system. So it lives here, in arithmetic
 * and named conditions, with every firing reason reported back.
 *
 * THIS RULE IS GENERIC — AND IS TESTED TO STAY THAT WAY
 * -------------------------------------------------------------------------
 * It is a function of (score, category tags, signals, pattern run length) and
 * nothing else. It cannot see who a case belongs to, and a static test asserts
 * this file contains no case or profile identifier at all. If someone ever tries
 * to fix one seeded record by special-casing it here, the suite fails.
 *
 * HUMAN-IN-THE-LOOP: escalating means "put this in front of a person sooner".
 * Nothing here acts on anyone. Spec Section 8, point 4.
 */

import { priorityWeightForTags, describePriorityWeight, PRIORITY_USE_CASE } from './priorityWeighting.js';
import { SUSTAINED_MISMATCH_RUN } from './engagement.js';

/**
 * Priority-adjusted score at or above which a case is escalated for review.
 *
 * 65 sits just above the mid-point of the ELEVATED band. Chosen so that a
 * mid-50s reading on a high-sensitivity docket crosses, while the same reading
 * on a baseline docket does not — the threshold and the weighting table are
 * tuned as a pair, not independently.
 */
export const ESCALATION_THRESHOLD = 65;

/**
 * Signals the analysis layer can report. The model is constrained to this
 * vocabulary so that downstream rules match on stable codes rather than on
 * free-text the model might phrase differently next time.
 */
export const SIGNAL = Object.freeze({
  /** Being watched, followed, or approached about the matter. */
  INTIMIDATION: 'intimidation',
  /** Expressed sense that nothing will change or improve. */
  HOPELESSNESS: 'hopelessness',
  /** Withdrawing from contact or from the process. */
  DISENGAGEMENT: 'disengagement',
  /** Being cut off or avoided by the surrounding community. */
  SOCIAL_ISOLATION: 'social_isolation',
  /** Exhaustion attributed to delays, adjournments, repeated appearances. */
  PROCESS_FATIGUE: 'process_fatigue',
  /** Deflecting or minimising when asked directly. */
  DEFLECTION: 'deflection',
  /** Money, work or housing pressure connected to the matter. */
  ECONOMIC_PRESSURE: 'economic_pressure',
});

/**
 * Plain-language wording for each signal, for the explainability panel.
 *
 * Deliberately describes SITUATIONS AND BEHAVIOUR, never states or conditions:
 * "reported feeling watched", not "is fearful"; "stepping back from contact",
 * not "withdrawn". Nothing here names or implies a medical condition, and none
 * of it describes an act. Both properties are tested.
 */
export const SIGNAL_LABELS = Object.freeze({
  [SIGNAL.INTIMIDATION]: 'reported feeling watched or approached about the matter',
  [SIGNAL.HOPELESSNESS]: 'expressed that nothing is likely to change',
  [SIGNAL.DISENGAGEMENT]: 'stepping back from contact',
  [SIGNAL.SOCIAL_ISOLATION]: 'reported being avoided by people around them',
  [SIGNAL.PROCESS_FATIGUE]: 'worn down by delays and repeated appearances',
  [SIGNAL.DEFLECTION]: 'answering very briefly or turning the question aside',
  [SIGNAL.ECONOMIC_PRESSURE]: 'money, work or housing pressure connected to the matter',
});

/** Wording for one signal code, or a neutral string if it is unrecognised. */
export function describeSignal(signal) {
  return SIGNAL_LABELS[signal] ?? 'an unrecognised signal';
}

/** Stable codes for why a case escalated. */
export const TRIGGER = Object.freeze({
  IMMEDIATE_REVIEW_REQUESTED: 'immediate_review_requested',
  INTIMIDATION_ON_WITNESS_CASE: 'intimidation_on_witness_case',
  SUSTAINED_SURFACE_MISMATCH: 'sustained_surface_mismatch',
  HOPELESSNESS_WITH_DISENGAGEMENT: 'hopelessness_with_disengagement',
  THRESHOLD_CROSSED: 'threshold_crossed',
  CRISIS_DETECTED: 'crisis_detected',
});

/**
 * Plain-language wording for each trigger.
 *
 * Written to be read by a counsellor in a hurry, and safe for the person
 * concerned to read too. No diagnostic language anywhere — these describe
 * situations and patterns, never conditions. Tested.
 */
const TRIGGER_LABELS = Object.freeze({
  [TRIGGER.IMMEDIATE_REVIEW_REQUESTED]: 'Flagged for prompt human review',
  [TRIGGER.INTIMIDATION_ON_WITNESS_CASE]: 'Possible intimidation reported on a witness matter',
  [TRIGGER.SUSTAINED_SURFACE_MISMATCH]: 'Reassuring replies alongside falling participation',
  [TRIGGER.HOPELESSNESS_WITH_DISENGAGEMENT]: 'Loss of hope alongside withdrawal from contact',
  [TRIGGER.THRESHOLD_CROSSED]: 'Priority-adjusted score crossed the review threshold',
  [TRIGGER.CRISIS_DETECTED]: 'Explicit self-harm/suicide language detected — immediate follow-up required',
});

const asArray = (v) => (Array.isArray(v) ? v : []);
const asFiniteNumber = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const clampScore = (v) => Math.min(100, Math.max(0, asFiniteNumber(v)));

/**
 * Decide whether a case needs to be put in front of a human sooner.
 *
 * Two independent routes to escalation, and either is sufficient:
 *
 *  1. THE WEIGHTED SCORE crossing the threshold. This is the ordinary path:
 *     distress score x category sensitivity, compared against a fixed line.
 *
 *  2. A NAMED HARD CONDITION, regardless of score. These exist because the
 *     probe showed the score alone can sit in the 40s-50s on a case that
 *     plainly warrants attention. Each is a specific, defensible combination
 *     rather than a general "be more cautious" fudge.
 *
 * All firing reasons are collected and returned, not just the first — a
 * counsellor should see every reason a case reached them.
 *
 * Malformed input degrades to "no escalation, no crash" rather than throwing,
 * because a serialisation bug must not take down the alert panel.
 *
 * @returns {{
 *   baseScore: number, priorityWeight: number, priorityAdjustedScore: number,
 *   priorityLabel: string, threshold: number, triggered: boolean,
 *   triggerReasons: Array<{code: string, label: string}>
 * }}
 */
export function evaluateEscalation(input) {
  const raw = input ?? {};

  const baseScore = clampScore(raw.distressScore);
  const tags = asArray(raw.priorityTags);
  const signals = asArray(raw.signals);
  const mismatchRun = asFiniteNumber(raw.mismatchRun);
  const immediateReviewRequested = raw.llmImmediateReview === true;

  const priorityWeight = priorityWeightForTags(tags);
  const { label: priorityLabel } = describePriorityWeight(tags);

  // Route 1: the ordinary weighted-score path.
  const priorityAdjustedScore = Math.min(100, Math.round(baseScore * priorityWeight));

  // Route 2: named hard conditions, each independent of the score.
  const has = (signal) => signals.includes(signal);
  const crisisDetected = raw.crisisDetected === true;
  const firings = [
    // Crisis detection: explicit self-harm/suicide language detected.
    // This is the highest-priority trigger — fires regardless of score.
    crisisDetected && TRIGGER.CRISIS_DETECTED,

    // The analysis layer explicitly asked for a person to look now.
    immediateReviewRequested && TRIGGER.IMMEDIATE_REVIEW_REQUESTED,

    // Intimidation reported on a matter where the docket already records
    // witness risk. This is the exact combination both models under-read.
    has(SIGNAL.INTIMIDATION) &&
      tags.includes(PRIORITY_USE_CASE.WITNESS_INTIMIDATION) &&
      TRIGGER.INTIMIDATION_ON_WITNESS_CASE,

    // Repeated untroubled replies while participation falls away. Catches the
    // deflection pattern that a per-message sentiment read cannot see.
    mismatchRun >= SUSTAINED_MISMATCH_RUN && TRIGGER.SUSTAINED_SURFACE_MISMATCH,

    // Expressed hopelessness together with withdrawal. Either alone is common;
    // together they mean the usual follow-up route may not reach this person.
    has(SIGNAL.HOPELESSNESS) && has(SIGNAL.DISENGAGEMENT) &&
      TRIGGER.HOPELESSNESS_WITH_DISENGAGEMENT,

    priorityAdjustedScore >= ESCALATION_THRESHOLD && TRIGGER.THRESHOLD_CROSSED,
  ].filter(Boolean);

  const triggerReasons = firings.map((code) => ({ code, label: TRIGGER_LABELS[code] }));

  return {
    baseScore,
    priorityWeight,
    priorityAdjustedScore,
    priorityLabel,
    threshold: ESCALATION_THRESHOLD,
    triggered: triggerReasons.length > 0,
    triggerReasons,
  };
}
