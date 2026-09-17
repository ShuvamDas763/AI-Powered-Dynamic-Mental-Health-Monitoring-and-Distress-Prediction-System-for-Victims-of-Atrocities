/**
 * TIER 1 — individual-level (identified) case data.
 *
 * Every route in this file may return data about one identifiable person.
 * The router-level guard below is what keeps that true: it applies to every
 * route added to this router, so a new endpoint cannot be added here and
 * accidentally ship unguarded.
 *
 * Do not add aggregate/statistical endpoints here, and do not add
 * individual-level endpoints to `admin.js`. Keeping the two files strictly
 * single-tier is what makes the separation reviewable by reading the routes.
 */

import { Router } from 'express';
import { requireIdentifiedDataAccess } from '../access/requireRole.js';
import { store } from '../store/memoryStore.js';
import { BAND } from '../domain/distressScore.js';
import { SIGNAL, SIGNAL_LABELS, TRIGGER } from '../domain/escalation.js';
import { PRIORITY_USE_CASE } from '../domain/priorityWeighting.js';
import { INTERVENTION_STATUS, INTERVENTION_OUTCOME, transitionIntervention } from '../domain/interventions.js';

export const counsellorRouter = Router();

// Router-level guard: applies to EVERY route below, including ones added later.
counsellorRouter.use(requireIdentifiedDataAccess);

/**
 * Generate clear, transparent human reasons for why a case requires counsellor attention.
 */
function buildWhyThisCaseIsHere(caseRecord, assessment, history = [], outreach = null, intvs = []) {
  const reasons = [];
  if (!assessment) return reasons;

  // 1. Escalation rule reasons
  if (assessment.escalation?.triggered && Array.isArray(assessment.escalation.triggerReasons)) {
    for (const r of assessment.escalation.triggerReasons) {
      if (r === 'intimidation_on_witness_case') {
        reasons.push('Reported intimidation signal on an active witness docket');
      } else if (r === 'sustained_surface_mismatch') {
        reasons.push('Sustained mismatch between reassuring words and declining engagement (deflection)');
      } else if (r === 'threshold_crossed') {
        reasons.push(`Crossed support-review threshold (distress score: ${assessment.score})`);
      } else if (r === 'immediate_review_requested') {
        reasons.push('Complainant directly requested counsellor contact');
      } else {
        reasons.push(r);
      }
    }
  }

  // 2. Early-warning trajectory
  const traj = assessment.prediction;
  if (traj?.projected) {
    const min = traj.estimatedWindowDays?.min ?? traj.estimatedDaysToThreshold;
    const max = traj.estimatedWindowDays?.max ?? (min + 7);
    reasons.push(`Rising trajectory: projected review window in approximately ${min}–${max} days`);
    if (traj.courtDateOverlap) {
      reasons.push(`Next hearing date (${caseRecord.nextHearingDate}) overlaps projected review window`);
    }
  }

  // 3. Missed check-in patterns
  const missedCount = history.filter((c) => c.status === 'missed').length;
  if (missedCount >= 2) {
    reasons.push(`${missedCount} missed check-ins recorded in recent history`);
  }

  // 4. Overdue interventions
  const overdueCount = intvs.filter((i) => i.status !== 'COMPLETED' && i.status !== 'CLOSED' && i.dueAt && new Date(i.dueAt) < new Date()).length;
  if (overdueCount > 0) {
    reasons.push(`${overdueCount} recommended intervention(s) overdue for action`);
  }

  // Default if list is empty
  if (reasons.length === 0) {
    if (assessment.band === 'high' || assessment.band === 'elevated') {
      reasons.push(`Elevated support band (${assessment.band}) under continuous welfare monitoring`);
    } else {
      reasons.push('Routine case check-in review');
    }
  }

  return reasons;
}

/**
 * Derive operational workflow status for case triage.
 */
function deriveOperationalStatus(assessment, intvs = []) {
  if (intvs.some((i) => i.status === 'ASSIGNED')) return 'intervention_assigned';
  if (intvs.some((i) => i.status === 'FOLLOW_UP_DUE')) return 'follow_up_due';
  if (intvs.some((i) => i.status === 'CONTACTED')) return 'contacted';
  if (intvs.every((i) => i.status === 'COMPLETED' || i.status === 'CLOSED') && intvs.length > 0) return 'resolved';
  if (assessment?.escalation?.triggered) return 'under_review';
  return 'new';
}

/**
 * Case queue, ranked by distress score x priority-use-case weighting.
 *
 * Returns a list of cases with their latest assessment, sorted for a
 * counsellor's attention: escalated cases first, then by priority-adjusted
 * score.
 */
