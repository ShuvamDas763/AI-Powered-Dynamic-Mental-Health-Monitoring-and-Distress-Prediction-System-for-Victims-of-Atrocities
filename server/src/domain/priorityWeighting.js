/**
 * Priority use-case weighting.
 *
 * WHY THIS FILE EXISTS
 * -------------------------------------------------------------------------
 * A pre-build probe of both LLMs available on this account found that neither
 * escalated a witness-intimidation check-in on its own: one returned 55/100 and
 * one 45/100, both with "no immediate review needed". Spec Section 6 targets
 * that case as high/urgent.
 *
 * The lesson was not "pick a better model". It was that the *sensitivity of a
 * case category* is a policy fact, known from the docket before anyone reads a
 * single message — so it belongs in a table a human can inspect and a court can
 * audit, not in a model's judgement.
 *
 * Spec Section 5 already asked for this ("distress score x priority-use-case
 * weighting"). The probe just proved it is load-bearing.
 *
 * CONTENT-SAFETY NOTE
 * These tags classify a docket category in administrative language. They must
 * never describe an act. See the label test in priorityWeighting.test.js.
 */

/**
 * Priority use-case tags, from the official problem statement's "priority use
 * cases" list (spec Section 1).
 */
export const PRIORITY_USE_CASE = Object.freeze({
  /** Witness in an active matter, with intimidation or threat risk on record. */
  WITNESS_INTIMIDATION: 'witness_intimidation',
  /** Docket recorded under one of the grave-offence priority categories. */
  GRAVE_OFFENCE: 'grave_offence',
  /** Sexual assault case category — NALSA/One Stop Centre referral path. */
  SEXUAL_ASSAULT: 'sexual_assault',
  /** Family/household affected by caste-based violence (secondary victims). */
  CASTE_VIOLENCE_FAMILY: 'caste_violence_family',
  /** Baseline: every case in this system is an SC/ST (PoA) Act 1989 matter. */
  SC_ST_ACT_BENEFICIARY: 'sc_st_act_beneficiary',
});

/**
 * Multipliers applied to a distress score.
 *
 * INVARIANT: every weight is >= 1. Weighting may only raise urgency, never
 * lower it — a tag that could de-escalate a case would be actively dangerous
 * for this population. Enforced by a test.
 *
 * These values are deliberately modest (a 55 becomes a 72, not a 95). The
 * weighting is meant to correct a near-miss, not to manufacture a crisis. The
 * spec notes this table should be refined with the medical team.
 */
export const PRIORITY_WEIGHTS = Object.freeze({
  [PRIORITY_USE_CASE.WITNESS_INTIMIDATION]: 1.3,
  [PRIORITY_USE_CASE.GRAVE_OFFENCE]: 1.25,
  [PRIORITY_USE_CASE.SEXUAL_ASSAULT]: 1.25,
  [PRIORITY_USE_CASE.CASTE_VIOLENCE_FAMILY]: 1.15,
  [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY]: 1.0,
});

/** Plain-language labels, shown to a counsellor beside the adjusted score. */
const PRIORITY_LABELS = Object.freeze({
  [PRIORITY_USE_CASE.WITNESS_INTIMIDATION]:
    'Witness in an active matter, with intimidation risk recorded',
  [PRIORITY_USE_CASE.GRAVE_OFFENCE]:
    'Docket recorded under a grave-offence priority category',
  [PRIORITY_USE_CASE.SEXUAL_ASSAULT]:
    'Sexual assault case category — One Stop Centre referral path',
  [PRIORITY_USE_CASE.CASTE_VIOLENCE_FAMILY]:
    'Household affected by caste-based violence',
  [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY]:
    'SC/ST (PoA) Act 1989 matter — baseline sensitivity',
});

/** Weight applied when a case carries no recognised tag at all. */
const BASELINE_WEIGHT = 1;

/**
 * The weight for a set of tags.
 *
 * Takes the MAXIMUM rather than the product or sum. Summing would compound —
 * a case tagged three ways would be multiplied past 3x and read as a crisis on
 * classification alone, drowning out what the person actually said.
 *
 * Unrecognised tags are ignored rather than throwing, so a docket carrying a
 * category this prototype does not model still scores on its other evidence.
 */
export function priorityWeightForTags(tags) {
  if (!Array.isArray(tags)) return BASELINE_WEIGHT;
  const known = tags.map((t) => PRIORITY_WEIGHTS[t]).filter((w) => typeof w === 'number');
  return known.length ? Math.max(...known) : BASELINE_WEIGHT;
}

/**
 * The weight plus the tag and label that produced it.
 *
 * The explainability requirement applies to the weighting too: a counsellor
 * seeing an adjusted score must be able to see *which* case category raised it.
 */
export function describePriorityWeight(tags) {
  const weight = priorityWeightForTags(tags);
  const drivingTag = Array.isArray(tags)
    ? (tags.find((t) => PRIORITY_WEIGHTS[t] === weight) ?? null)
    : null;
  return {
    weight,
    drivingTag,
    label: drivingTag
      ? PRIORITY_LABELS[drivingTag]
      : 'No priority category recorded — baseline sensitivity',
  };
}
