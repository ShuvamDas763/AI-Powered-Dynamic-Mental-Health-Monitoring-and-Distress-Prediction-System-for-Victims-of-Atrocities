/**
 * Check-in route — the victim-facing conversation endpoint.
 *
 * This is the only route that writes to the store and triggers a live
 * (or cached-fallback) LLM call. It accepts a check-in conversation,
 * analyses it through the LLM pipeline, records the check-in with its
 * assessment, and returns the result.
 *
 * The route is self-scoped: the victim session can only submit check-ins
 * for their own case. In this prototype the case is implied by the session;
 * a production system would authenticate the victim separately.
 *
 * CONTENT RULES
 * -------------------------------------------------------------------------
 * The LLM analysis is wrapped by the same content-safety patterns used
 * everywhere else. The moderation pass runs on generated explanation text
 * before it is returned to the client.
 */

import { Router } from 'express';
import { requireVictim } from '../access/requireRole.js';
import { store } from '../store/memoryStore.js';
import { analyseCheckIn, generateFollowUp, generateCrisisFollowUp } from '../llm/groqClient.js';
import { SPEAKER } from '../domain/records.js';
import { detectCrisisInCheckIn } from '../safety/crisisDetection.js';
import { getCrisisResponse } from '../safety/crisisResponse.js';

export const checkinRouter = Router();

// Only the victim role may submit check-ins. Counsellors and admins READ
// case data through their own tiered routes; they never write check-in
// entries on a victim's behalf. This enforces the two-tier model in both
// directions: reads AND writes.
checkinRouter.use(requireVictim);

/**
 * Submit a check-in conversation for a specific case.
 *
 * Body:
 *   caseId: string — which case this check-in belongs to
 *   turns: Array<{ speaker: 'system'|'person', text: string }> — the conversation
 *   locale: string (optional) — 'en' or 'hi'
 *   channel: string (optional) — 'app', 'web', 'sms', 'ivrs'
 */
