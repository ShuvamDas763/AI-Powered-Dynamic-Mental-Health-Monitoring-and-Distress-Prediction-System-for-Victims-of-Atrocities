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

export const counsellorRouter = Router();

// Router-level guard: applies to EVERY route below, including ones added later.
counsellorRouter.use(requireIdentifiedDataAccess);

/**
 * Case queue, ranked by distress score x priority-use-case weighting.
 *
 * Returns a list of cases with their latest assessment, sorted for a
 * counsellor's attention: escalated cases first, then by priority-adjusted
 * score.
 */
counsellorRouter.get('/cases', (req, res) => {
  const queue = store.prioritisedQueue();
  const cases = queue.map((row) => ({
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
    assessment: row.assessment
      ? {
          score: row.assessment.score,
          band: row.assessment.band,
          escalated: row.assessment.escalation.triggered,
          triggerReasons: row.assessment.escalation.triggerReasons,
          priorityAdjustedScore: row.assessment.escalation.priorityAdjustedScore,
          trendDirection: row.assessment.trend.direction,
        }
      : null,
  }));
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

  res.json({
    caseRecord,
    checkIns,
    trendData,
    latest,
  });
});

/**
 * Cases that have crossed a risk threshold and need human review.
 */
counsellorRouter.get('/alerts', (req, res) => {
  const alerts = store.alerts();
  res.json({
    alerts: alerts.map((row) => ({
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
      },
      checkInCount: row.checkInCount,
    })),
  });
});
