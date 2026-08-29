import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { recommendInterventions, URGENCY, ACTION } from './interventions.js';
import { BAND } from './distressScore.js';
import { PRIORITY_USE_CASE } from './priorityWeighting.js';
import { SIGNAL } from './escalation.js';

describe('recommendInterventions', () => {
  test('low band returns only regular check-in', () => {
    const result = recommendInterventions({ band: BAND.LOW });
    assert.equal(result.length, 1);
    assert.equal(result[0].code, ACTION.REGULAR_CHECKIN);
    assert.equal(result[0].urgency, URGENCY.NEXT_REVIEW);
  });

  test('moderate band returns counselling follow-up and regular check-in', () => {
    const result = recommendInterventions({ band: BAND.MODERATE });
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_FOLLOWUP));
    assert.ok(result.some((r) => r.code === ACTION.REGULAR_CHECKIN));
  });

  test('elevated band returns counselling referral and case expediting', () => {
    const result = recommendInterventions({ band: BAND.ELEVATED });
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_REFERRAL));
    assert.ok(result.some((r) => r.code === ACTION.CASE_EXPEDITING));
  });

  test('high band returns urgent counselling and medical referral', () => {
    const result = recommendInterventions({ band: BAND.HIGH });
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_REFERRAL && r.urgency === URGENCY.IMMEDIATE));
    assert.ok(result.some((r) => r.code === ACTION.MEDICAL_REFERRAL));
  });

  test('witness intimidation tag adds witness protection, counselling, and legal aid', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION],
    });
    assert.ok(result.some((r) => r.code === ACTION.WITNESS_PROTECTION));
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_REFERRAL));
    assert.ok(result.some((r) => r.code === ACTION.LEGAL_AID));
    // Band-level actions still present
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_FOLLOWUP));
  });

  test('witness protection actions are immediate urgency', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      priorityTags: [PRIORITY_USE_CASE.WITNESS_INTIMIDATION],
    });
    const wp = result.find((r) => r.code === ACTION.WITNESS_PROTECTION);
    assert.equal(wp.urgency, URGENCY.IMMEDIATE, 'witness protection should be immediate');
  });

  test('sexual assault tag adds One Stop Centre, counselling, legal aid, financial aid, and rehabilitation', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      priorityTags: [PRIORITY_USE_CASE.SEXUAL_ASSAULT],
    });
    assert.ok(result.some((r) => r.code === ACTION.ONE_STOP_CENTRE));
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_REFERRAL));
    assert.ok(result.some((r) => r.code === ACTION.LEGAL_AID));
    assert.ok(result.some((r) => r.code === ACTION.FINANCIAL_AID));
    assert.ok(result.some((r) => r.code === ACTION.REHABILITATION_SUPPORT));
  });

  test('sexual assault One Stop Centre referral is immediate', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      priorityTags: [PRIORITY_USE_CASE.SEXUAL_ASSAULT],
    });
    const osc = result.find((r) => r.code === ACTION.ONE_STOP_CENTRE);
    assert.equal(osc.urgency, URGENCY.IMMEDIATE, 'One Stop Centre should be immediate');
  });

  test('grave offence tag adds financial aid, rehabilitation, counselling, and legal aid (not One Stop Centre)', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      priorityTags: [PRIORITY_USE_CASE.GRAVE_OFFENCE],
    });
    assert.ok(result.some((r) => r.code === ACTION.FINANCIAL_AID));
    assert.ok(result.some((r) => r.code === ACTION.REHABILITATION_SUPPORT));
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_FOLLOWUP));
    assert.ok(result.some((r) => r.code === ACTION.LEGAL_AID));
    assert.ok(!result.some((r) => r.code === ACTION.ONE_STOP_CENTRE),
      'grave offence (not sexual assault) should not get One Stop Centre');
  });

  test('caste violence family tag adds counselling, rehabilitation, legal aid, and community liaison', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      priorityTags: [PRIORITY_USE_CASE.CASTE_VIOLENCE_FAMILY],
    });
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_FOLLOWUP));
    assert.ok(result.some((r) => r.code === ACTION.REHABILITATION_SUPPORT));
    assert.ok(result.some((r) => r.code === ACTION.LEGAL_AID));
    assert.ok(result.some((r) => r.code === ACTION.COMMUNITY_LIAISON));
  });

  test('economic_pressure signal adds financial aid', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      signals: [SIGNAL.ECONOMIC_PRESSURE],
    });
    assert.ok(result.some((r) => r.code === ACTION.FINANCIAL_AID));
  });

  test('social_isolation signal adds social support and community liaison', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      signals: [SIGNAL.SOCIAL_ISOLATION],
    });
    assert.ok(result.some((r) => r.code === ACTION.SOCIAL_SUPPORT));
    assert.ok(result.some((r) => r.code === ACTION.COMMUNITY_LIAISON));
  });

  test('hopelessness signal adds counselling and case-status update', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      signals: [SIGNAL.HOPELESSNESS],
    });
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_REFERRAL));
    assert.ok(result.some((r) => r.code === ACTION.CASE_STATUS_UPDATE));
  });

  test('process_fatigue signal adds case-status update and counselling', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      signals: [SIGNAL.PROCESS_FATIGUE],
    });
    assert.ok(result.some((r) => r.code === ACTION.CASE_STATUS_UPDATE));
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_FOLLOWUP));
  });

  test('deflection signal adds gentle re-engagement check', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      signals: [SIGNAL.DEFLECTION],
    });
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_FOLLOWUP));
  });

  test('disengagement signal adds counselling re-engagement', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      signals: [SIGNAL.DISENGAGEMENT],
    });
    assert.ok(result.some((r) => r.code === ACTION.COUNSELLING_FOLLOWUP));
  });

  test('intimidation signal adds safety assessment (immediate)', () => {
    const result = recommendInterventions({
      band: BAND.MODERATE,
      signals: [SIGNAL.INTIMIDATION],
    });
    const wp = result.find((r) => r.code === ACTION.WITNESS_PROTECTION);
    assert.ok(wp, 'intimidation signal should trigger witness protection');
    assert.equal(wp.urgency, URGENCY.IMMEDIATE);
  });

  test('deduplicates by action code — band + tag + signal same code', () => {
    // COUNSELLING_REFERRAL appears in high band AND in grave_offence tag.
    // Should only appear once in the result.
    const result = recommendInterventions({
      band: BAND.HIGH,
      priorityTags: [PRIORITY_USE_CASE.GRAVE_OFFENCE],
    });
    const counsellingRefs = result.filter((r) => r.code === ACTION.COUNSELLING_REFERRAL);
    assert.equal(counsellingRefs.length, 1, 'counselling referral should be deduplicated');
  });

  test('results sorted by urgency: immediate first', () => {
    const result = recommendInterventions({
      band: BAND.HIGH,
      priorityTags: [PRIORITY_USE_CASE.GRAVE_OFFENCE],
      signals: [SIGNAL.ECONOMIC_PRESSURE],
    });
    const urgencies = result.map((r) => r.urgency);
    const immediateIdx = urgencies.indexOf(URGENCY.IMMEDIATE);
    const thisWeekIdx = urgencies.indexOf(URGENCY.THIS_WEEK);
    if (immediateIdx >= 0 && thisWeekIdx >= 0) {
      assert.ok(immediateIdx < thisWeekIdx, 'immediate actions should come before this_week');
    }
  });

  test('all actions have required fields', () => {
    const result = recommendInterventions({ band: BAND.HIGH });
    for (const action of result) {
      assert.ok(typeof action.code === 'string' && action.code.length > 0, 'action must have a code');
      assert.ok(typeof action.label === 'string' && action.label.length > 0, 'action must have a label');
      assert.ok(typeof action.description === 'string', 'action must have a description');
      assert.ok(Object.values(URGENCY).includes(action.urgency), `urgency must be valid: ${action.urgency}`);
    }
  });

  test('all recommendation labels use referral/flag framing, not provision framing', () => {
    // The system should never claim to provide services directly — it flags
    // and refers. This test catches labels that sound like the system itself
    // is doing the work.
    const allBands = [BAND.LOW, BAND.MODERATE, BAND.ELEVATED, BAND.HIGH];
    const allTags = Object.values(PRIORITY_USE_CASE);
    const allSignals = Object.values(SIGNAL);

    for (const band of allBands) {
      for (const tag of allTags) {
        for (const signal of allSignals) {
          const result = recommendInterventions({ band, priorityTags: [tag], signals: [signal] });
          for (const action of result) {
            // Labels should not contain provision verbs that imply the system
            // is providing the service directly. Referral/framing words are ok.
            const lower = action.label.toLowerCase();
            assert.ok(
              !lower.includes('arranged') && !lower.includes('provided'),
              `${action.code} label "${action.label}" sounds like the system is providing, not referring`,
            );
          }
        }
      }
    }
  });

  test('empty input degrades gracefully', () => {
    const result = recommendInterventions({});
    assert.ok(Array.isArray(result));
    // Should still return band-level recommendations for the default band
    assert.ok(result.length > 0);
  });

  test('null/undefined input degrades gracefully', () => {
    const result = recommendInterventions(null);
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);
  });
});
