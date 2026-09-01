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
import { analyseCheckIn, generateFollowUp } from '../llm/groqClient.js';
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

  // ── CRISIS DETECTION (independent of LLM) ──────────────────────────────
  // Runs BEFORE any model call, including cached-fallback. This is the one
  // feature where a silent failure is unacceptable — the pattern check must
  // fire even when the Groq API is unreachable.
  const crisisResult = detectCrisisInCheckIn(turns);

  // Run the LLM analysis on the conversation.
  const analysis = await analyseCheckIn({ turns, locale: locale ?? 'en' });

  // Record the check-in with the LLM's reading, plus crisis metadata if detected.
  const assessment = store.appendCheckIn(caseId, {
    turns: turns.map((t) => ({
      speaker: t.speaker === SPEAKER.SYSTEM ? SPEAKER.SYSTEM : SPEAKER.PERSON,
      text: String(t.text ?? ''),
    })),
    locale: locale ?? 'en',
    channel: channel ?? 'app',
    surfaceSentiment: crisisResult.triggered ? 95 : analysis.surfaceSentiment,
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

  // Generate a follow-up: crisis response overrides the normal conversational path.
  let followUp;
  let crisisResponse = null;

  if (crisisResult.triggered) {
    const response = getCrisisResponse(locale ?? 'en');
    followUp = response.steps.join('\n\n');
    crisisResponse = {
      triggered: true,
      category: crisisResult.category,
      categoryLabel: crisisResult.categoryLabel,
      urgency: crisisResult.urgency,
      matchedText: crisisResult.matchedText,
      helpline: response.helpline,
      counsellorNote: response.counsellorNote,
    };
  } else {
    followUp = await generateFollowUp({ turns, locale: locale ?? 'en' });
  }

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