checkinRouter.post('/', async (req, res) => {
  const { caseId, turns, locale, channel, consentAcknowledged } = req.body ?? {};

  if (!caseId || !Array.isArray(turns) || turns.length === 0) {
    return res.status(400).json({
      error: 'Please provide a caseId and at least one turn in the conversation.',
    });
  }

  // Verify the case exists.
  const caseRecord = store.getCase(caseId);
  if (!caseRecord) {
    return res.status(404).json({ error: 'Case not found.' });
  }

  // Self-scoping: the victim can only submit check-ins for their own case.
  // req.victimUsername is set by requireVictim above.
  if (!store.isOwnedBy(caseId, req.victimUsername)) {
    return res.status(403).json({ error: 'You can only submit check-ins for your own case.' });
  }

  // ── DUAL-ROUTE CRISIS DETECTION ──────────────────────────────────────────
  // Route 1 (Deterministic Pattern Engine): Fast regex check that guarantees
  // hard triggers fire even if offline, rate-limited, or in cached-fallback.
  const patternCrisis = detectCrisisInCheckIn(turns);

  // Check if a crisis referral was already delivered in a previous system turn.
  // This distinguishes Turn 1 (initial crisis trigger -> deliver Tele-MANAS referral)
  // from Turns 2+ (ongoing in-crisis dialogue -> deliver context-aware de-escalation
  // rather than looping the identical canned response).
  const hasPriorCrisisReferral = turns.some(
    (t) => (t.speaker === SPEAKER.SYSTEM || t.speaker === 'system') && (
      (typeof t.text === 'string' && (
        t.text.includes('Tele-MANAS') ||
        t.text.includes('14416') ||
        t.text.includes('1-800-891-4416') ||
        t.text.includes('टोल-फ़्री')
      ))
    ),
  );

  // Run the LLM analysis on the conversation.
  const analysis = await analyseCheckIn({ turns, locale: locale ?? 'en' });

  // Route 2 (Semantic AI Classifier): Deep intent & metaphor comprehension.
  // Catches indirect self-harm ideation, veiled thoughts of death, or novel
  // despair that do not match fixed regex keywords.
  const isSemanticCrisis = analysis.crisisDetected === true || (
    analysis.surfaceSentiment >= 85 && analysis.signals.includes('hopelessness')
  );

  const crisisTriggered = patternCrisis.triggered || isSemanticCrisis;
  const crisisCategory = patternCrisis.category || 'explicit_intent';
  const crisisCategoryLabel = patternCrisis.categoryLabel || 'Semantic self-harm or acute crisis detected by AI';
  const crisisUrgency = patternCrisis.urgency || (analysis.surfaceSentiment >= 90 ? 'critical' : 'high');
  const crisisMatchedText = patternCrisis.matchedText || analysis.signalPhrases?.[0] || 'Semantic crisis evaluation';

  const crisisResult = {
    triggered: crisisTriggered,
    category: crisisCategory,
    categoryLabel: crisisCategoryLabel,
    urgency: crisisUrgency,
    matchedText: crisisMatchedText,
  };

  // Record the check-in with the LLM's reading, plus crisis metadata if detected.
  const assessment = store.appendCheckIn(caseId, {
    turns: turns.map((t) => ({
      speaker: t.speaker === SPEAKER.SYSTEM ? SPEAKER.SYSTEM : SPEAKER.PERSON,
      text: String(t.text ?? ''),
    })),
    locale: locale ?? 'en',
    channel: channel ?? 'app',
    surfaceSentiment: crisisResult.triggered ? Math.max(95, analysis.surfaceSentiment) : analysis.surfaceSentiment,
    signals: analysis.signals,
    signalPhrases: analysis.signalPhrases,
    immediateReviewRequested: crisisResult.triggered ? true : false,
    provenance: analysis.provenance.source,
    consentAcknowledged: consentAcknowledged === true,
    crisisDetected: crisisResult.triggered,
    crisisMetadata: crisisResult.triggered ? {
      category: crisisResult.category,
      categoryLabel: crisisResult.categoryLabel,
      urgency: crisisResult.urgency,
      matchedText: crisisResult.matchedText,
    } : null,
  });

  // Generate a follow-up:
  // - If crisis triggered for the FIRST time: deliver initial Tele-MANAS referral + support notice.
  // - If crisis was ALREADY referred: deliver context-aware de-escalation & active listening.
  // - Otherwise: normal conversational follow-up.
  let followUp;
  let crisisResponse = null;

  if (crisisResult.triggered) {
    const effectiveLocale = locale ?? caseRecord.preferredLocale ?? 'en';
    const response = getCrisisResponse(effectiveLocale, crisisResult.category);

    if (!hasPriorCrisisReferral) {
      // Stage 1: Initial Crisis Trigger — authoritative QPR referral
      followUp = response.steps.join('\n\n');
      crisisResponse = {
        triggered: true,
        ongoing: false,
        category: crisisResult.category,
        categoryLabel: crisisResult.categoryLabel,
        urgency: crisisResult.urgency,
        matchedText: crisisResult.matchedText,
        helpline: response.helpline,
        counsellorNote: response.counsellorNote,
      };
    } else {
      // Stage 2: Ongoing in-crisis conversation — empathetic de-escalation & active listening
      followUp = await generateCrisisFollowUp({
        turns,
        locale: effectiveLocale,
        category: crisisResult.category,
      });
      crisisResponse = {
        triggered: true,
        ongoing: true,
        category: crisisResult.category,
        categoryLabel: crisisResult.categoryLabel,
        urgency: crisisResult.urgency,
        matchedText: crisisResult.matchedText,
        helpline: response.helpline,
        counsellorNote: response.counsellorNote,
      };
    }
  } else {
    const effectiveLocale = locale ?? caseRecord.preferredLocale ?? 'en';
    followUp = await generateFollowUp({ turns, locale: effectiveLocale });
  }

  // Create a notification for the victim that their check-in was received.
  store.addNotification(req.victimUsername, {
    caseId,
    type: 'checkin_received',
    message: 'Your check-in has been received and is being reviewed.',
  });

  res.json({
    ok: true,
    assessment,
    analysis: {
      notes: analysis.notes,
      provenance: analysis.provenance,
    },
    followUp,
    ...(crisisResponse && { crisisResponse }),
  });
});

/**
 * Get the check-in prompts available for a case, in the preferred language.
 * This is a convenience endpoint for the chatbot UI to know what to ask.
 */
checkinRouter.get('/prompts/:caseId', (req, res) => {
  const { caseId } = req.params;
  const caseRecord = store.getCase(caseId);
  if (!caseRecord) {
    return res.status(404).json({ error: 'Case not found.' });
  }

  const locale = caseRecord.preferredLocale ?? 'en';
  const prompts = {
    en: [
      'How have things been since we last checked in?',
      'Is there anything you would like someone to help with?',
      'How has this week been for you?',
    ],
    hi: [
      'पिछली बार बात होने के बाद से चीज़ें कैसी रहीं?',
      'क्या कुछ ऐसा है जिसमें आप मदद चाहेंगे?',
      'इस हफ़्ते आपके लिए कैसा रहा?',
    ],
  };

  res.json({
    caseId,
    locale,
    prompts: prompts[locale] ?? prompts.en,
  });
});
