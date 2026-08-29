/**
 * Intervention recommendation mapping — Research-Grounded v1.
 *
 * WHAT THIS IS
 * ---------------------------------------------------------------------------
 * A deterministic lookup: given a distress band and the case's priority-use-case
 * tags, return a list of recommended actions. No LLM involved — this is a
 * table that a counsellor or policy team can review, edit, and audit.
 *
 * STRUCTURE
 * ---------------------------------------------------------------------------
 * The table has three layers:
 *
 *   1. BAND-BASED recommendations — apply to every case in that band, regardless
 *      of category. These are the baseline support actions.
 *
 *   2. TAG-BASED recommendations — apply when a specific priority-use-case tag
 *      is present (e.g. witness intimidation, caste-based violence). These
 *      override or supplement the band-level actions.
 *
 *   3. SIGNAL-BASED recommendations — fire when specific LLM-reported signals
 *      are present in the recent window (e.g. economic_pressure → financial
 *      aid referral). These are the most targeted.
 *
 * The final list is band ∪ tag ∪ signal, deduplicated by action code.
 *
 * FRAMING RULE
 * ---------------------------------------------------------------------------
 * Every recommendation is phrased as a referral or flag, never as if the system
 * itself is providing the service. "Flagged for Witness Protection Cell
 * referral" not "Witness protection arranged." This matches the human-in-the-
 * loop principle established for escalation.
 *
 * REAL-WORLD BASIS
 * ---------------------------------------------------------------------------
 * Recommendations are tied to citable Indian government schemes and legal
 * provisions (see docs/intervention-table.md for full references). This is
 * a prototype artifact, not a clinically or legally certified tool — the
 * research team must review before this is called final.
 *
 * WHY NOT AN LLM CALL
 * ---------------------------------------------------------------------------
 * A prompt asking "what intervention should be recommended?" would produce
 * plausible-sounding but inconsistent advice across calls. A table is
 * inspectable, testable, and auditable — the same inputs always produce the
 * same output. The model's job is reading the words; the table's job is
 * deciding what to do about them.
 */

import { BAND } from './distressScore.js';
import { PRIORITY_USE_CASE } from './priorityWeighting.js';
import { SIGNAL } from './escalation.js';

/**
 * Urgency tiers for recommended actions.
 *
 * NOT a risk band — this tells a counsellor how soon to act on the
 * recommendation, not how severe the person's situation is.
 */
export const URGENCY = Object.freeze({
  /** Act within the current session or next business day. */
  IMMEDIATE: 'immediate',
  /** Schedule within the current week. */
  THIS_WEEK: 'this_week',
  /** Include in the regular case review cycle. */
  NEXT_REVIEW: 'next_review',
});

/**
 * Action codes — stable identifiers for each recommended action.
 *
 * Kept short and machine-readable so the API and UI can key on them.
 * Human-readable labels live in the table below.
 */
export const ACTION = Object.freeze({
  COUNSELLING_REFERRAL: 'counselling_referral',
  COUNSELLING_FOLLOWUP: 'counselling_followup',
  WITNESS_PROTECTION: 'witness_protection',
  LEGAL_AID: 'legal_aid',
  FINANCIAL_AID: 'financial_aid',
  REHABILITATION_SUPPORT: 'rehabilitation_support',
  SOCIAL_SUPPORT: 'social_support',
  MEDICAL_REFERRAL: 'medical_referral',
  SAFE_HOUSING: 'safe_housing',
  REGULAR_CHECKIN: 'regular_checkin',
  CASE_EXPEDITING: 'case_expediting',
  COMMUNITY_LIAISON: 'community_liaison',
  ONE_STOP_CENTRE: 'one_stop_centre',
  CASE_STATUS_UPDATE: 'case_status_update',
});

/**
 * The mapping table.
 *
 * Each entry: { match, actions } where:
 *   match — a predicate over the assessment context
 *   actions — array of { code, label, description, urgency }
 *
 * BAND-BASED: baseline by distress level, regardless of category.
 */