counsellorRouter.get('/cases', (req, res) => {
  const queue = store.prioritisedQueue();
  const cases = queue.map((row) => {
    const history = store.getHistory(row.caseRecord.caseId);
    const outreach = store.getOutreachSchedule(row.caseRecord.caseId);
    const intvs = store.getInterventions(row.caseRecord.caseId);
    const activeIntvs = intvs.filter((i) => i.status !== 'COMPLETED' && i.status !== 'CLOSED' && i.status !== 'DECLINED');
    const overdueIntvs = activeIntvs.filter((i) => i.dueAt && new Date(i.dueAt) < new Date());

    return {
      caseId: row.caseRecord.caseId,
      pseudonym: row.caseRecord.pseudonym,
      district: row.caseRecord.district,
      state: row.caseRecord.state,
      caseStage: row.caseRecord.caseStage,
      monthsSinceRegistration: row.caseRecord.monthsSinceRegistration,
      priorityTags: row.caseRecord.priorityTags,
      preferredLocale: row.caseRecord.preferredLocale,
      contextNote: row.caseRecord.contextNote,
      checkInCount: row.checkInCount,
      nextCheckInDate: outreach?.nextCheckInDate ?? null,
      activeInterventionsCount: activeIntvs.length,
      overdueInterventionsCount: overdueIntvs.length,
      counsellorStatus: deriveOperationalStatus(row.assessment, intvs),
      whyThisCaseIsHere: buildWhyThisCaseIsHere(row.caseRecord, row.assessment, history, outreach, intvs),
      assessment: row.assessment
        ? {
            score: row.assessment.score,
            band: row.assessment.band,
            escalated: row.assessment.escalation.triggered,
            triggerReasons: row.assessment.escalation.triggerReasons,
            priorityAdjustedScore: row.assessment.escalation.priorityAdjustedScore,
            trendDirection: row.assessment.trend.direction,
            trajectory: row.assessment.prediction,
          }
        : null,
    };
  });
  res.json({ cases });
});

/**
 * One case: check-in history, scores with explanations, trend, interventions.
 *
 * The counsellor sees the full picture for one person: their check-in
 * conversation history, each distress score with the signals and components
 * that drove it, their trend line, and any recommended interventions.
 */
counsellorRouter.get('/cases/:caseId', (req, res) => {
  const { caseId } = req.params;
  const caseRecord = store.getCase(caseId);
  if (!caseRecord) {
    return res.status(404).json({ error: 'Case not found.' });
  }

  // Audit trail — log who viewed this case.
  store.logAccess({
    userId: req.session?.userId ?? 'unknown',
    role: req.session?.role ?? 'unknown',
    action: 'view_case',
    caseId,
  });

  const history = store.getHistory(caseId);
  const series = store.getAssessmentSeries(caseId);
  const latest = store.getLatestAssessment(caseId);

  // Build the trend data for the chart — one point per check-in.
  const trendData = series.map((assessment, index) => ({
    checkInNumber: index + 1,
    occurredAt: history[index]?.occurredAt ?? null,
    score: assessment.score,
    band: assessment.band,
    escalated: assessment.escalation.triggered,
    // Expose channel/locale so the client can flag non-comparable segments.
    channel: history[index]?.channel ?? null,
    locale: history[index]?.locale ?? null,
  }));

  // Map the full history into a counsellor-readable format.
  const checkIns = history.map((c, index) => ({
    id: c.id,
    sequence: c.sequence,
    occurredAt: c.occurredAt,
    status: c.status,
    channel: c.channel,
    locale: c.locale,
    wordCount: c.wordCount,
    responseLatencyHours: c.responseLatencyHours,
    surfaceSentiment: c.surfaceSentiment,
    surfaceSentimentCarriedForward: c.surfaceSentimentCarriedForward,
    signals: c.signals,
    signalPhrases: c.signalPhrases,
    immediateReviewRequested: c.immediateReviewRequested,
    provenance: c.provenance,
    consentAcknowledged: c.consentAcknowledged,
    // Include the turns for the counsellor to read.
    turns: c.turns.map((t) => ({ speaker: t.speaker, text: t.text })),
    // Attach the assessment for this check-in.
    assessment: series[index]
      ? {
          score: series[index].score,
          band: series[index].band,
          components: series[index].components,
          contributions: series[index].contributions,
          engagement: series[index].engagement,
          trend: series[index].trend,
          mismatch: series[index].mismatch,
          explanation: series[index].explanation,
          escalation: series[index].escalation,
          provenance: series[index].provenance,
        }
      : null,
  }));

  const outreach = store.getOutreachSchedule(caseId);
  const intvs = store.getInterventions(caseId);
  const activeIntvs = intvs.filter((i) => i.status !== 'COMPLETED' && i.status !== 'CLOSED' && i.status !== 'DECLINED');
  const overdueIntvs = activeIntvs.filter((i) => i.dueAt && new Date(i.dueAt) < new Date());

  res.json({
    caseRecord,
    checkIns,
    trendData,
    latest,
    interventions: intvs,
    outreachSchedule: outreach,
    nextCheckInDate: outreach?.nextCheckInDate ?? null,
    activeInterventionsCount: activeIntvs.length,
    overdueInterventionsCount: overdueIntvs.length,
    counsellorStatus: deriveOperationalStatus(latest, intvs),
    whyThisCaseIsHere: buildWhyThisCaseIsHere(caseRecord, latest, history, outreach, intvs),
  });
});

