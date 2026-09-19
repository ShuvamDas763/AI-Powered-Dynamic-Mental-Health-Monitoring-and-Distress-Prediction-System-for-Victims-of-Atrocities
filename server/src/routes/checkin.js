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
import { analysisProvider, generateFollowUp, generateCrisisFollowUp } from '../llm/groqClient.js';
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

  // ── STEP 1: DETERMINISTIC CRISIS EVALUATION (EMERGENCY SAFETY PATH) ─────
  // Route 1 (Deterministic Pattern Engine): Fast regex check that guarantees
  // hard triggers fire even if offline, rate-limited, or in cached-fallback.
  const patternCrisis = detectCrisisInCheckIn(turns);

  // Check if a crisis referral was already delivered in a previous system turn.
  // This distinguishes Turn 1 (initial crisis trigger -> deliver Tele-MANAS referral)
  // from Turns 2+ (ongoing in-crisis dialogue -> deliver context-aware de-escalation).
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

  // Check server-side consent record
  const consentRecord = store.getConsent(caseId);
  const isConsentActive = Boolean(
    consentRecord && !consentRecord.revokedAt && consentRecord.purposes?.monitoring === true,
  );

  // EMERGENCY LIFE-SAFETY OVERRIDE:
  // Emergency life-safety crisis response triggers regardless of routine monitoring consent state.
  // A missing routine monitoring consent record must NEVER block emergency intervention.
  if (patternCrisis.triggered) {
    const crisisResult = {
      triggered: true,
      category: patternCrisis.category || 'explicit_intent',
      categoryLabel: patternCrisis.categoryLabel || 'Immediate safety crisis detected',
      urgency: patternCrisis.urgency || 'critical',
      matchedText: patternCrisis.matchedText || 'Crisis expression',
    };

    const effectiveLocale = locale ?? caseRecord.preferredLocale ?? 'en';
    const response = getCrisisResponse(effectiveLocale, crisisResult.category);
    let followUp;

    if (!hasPriorCrisisReferral) {
      // Stage 1: Initial Crisis Trigger — authoritative QPR referral
      followUp = response.steps.join('\n\n');
    } else {
      // Stage 2: Ongoing in-crisis conversation — empathetic de-escalation & active listening
      followUp = await generateCrisisFollowUp({
        turns,
        locale: effectiveLocale,
        category: crisisResult.category,
      });
    }

    const crisisResponse = {
      triggered: true,
      ongoing: hasPriorCrisisReferral,
      category: crisisResult.category,
      categoryLabel: crisisResult.categoryLabel,
      urgency: crisisResult.urgency,
      matchedText: crisisResult.matchedText,
      helpline: response.helpline,
      counsellorNote: response.counsellorNote,
    };

    // Record check-in deterministically with acute distress markers
    const assessment = store.appendCheckIn(caseId, {
      turns: turns.map((t) => ({
        speaker: t.speaker === SPEAKER.SYSTEM ? SPEAKER.SYSTEM : SPEAKER.PERSON,
        text: String(t.text ?? ''),
      })),
      locale: effectiveLocale,
      channel: channel ?? 'app',
      surfaceSentiment: 95,
      signals: ['crisis_detected'],
      signalPhrases: [crisisResult.matchedText],
      immediateReviewRequested: true,
      provenance: 'deterministic_crisis_guard',
      consentAcknowledged: isConsentActive,
      crisisDetected: true,
      crisisMetadata: {
        category: crisisResult.category,
        categoryLabel: crisisResult.categoryLabel,
        urgency: crisisResult.urgency,
        matchedText: crisisResult.matchedText,
      },
    });

    store.addNotification(req.victimUsername, {
      caseId,
      type: 'checkin_received',
      message: 'Your response has been recorded. Sahara remembers where you left off.',
    });

    return res.json({
      ok: true,
      assessment,
      analysis: {
        notes: 'Emergency safety protocol triggered deterministically. High-priority support escalation active.',
        provenance: { source: 'deterministic_crisis_guard', model: 'deterministic-rules' },
      },
      followUp,
      crisisResponse,
    });
  }

  // ── STEP 2: ENFORCE ROUTINE MONITORING CONSENT BEFORE LLM ANALYSIS ────────
  // A routine check-in without active monitoring consent must NEVER reach:
  // - LLM analysis
  // - external model provider
  // - cached LLM analysis
  // - non-essential AI processing
  if (!isConsentActive) {
    return res.status(403).json({
      error: 'Active monitoring consent is required to submit routine check-ins. Please review and grant consent in settings.',
      consentRequired: true,
    });
  }

  // ── STEP 3: ROUTINE ANALYSIS VIA LLM PROVIDER ────────────────────────────
  // Consent is verified active — proceed with analysis provider
  const analysis = await analysisProvider.analyseCheckIn({ turns, locale: locale ?? 'en' });

  // Route 2 (Semantic AI Classifier): Deep intent & metaphor comprehension.
  // Catches indirect self-harm ideation, veiled thoughts of death, or novel
  // despair that do not match fixed regex keywords.
  const isSemanticCrisis = analysis.crisisDetected === true || (
    analysis.surfaceSentiment >= 85 && analysis.signals.includes('hopelessness')
  );

  const crisisTriggered = isSemanticCrisis;
  const crisisCategory = 'explicit_intent';
  const crisisCategoryLabel = 'Semantic self-harm or acute crisis detected by AI';
  const crisisUrgency = analysis.surfaceSentiment >= 90 ? 'critical' : 'high';
  const crisisMatchedText = analysis.signalPhrases?.[0] || 'Semantic crisis evaluation';

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
    consentAcknowledged: true,
    crisisDetected: crisisResult.triggered,
    crisisMetadata: crisisResult.triggered ? {
      category: crisisResult.category,
      categoryLabel: crisisResult.categoryLabel,
      urgency: crisisResult.urgency,
      matchedText: crisisResult.matchedText,
    } : null,
  });

  let followUp;
  let crisisResponse = null;

  if (crisisResult.triggered) {
    const effectiveLocale = locale ?? caseRecord.preferredLocale ?? 'en';
    const response = getCrisisResponse(effectiveLocale, crisisResult.category);

    if (!hasPriorCrisisReferral) {
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
    message: 'Your response has been recorded. Sahara remembers where you left off.',
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
 * Supports case-implicit routing (/prompts) and verified case routing (/prompts/:caseId).
 */
checkinRouter.get(['/prompts', '/prompts/:caseId'], (req, res) => {
  const targetCaseId = req.params.caseId || req.session?.user?.caseId;
  if (!targetCaseId) {
    return res.status(400).json({ error: 'No case linked to this session.' });
  }

  // Verify victim owns the requested case
  if (!store.isOwnedBy(targetCaseId, req.victimUsername)) {
    return res.status(403).json({ error: 'You can only access prompts for your own case.' });
  }

  const caseRecord = store.getCase(targetCaseId);
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
    caseId: targetCaseId,
    locale,
    prompts: prompts[locale] ?? prompts.en,
  });
});