const BAND_TABLE = [
  {
    band: BAND.LOW,
    actions: [
      { code: ACTION.REGULAR_CHECKIN, label: 'Continue routine check-ins', description: 'No mandatory intervention. Maintain current check-in schedule and monitor for changes.', urgency: URGENCY.NEXT_REVIEW },
    ],
  },
  {
    band: BAND.MODERATE,
    actions: [
      { code: ACTION.COUNSELLING_FOLLOWUP, label: 'Flag for counselling follow-up', description: 'A brief follow-up session to discuss current wellbeing and any emerging concerns.', urgency: URGENCY.THIS_WEEK },
      { code: ACTION.REGULAR_CHECKIN, label: 'Increase check-in frequency', description: 'Consider moving to more frequent check-ins to track any changes.', urgency: URGENCY.NEXT_REVIEW },
    ],
  },
  {
    band: BAND.ELEVATED,
    actions: [
      { code: ACTION.COUNSELLING_REFERRAL, label: 'Refer to counselling service', description: 'A dedicated counselling session to address the elevated support signals.', urgency: URGENCY.THIS_WEEK },
      { code: ACTION.CASE_EXPEDITING, label: 'Flag for case-status review', description: 'Review whether procedural delays are contributing to distress. Request case-status update from DLSA/Special Court.', urgency: URGENCY.THIS_WEEK },
    ],
  },
  {
    band: BAND.HIGH,
    actions: [
      { code: ACTION.COUNSELLING_REFERRAL, label: 'Urgent counselling referral', description: 'Immediate counselling session required given the high support signal level.', urgency: URGENCY.IMMEDIATE },
      { code: ACTION.MEDICAL_REFERRAL, label: 'Medical referral if needed', description: 'If physical health concerns are reported, facilitate medical consultation.', urgency: URGENCY.THIS_WEEK },
    ],
  },
];

/**
 * TAG-BASED: research-grounded interventions by priority-use-case category.
 *
 * Each row maps to real Indian government schemes and legal provisions:
 *   - Witness Protection Scheme, 2018 (MHA/NALSA)
 *   - SC/ST (PoA) Rules, 1995 (Rule 12(4), Schedule Annex I/II)
 *   - Dr. Ambedkar National Relief Scheme
 *   - NALSA Compensation Scheme for Women Victims, 2018
 *   - One Stop Centre scheme
 *   - SC/ST (PoA) Act, Section 15A(6)
 */