/**
 * Mark a case as reviewed — creates a notification for the victim.
 *
 * This is the counsellor-side of the feedback loop: when a welfare officer
 * reviews a case, the victim sees "Your check-in was reviewed." This closes
 * the gap where victims submit check-ins and never hear back.
 */
counsellorRouter.post('/cases/:caseId/review', (req, res) => {
  const { caseId } = req.params;
  const caseRecord = store.getCase(caseId);
  if (!caseRecord) {
    return res.status(404).json({ error: 'Case not found.' });
  }

  const { note } = req.body ?? {};
  const message = note
    ? `Your check-in was reviewed by a welfare officer. Note: ${note}`
    : 'Your check-in has been reviewed by a welfare officer. Thank you for sharing.';

  store.addNotification(caseRecord.victimUsername, {
    caseId,
    type: 'case_reviewed',
    message,
  });

  res.json({ ok: true });
});

/**
 * Cases that have crossed a risk threshold and need human review.
 */
counsellorRouter.get('/alerts', (req, res) => {
  const alerts = store.alerts();
  res.json({
    alerts: alerts.map((row) => {
      const history = store.getHistory(row.caseRecord.caseId);
      const outreach = store.getOutreachSchedule(row.caseRecord.caseId);
      const intvs = store.getInterventions(row.caseRecord.caseId);
      return {
        caseRecord: {
          caseId: row.caseRecord.caseId,
          pseudonym: row.caseRecord.pseudonym,
          district: row.caseRecord.district,
          state: row.caseRecord.state,
          caseStage: row.caseRecord.caseStage,
          priorityTags: row.caseRecord.priorityTags,
          contextNote: row.caseRecord.contextNote,
        },
        assessment: {
          score: row.assessment.score,
          band: row.assessment.band,
          priorityAdjustedScore: row.assessment.escalation.priorityAdjustedScore,
          triggerReasons: row.assessment.escalation.triggerReasons,
          trendDirection: row.assessment.trend.direction,
          trajectory: row.assessment.prediction,
        },
        checkInCount: row.checkInCount,
        nextCheckInDate: outreach?.nextCheckInDate ?? null,
        whyThisCaseIsHere: buildWhyThisCaseIsHere(row.caseRecord, row.assessment, history, outreach, intvs),
        counsellorStatus: deriveOperationalStatus(row.assessment, intvs),
      };
    }),
  });
});

/**
 * Get all closed-loop interventions for a case.
 */
counsellorRouter.get('/cases/:caseId/interventions', (req, res) => {
  const { caseId } = req.params;
  const caseRecord = store.getCase(caseId);
  if (!caseRecord) {
    return res.status(404).json({ error: 'Case not found.' });
  }

  const items = store.getInterventions(caseId);
  res.json({
    caseId,
    interventions: items,
    availableStatuses: Object.values(INTERVENTION_STATUS),
    availableOutcomes: Object.values(INTERVENTION_OUTCOME),
  });
});

/**
 * Perform a counsellor action on an intervention (accept, assign, contact, follow-up, complete, close).
 */
counsellorRouter.post('/cases/:caseId/interventions/:id/action', (req, res) => {
  const { caseId, id } = req.params;
  const { action, assignedOfficer, outcomeNote, outcomeCode, dueAt } = req.body ?? {};

  const items = store.getInterventions(caseId);
  const current = items.find((it) => it.id === id);
  if (!current) {
    return res.status(404).json({ error: `Intervention ${id} not found for case ${caseId}.` });
  }

  const actionToStatus = {
    accept: INTERVENTION_STATUS.ACCEPTED,
    assign: INTERVENTION_STATUS.ASSIGNED,
    contact: INTERVENTION_STATUS.CONTACTED,
    follow_up: INTERVENTION_STATUS.FOLLOW_UP_DUE,
    complete: INTERVENTION_STATUS.COMPLETED,
    decline: INTERVENTION_STATUS.DECLINED,
    close: INTERVENTION_STATUS.CLOSED,
  };

  const targetStatus = actionToStatus[action];
  if (!targetStatus) {
    return res.status(400).json({
      error: `Invalid intervention action: ${action}. Allowed: ${Object.keys(actionToStatus).join(', ')}`,
    });
  }

  try {
    const updated = transitionIntervention(current, targetStatus, {
      assignedOfficer,
      outcomeNote,
      outcomeCode,
      dueAt,
    });

    store.updateIntervention(id, updated);

    store.logAccess({
      userId: req.session?.userId ?? req.session?.user?.username ?? 'counsellor',
      role: req.session?.user?.role ?? 'counsellor',
      action: `intervention_${action}`,
      caseId,
      details: { interventionId: id, status: targetStatus, outcomeCode },
    });

    res.json({ ok: true, intervention: updated });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});