const TAG_TABLE = {
  /**
   * Witness intimidation — HIGH/URGENT.
   * Explicit fear, surveillance, or threat language.
   * Basis: Witness Protection Scheme, 2018 (MHA/NALSA).
   * Three threat categories: A (life), B (safety/reputation/property),
   * C (moderate — harassment/intimidation).
   */
  [PRIORITY_USE_CASE.WITNESS_INTIMIDATION]: [
    { code: ACTION.WITNESS_PROTECTION, label: 'Flagged for Witness Protection Cell referral', description: 'Refer for Threat Analysis Report and Category A/B threat assessment under the Witness Protection Scheme, 2018.', urgency: URGENCY.IMMEDIATE },
    { code: ACTION.COUNSELLING_REFERRAL, label: 'Urgent trauma counselling referral', description: 'Crisis-oriented, trauma-informed counselling session.', urgency: URGENCY.IMMEDIATE },
    { code: ACTION.LEGAL_AID, label: 'Legal aid coordination via DLSA', description: 'DLSA coordination to notify the Investigating Officer and Special Court of the safety concern.', urgency: URGENCY.IMMEDIATE },
  ],

  /**
   * Sexual assault case category — HIGH/URGENT.
   * Withdrawal from check-ins, privacy requests, hesitancy with court content.
   * Basis: NALSA Compensation Scheme 2018; One Stop Centre scheme;
   * SC/ST PoA Rules 1995 Schedule.
   */
  [PRIORITY_USE_CASE.SEXUAL_ASSAULT]: [
    { code: ACTION.ONE_STOP_CENTRE, label: 'Flagged for One Stop Centre referral', description: 'Referral to nearest One Stop Centre providing co-located medical care, counselling, legal aid, and temporary shelter.', urgency: URGENCY.IMMEDIATE },
    { code: ACTION.COUNSELLING_REFERRAL, label: 'Urgent trauma counselling referral', description: 'Trauma-informed counselling. Female counsellor to be offered where requested.', urgency: URGENCY.IMMEDIATE },
    { code: ACTION.LEGAL_AID, label: 'Legal aid via NALSA Compensation Scheme', description: 'Support applying under NALSA\'s 2018 Compensation Scheme for Women Victims/Survivors of Sexual Assault.', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.FINANCIAL_AID, label: 'Financial assistance — staged relief eligibility', description: 'Flag eligibility for immediate staged relief under SC/ST PoA Rules Rule 12(4) Schedule, plus possible Dr. Ambedkar National Relief top-up (up to ₹5 lakh for heinous offences).', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.REHABILITATION_SUPPORT, label: 'Rehabilitation measures eligibility check', description: 'Socio-economic rehabilitation package: housing, land/house-site allotment, employment scheme, pension for dependants.', urgency: URGENCY.THIS_WEEK },
  ],

  /**
   * Murder / grievous hurt / arson — MODERATE to HIGH.
   * Financial-hardship language, compensation queries, displacement/rebuilding.
   * Basis: SC/ST PoA Rules 1995 (Rule 12(4), Schedule Annex I/II);
   * Dr. Ambedkar National Relief Scheme.
   */
  [PRIORITY_USE_CASE.GRAVE_OFFENCE]: [
    { code: ACTION.FINANCIAL_AID, label: 'Financial assistance — staged relief eligibility', description: 'Flag eligibility for staged relief (amounts vary by offence type under Rule 12(4)) plus possible Dr. Ambedkar National Relief top-up (up to ₹5 lakh for heinous offences).', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.REHABILITATION_SUPPORT, label: 'Rehabilitation measures eligibility check', description: 'Socio-economic rehabilitation package: housing, land/house-site allotment, employment scheme, pension for dependants.', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.COUNSELLING_FOLLOWUP, label: 'Counselling — grief and loss support', description: 'Supportive counselling focused on grief, loss, and rebuilding stress.', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.LEGAL_AID, label: 'Legal aid — DLSA relief disbursement tracking', description: 'DLSA coordination to track relief and compensation disbursement timeline.', urgency: URGENCY.THIS_WEEK },
  ],

  /**
   * Caste-based violence (social ostracism pattern) — MODERATE.
   * Social ostracism themes, declining engagement, isolation signals.
   * Basis: SC/ST PoA Rules 1995 rehabilitation provisions.
   */
  [PRIORITY_USE_CASE.CASTE_VIOLENCE_FAMILY]: [
    { code: ACTION.COUNSELLING_FOLLOWUP, label: 'Counselling — social reintegration support', description: 'Supportive counselling focused on social reintegration and addressing isolation.', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.REHABILITATION_SUPPORT, label: 'Rehabilitation measures eligibility check', description: 'Socio-economic rehabilitation package eligibility assessment.', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.LEGAL_AID, label: 'Legal aid — case-progress transparency', description: 'Request case-status update to reduce uncertainty-driven distress. DLSA coordination.', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.COMMUNITY_LIAISON, label: 'Community liaison', description: 'Engage local community leaders to address social ostracism.', urgency: URGENCY.THIS_WEEK },
  ],
};

/**
 * SIGNAL-BASED: research-grounded interventions by LLM-reported signal.
 *
 * These fire when specific signals are present in the recent check-in window
 * (last 3 check-ins, per assessCase.js RECENT_SIGNAL_WINDOW).
 */
const SIGNAL_TABLE = {
  /**
   * Economic pressure — money, work, or housing pressure.
   * Maps to: staged relief eligibility + Dr. Ambedkar National Relief.
   */
  [SIGNAL.ECONOMIC_PRESSURE]: [
    { code: ACTION.FINANCIAL_AID, label: 'Financial assistance referral', description: 'Flag eligibility for staged relief (amounts vary by offence type under Rule 12(4)) plus possible Dr. Ambedkar National Relief top-up.', urgency: URGENCY.THIS_WEEK },
  ],

  /**
   * Social isolation — being cut off or avoided by the surrounding community.
   * Maps to: social support + community liaison.
   */
  [SIGNAL.SOCIAL_ISOLATION]: [
    { code: ACTION.SOCIAL_SUPPORT, label: 'Social support network referral', description: 'Engage community support workers to address isolation and exclusion.', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.COMMUNITY_LIAISON, label: 'Community liaison', description: 'Engage local community leaders to address social ostracism.', urgency: URGENCY.THIS_WEEK },
  ],

  /**
   * Hopelessness — expressed sense that nothing will change or improve.
   * Maps to: counselling specific to case fatigue.
   * Legal basis: SC/ST (PoA) Act, Section 15A(6) — special court's duty
   * to ensure timeline compliance. Requesting a case-status update is a
   * legitimate intervention, not just placation.
   */
  [SIGNAL.HOPELESSNESS]: [
    { code: ACTION.COUNSELLING_REFERRAL, label: 'Counselling for hopelessness', description: 'Supportive counselling session addressing expressed hopelessness. Include case-status update request to reduce uncertainty.', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.CASE_STATUS_UPDATE, label: 'Flagged for case-status update', description: 'Request case-status update from DLSA/Special Court under Section 15A(6) of the SC/ST (PoA) Act.', urgency: URGENCY.THIS_WEEK },
  ],

  /**
   * Process fatigue — exhaustion from delays, adjournments, appearances.
   * Maps to: case-status update + counselling.
   * Legal basis: SC/ST (PoA) Act, Section 15A(6).
   */
  [SIGNAL.PROCESS_FATIGUE]: [
    { code: ACTION.CASE_STATUS_UPDATE, label: 'Flagged for case-status update', description: 'Request case-status update from DLSA/Special Court. Section 15A(6) places a duty on the Special Court to ensure relief/compensation timelines are met.', urgency: URGENCY.THIS_WEEK },
    { code: ACTION.COUNSELLING_FOLLOWUP, label: 'Counselling — process fatigue support', description: 'Supportive check-in specific to case fatigue and repeated adjournments.', urgency: URGENCY.THIS_WEEK },
  ],

  /**
   * Deflection — surface-positive language paired with declining engagement.
   * Maps to: gentle re-engagement counselling.
   * Trauma-informed principle: surface coping language often masks avoidance,
   * not resolution. Do not let positive wording alone suppress an escalation
   * that other signals support.
   */
  [SIGNAL.DEFLECTION]: [
    { code: ACTION.COUNSELLING_FOLLOWUP, label: 'Gentle re-engagement check', description: 'Brief, supportive counselling check-in. Not urgent unless the mismatch persists or worsens over subsequent check-ins — in which case escalate to urgent counselling.', urgency: URGENCY.THIS_WEEK },
  ],

  /**
   * Disengagement — withdrawing from contact or from the process.
   * Maps to: counselling re-engagement.
   */
  [SIGNAL.DISENGAGEMENT]: [
    { code: ACTION.COUNSELLING_FOLLOWUP, label: 'Counselling — re-engagement support', description: 'Brief check-in to understand barriers to participation and offer support.', urgency: URGENCY.THIS_WEEK },
  ],

  /**
   * Intimidation — being watched, followed, or approached about the matter.
   * Maps to: witness protection (handled by TAG_TABLE for witness cases,
   * but also fires here for non-witness cases that carry intimidation signals).
   */
  [SIGNAL.INTIMIDATION]: [
    { code: ACTION.WITNESS_PROTECTION, label: 'Flagged for safety assessment', description: 'Safety concern reported. Refer for assessment under the Witness Protection Scheme, 2018.', urgency: URGENCY.IMMEDIATE },
  ],
};

/**
 * Given an assessment context, return the recommended interventions.
 *
 * @param {{ band: string, priorityTags?: string[], signals?: string[] }} context
 * @returns {Array<{ code: string, label: string, description: string, urgency: string }>}
 */
export function recommendInterventions(context) {
  const ctx = context ?? {};
  const band = ctx.band ?? BAND.MODERATE;
  const tags = Array.isArray(ctx.priorityTags) ? ctx.priorityTags : [];
  const signals = Array.isArray(ctx.signals) ? ctx.signals : [];

  const byCode = new Map();

  // Layer 1: band-based
  const bandEntry = BAND_TABLE.find((e) => e.band === band);
  if (bandEntry) {
    for (const action of bandEntry.actions) {
      byCode.set(action.code, action);
    }
  }

  // Layer 2: tag-based
  for (const tag of tags) {
    const tagActions = TAG_TABLE[tag];
    if (tagActions) {
      for (const action of tagActions) {
        if (!byCode.has(action.code)) {
          byCode.set(action.code, action);
        }
      }
    }
  }

  // Layer 3: signal-based
  for (const signal of signals) {
    const signalActions = SIGNAL_TABLE[signal];
    if (signalActions) {
      for (const action of signalActions) {
        if (!byCode.has(action.code)) {
          byCode.set(action.code, action);
        }
      }
    }
  }

  // Sort by urgency: immediate first, then this_week, then next_review.
  const urgencyOrder = { [URGENCY.IMMEDIATE]: 0, [URGENCY.THIS_WEEK]: 1, [URGENCY.NEXT_REVIEW]: 2 };
  return [...byCode.values()].sort(
    (a, b) => (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9),
  );
}
