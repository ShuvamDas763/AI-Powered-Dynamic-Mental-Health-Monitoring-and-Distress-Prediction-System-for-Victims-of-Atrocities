/**
 * LLM client — Groq inference with timeout, fallback, and cached-response mode.
 *
 * WHY THIS EXISTS
 * -------------------------------------------------------------------------
 * The scoring pipeline in src/domain is deterministic arithmetic over four
 * components — three computed from the record, one from the model. This module
 * is the seam where that one model input is produced. It handles:
 *
 *   1. A live call to the primary model.
 *   2. On timeout or error, a retry with the fallback model.
 *   3. On both failures (or when no API key is set), a cached-response mode
 *      that returns a plausible but clearly-labelled reading so the demo
 *      still works without a network.
 *
 * The cache is intentionally not a "smart" cache keyed on content. In the
 * demo, every persona's seed history already carries its sentiment readings.
 * The cache exists so that a live check-in submitted during the demo — when
 * the venue network is down — still produces a result rather than an error
 * screen. The cached response is marked `provenance: 'cached-fallback'` so
 * the UI can show which number was live and which was served from cache.
 *
 * DEMO RELIABILITY
 * -------------------------------------------------------------------------
 * `FORCE_FALLBACK_MODE=true` in .env skips all network calls. The caller
 * never needs to know — it receives the same shape either way.
 */

import Groq from 'groq-sdk';
import { config } from '../config/env.js';
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserMessage, FOLLOW_UP_SYSTEM_PROMPT, CRISIS_FOLLOW_UP_SYSTEM_PROMPT, MODERATION_SYSTEM_PROMPT } from './prompts.js';
import { detectSignalsInCheckIn } from '../safety/fallbackSignals.js';
import { getOngoingCrisisResponse } from '../safety/crisisResponse.js';
import { SIGNAL } from '../domain/escalation.js';

/** A plausible but obviously-cached sentiment reading. */
const FALLBACK_SENTIMENT = 45;
const FALLBACK_NOTES =
  'Analysis served from cached fallback — no live model call was available for this check-in.';

/**
 * Verify that signal phrases are actually present in the person's text.
 *
 * The prompt instructs the model to "quote only from what the person actually
 * wrote", but LLMs occasionally fabricate plausible-sounding phrases. This gate
 * catches that: each phrase is checked (case-insensitive, whitespace-normalised)
 * against the concatenation of the person's turns. Phrases that do not appear
 * are silently dropped — a fabricated quote shown as "Person's own words" in
 * the counsellor view would be a correctness defect worse than an empty list.
 *
 * @param {string[]} phrases — the model's claimed quotes.
 * @param {Array<{ speaker: string, text: string }>} turns — the check-in transcript.
 * @returns {string[]} — only the phrases that are verifiable substrings.
 */
export function verifyPhrases(phrases, turns) {
  if (!Array.isArray(phrases) || phrases.length === 0) return [];
  const personText = turns
    .filter((t) => t.speaker === 'person')
    .map((t) => t.text)
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  return phrases.filter((phrase) => {
    if (typeof phrase !== 'string' || phrase.trim().length === 0) return false;
    const normalised = phrase.toLowerCase().replace(/\s+/g, ' ').trim();
    return personText.includes(normalised);
  });
}

/**
 * Parse a JSON response from the model, tolerating markdown fences and
 * trailing commas. Returns the parsed object or null on failure.
 */
function safeParse(text) {
  if (typeof text !== 'string') return null;
  // Strip markdown code fences if present
  let cleaned = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  // Strip trailing commas before } or ]
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

/**
 * Call the Groq API with a timeout.
 *
 * Returns the model's text response, or throws on failure/timeout.
 */
async function callGroq(client, model, messages, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await client.chat.completions.create(
      {
        model,
        messages,
        temperature: 0.2,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      },
      { signal: controller.signal },
    );
    return response.choices?.[0]?.message?.content ?? null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Analyse a check-in conversation through the LLM.
 *
 * @param {{ turns: Array<{ speaker: string, text: string }>, locale?: string }} checkIn
 * @returns {{
 *   surfaceSentiment: number|null, signals: string[], signalPhrases: string[],
 *   notes: string, provenance: { source: string, model: string|null, fallbackReason: string|null }
 * }}
 */
export async function analyseCheckIn(checkIn) {
  // Fast path: no API key or forced fallback — run pattern detection on the
  // check-in text rather than returning a fixed reading. This ensures that
  // clear signals like intimidation are detected even without a live model.
  if (config.llm.forceFallback) {
    const detected = detectSignalsInCheckIn(checkIn.turns ?? []);
    return {
      surfaceSentiment: detected.fallbackSentiment,
      signals: detected.signals,
      signalPhrases: detected.signalPhrases,
      notes: detected.signals.length > 0
        ? `${FALLBACK_NOTES} Pattern-based signal detection identified: ${detected.signals.join(', ')}.`
        : FALLBACK_NOTES,
      provenance: {
        source: 'cached-fallback',
        model: null,
        fallbackReason: 'force-fallback-mode',
      },
    };
  }

  const client = new Groq({ apiKey: config.llm.apiKey });
  const turns = checkIn.turns ?? [];
  const userMessage = buildAnalysisUserMessage({
    turns,
    locale: checkIn.locale ?? 'en',
  });
  const messages = [
    { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
    { role: 'user', content: userMessage },
  ];

  /** Build a verified return value — phrases that survive the substring check. */
  function buildResult(parsed, model, fallbackReason) {
    const rawPhrases = Array.isArray(parsed.signalPhrases) ? parsed.signalPhrases : [];
    return {
      surfaceSentiment: Math.min(100, Math.max(0, Math.round(parsed.surfaceSentiment))),
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
      signalPhrases: verifyPhrases(rawPhrases, turns),
      notes: typeof parsed.notes === 'string' ? parsed.notes : '',
      provenance: { source: 'live', model, fallbackReason },
    };
  }

  // Try primary model.
  try {
    const raw = await callGroq(client, config.llm.model, messages, config.llm.timeoutMs);
    const parsed = safeParse(raw);
    if (parsed && typeof parsed.surfaceSentiment === 'number') {
      return buildResult(parsed, config.llm.model, null);
    }
    // Model returned unparseable output — fall through to fallback model.
  } catch (err) {
    // Timeout or network error — fall through to fallback model.
  }

  // Try fallback model.
  try {
    const raw = await callGroq(client, config.llm.modelFallback, messages, config.llm.timeoutMs);
    const parsed = safeParse(raw);
    if (parsed && typeof parsed.surfaceSentiment === 'number') {
      return buildResult(parsed, config.llm.modelFallback, `primary model (${config.llm.model}) failed`);
    }
  } catch (err) {
    // Both models failed — serve cached response.
  }

  // Both models failed — fall back to pattern detection on the check-in text.
  const detected = detectSignalsInCheckIn(checkIn.turns ?? []);
  return {
    surfaceSentiment: detected.fallbackSentiment,
    signals: detected.signals,
    signalPhrases: detected.signalPhrases,
    notes: detected.signals.length > 0
      ? `${FALLBACK_NOTES} Pattern-based signal detection identified: ${detected.signals.join(', ')}.`
      : FALLBACK_NOTES,
    provenance: {
      source: 'cached-fallback',
      model: null,
      fallbackReason: `both models failed (primary: ${config.llm.model}, fallback: ${config.llm.modelFallback})`,
    },
  };
}

/**
 * Pattern-based contextual follow-up for cached-fallback mode.
 *
 * When no LLM is available, generate a contextually relevant follow-up based
 * on detected signals rather than returning the same generic message every time.
 * This ensures the victim sees that their specific concern was acknowledged,
 * even when the model is unreachable.
 *
 * @param {Array<{ speaker: string, text: string }>} turns
 * @param {string} locale
 * @returns {string}
 */
function generateFallbackFollowUp(turns, locale = 'en') {
  if (turns.length === 0) {
    return DEFAULT_FOLLOW_UP[locale] ?? DEFAULT_FOLLOW_UP.en;
  }

  const detected = detectSignalsInCheckIn(turns);
  const lastPersonTurn = [...turns].reverse().find((t) => t.speaker === 'person');
  const text = (lastPersonTurn?.text ?? '').toLowerCase();

  const templates = {
    en: {
      [SIGNAL.INTIMIDATION]: [
        'I hear you, and your safety matters. You should not have to face this alone — our support team has been notified and will follow up with you.',
        'That sounds very serious. Your concern is being taken seriously. Is there a safe place you can be right now?',
        'Thank you for telling me about this. You do not have to go through this alone. A counsellor will be in touch with you soon.',
      ],
      [SIGNAL.HOPELESSNESS]: [
        'I am sorry you are feeling this way. Sometimes things can feel stuck, even when progress is happening slowly. What has been weighing on you the most?',
        'It takes courage to say that. You do not have to carry this alone. Would it help to connect with someone who can support you right now?',
        'What you are going through sounds incredibly heavy. You did not deserve this, and there are people who want to help. Would you like to speak with someone today?',
      ],
      [SIGNAL.SOCIAL_ISOLATION]: [
        'Feeling cut off from people around you must be really hard. Has anything specific changed recently?',
        'That sounds lonely. You do not have to go through this alone — our team is here for you.',
        'Feeling misunderstood is one of the hardest things. What you are going through matters, and we are here to listen.',
      ],
      [SIGNAL.PROCESS_FATIGUE]: [
        'It is completely understandable to feel worn down by the process. How are you managing day to day right now?',
        'That sounds exhausting. Is there anything specific about the process that has been hardest for you?',
      ],
      [SIGNAL.ECONOMIC_PRESSURE]: [
        'Financial pressure on top of everything else must be very difficult. Is there any support you need right now — food, shelter, or emergency relief?',
        'Money worries can make everything harder. Has the case affected your work or income? We can help connect you with immediate assistance.',
        'I am sorry you are facing this loss. You did not deserve it. Would you like me to arrange emergency food assistance or connect you with a shelter for your family tonight?',
      ],
      [SIGNAL.DEFLECTION]: [
        'I appreciate you checking in. If anything comes to mind later, you can always share it. How has this week been for you?',
        'That is okay. Sometimes it takes time to put things into words. I am here whenever you want to talk.',
      ],
      [SIGNAL.DISENGAGEMENT]: [
        'You do not have to talk about anything you are not ready for. Your comfort comes first. We are here whenever you are ready.',
        'I hear you. You do not owe anyone an explanation. Take whatever time you need — we will be here when you are ready.',
        'That is completely okay. There is no pressure here. Whenever you feel ready, we are just a message away.',
        'I understand. Your wellbeing matters most. We can adjust how often we check in — just let us know what feels right for you.',
      ],
    },
    hi: {
      [SIGNAL.INTIMIDATION]: [
        'मैं समझ सकता हूँ, और आपकी सुरक्षा बहुत महत्वपूर्ण है। आपको इसका सामना अकेले नहीं करना चाहिए — हमारी सहायता टीम को सूचित कर दिया गया है और जल्द ही आपसे संपर्क करेगी।',
        'यह बहुत गंभीर लगता है। आपकी चिंता गंभीरता से ली जा रही है। क्या आप अभी किसी सुरक्षित जगह पर हैं?',
        'आपकी सुरक्षा सबसे पहले है। आपको इसका सामना अकेले नहीं करना चाहिए — हम आपकी मदद कर सकते हैं।',
      ],
      [SIGNAL.HOPELESSNESS]: [
        'आप ऐसा महसूस कर रहे हैं इसके लिए दुख है। कभी-कभी चीज़ें रुकी हुई लगती हैं, भले ही धीरे-धीरे प्रगति हो रही हो। आपको सबसे ज़्यादा क्या परेशान कर रहा है?',
        'यह कहने के लिए बहुत हिम्मत चाहिए। आपको इसे अकेले नहीं उठाना चाहिए। क्या आप अभी किसी से बात करना चाहेंगे?',
        'जो आप महसूस कर रहे हैं वह बहुत भारी है। आप इसके हक़दार नहीं थे। क्या आप चाहेंगे कि आज ही किसी सहायक व्यक्ति से बात करवाऊँ?',
      ],
      [SIGNAL.SOCIAL_ISOLATION]: [
        'अपने आसपास के लोगों से कटा हुआ महसूस करना बहुत मुश्किल हो सकता है। क्या हाल ही में कुछ बदला है?',
        'अकेला महसूस करना बहुत कठिन है। आपको इसका सामना अकेले नहीं करना चाहिए — हमारी टीम यहाँ है।',
        'ग़लत समझा जाना बहुत दर्दनाक हो सकता है। जो आप महसूस कर रहे हैं वह महत्वपूर्ण है, और हम सुनने के लिए यहाँ हैं।',
      ],
      [SIGNAL.PROCESS_FATIGUE]: [
        'इस प्रक्रिया से थक जाना बिल्कुल स्वाभाविक है। अभी आप रोज़मर्रा के दिन कैसे बिता रहे हैं?',
        'यह बहुत थका देने वाला लगता है। क्या प्रक्रिया में कोई ख़ास चीज़ है जो सबसे मुश्किल रही?',
      ],
      [SIGNAL.ECONOMIC_PRESSURE]: [
        'सब कुछ के ऊपर आर्थिक दबाव बहुत मुश्किल हो सकता है। क्या आपको अभी किसी तरह की सहायता चाहिए — खाना, आश्रय, या आपातकालीन राहत?',
        'पैसों की चिंता सब कुछ और मुश्किल बना देती है। क्या मामले ने आपके काम या आमदनी को प्रभावित किया है? हम तुरंत सहायता से जोड़ सकते हैं।',
      ],
      [SIGNAL.DEFLECTION]: [
        'जाँच में आने के लिए धन्यवाद। बाद में कुछ भी मन में आए तो आप हमेशा बता सकते हैं। इस हफ़्ते कैसा बीता?',
        'कोई बात नहीं। कभी-कभी चीज़ों को शब्दों में कहने में समय लगता है। मैं यहाँ हूँ जब भी आप बात करना चाहें।',
      ],
      [SIGNAL.DISENGAGEMENT]: [
        'आपको कुछ भी ऐसा बोलने की ज़रूरत नहीं है जिसके लिए आप तैयार नहीं हैं। आपकी सुविधा सबसे पहले है। हम यहाँ हैं जब भी आप तैयार हों।',
        'मैं समझ सकता हूँ। आपको कोई जवाब नहीं देना है। जितना समय चाहिए उतना लें — हम यहीं रहेंगे।',
      ],
    },
  };

  const localeTemplates = templates[locale] ?? templates.en;

  // Use detected signals to pick the most relevant template.
  for (const signal of detected.signals) {
    if (localeTemplates[signal]) {
      const options = localeTemplates[signal];
      // Deterministic selection based on the last turn length (no Math.random in a
      // server path that might be called in tests).
      const index = text.length % options.length;
      return options[index];
    }
  }

  // Fallback for when no signals are detected — empathetic and open-ended.
  // Detect positive or neutral check-ins (no distress signals found)
  const positivePatterns = [
    /(?:better|good|great|improving|happy|glad|peaceful|calm|settled|okay|fine|manageable)/i,
    /(?:got|found|received|bought|learned|started|joined|attended|visited|cooked|planted|fixed)/i,
    /(?:news+(?:job|role|friend|home|school|routine)|sister|brother|child|son|daughter|family)/i,
    /(?:exercise|walk|temple|church|mosque|garden|books|cooking|cleaning|reading)/i,
  ];
  const isPositive = positivePatterns.some(p => p.test(text));

  const safeFallback = {
    en: isPositive ? [
      'That is good to hear. It is nice to know you are finding moments of peace. Is there anything you would like to talk about or any support you need right now?',
      'I am glad things are going well for you. How are you feeling overall? Is there anything on your mind you would like to share?',
      'It is good to hear some positive news. How has the case been progressing? Is there anything you need help with?',
      'That sounds like a positive step. How are you managing day to day? I am here if you need anything.',
      'I am happy to hear that. Sometimes small moments like these make a big difference. Is there anything else on your mind?',
    ] : [
      'Thank you for sharing that. Is there anything specific you would like support with right now?',
      'I hear you. That sounds like a lot to carry. Would it help to talk about what has been weighing on you?',
      'I appreciate you checking in. How has this week been for you? Is there anything you would like help with?',
      'Thank you for being open with me. How have things been going since we last spoke?',
    ],
    hi: isPositive ? [
      'यह अच्छा सुनने को मिला। ऐसे पल बहुत मायने रखते हैं। क्या आप कुछ और बताना चाहेंगे या किसी मदद की ज़रूरत है?',
      'मुझे ख़ुशी है कि चीज़ें अच्छी हो रही हैं। आप समग्र रूप से कैसा महसूस कर रहे हैं? क्या कुछ ऐसा है जो आप बताना चाहेंगे?',
      'यह जानकर अच्छा लगा। मामले की स्थिति कैसी है? क्या किसी चीज़ में मदद चाहिए?',
    ] : [
      'आपने जो बताया उसके लिए धन्यवाद। क्या अभी कोई ख़ास चीज़ है जिसमें आप मदद चाहेंगे?',
      'मैं समझ सकता हूँ। क्या आप बताना चाहेंगे कि आपको सबसे ज़्यादा क्या परेशान कर रहा है?',
      'जाँच के लिए धन्यवाद। इस हफ़्ते आपके लिए कैसा रहा? क्या कुछ ऐसा है जिसमें आप मदद चाहेंगे?',
    ],
  };

  const fallbackOptions = safeFallback[locale] ?? safeFallback.en;
  return fallbackOptions[text.length % fallbackOptions.length];
}

/**
 * Generate a conversational follow-up message grounded in the person's last reply.
 *
 * @param {{ turns: Array<{ speaker: string, text: string }>, locale?: string }} checkIn
 * @returns {string} — the follow-up message, or a default if the LLM fails.
 */
export async function generateFollowUp(checkIn) {
  const DEFAULT_FOLLOW_UP = {
    en: 'Thank you for sharing that. Is there anything else you would like to talk about?',
    hi: 'आपने जो बताया उसके लिए धन्यवाद। क्या और कुछ है जो आप बताना चाहेंगे?',
  };

  const locale = checkIn.locale ?? 'en';
  const turns = checkIn.turns ?? [];

  if (turns.length === 0) {
    return DEFAULT_FOLLOW_UP[locale] ?? DEFAULT_FOLLOW_UP.en;
  }

  // If forced fallback, use pattern-based contextual follow-up.
  if (config.llm.forceFallback) {
    return generateFallbackFollowUp(turns, locale);
  }

  // Build the conversation context — include the last 4 turns for context.
  const recentTurns = turns.slice(-4);
  const transcript = recentTurns
    .map((t) => `${t.speaker === 'person' ? 'PERSON' : 'SERVICE'}: ${t.text}`)
    .join('\n');

  const messages = [
    { role: 'system', content: FOLLOW_UP_SYSTEM_PROMPT },
    { role: 'user', content: `Language: ${locale}.\n\n--- RECENT CONVERSATION ---\n${transcript}\n--- END ---\n\nGenerate the next system message.` },
  ];

  const client = new Groq({ apiKey: config.llm.apiKey });

  try {
    const raw = await callGroq(client, config.llm.model, messages, config.llm.timeoutMs);
    const parsed = safeParse(raw);
    if (parsed && typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
      const result = await moderateText(parsed.message);
      if (result.pass) {
        return parsed.message.trim();
      }
    }
  } catch {
    // LLM unavailable — use pattern-based contextual follow-up instead of generic.
  }

  // When the LLM fails, use signal-aware templates rather than a one-size-fits-all default.
  return generateFallbackFollowUp(turns, locale);
}

/**
 * Generate an empathetic, context-aware follow-up message during an ongoing crisis dialogue.
 *
 * Uses Groq with CRISIS_FOLLOW_UP_SYSTEM_PROMPT to de-escalate and validate the person's
 * specific distress, falling back to deterministic ongoing crisis templates if offline or erroring.
 *
 * @param {{ turns: Array<{ speaker: string, text: string }>, locale?: string, category?: string }} params
 * @returns {Promise<string>}
 */
export async function generateCrisisFollowUp({ turns, locale = 'en', category } = {}) {
  const effectiveLocale = locale ?? 'en';
  const turnsList = turns ?? [];

  if (config.llm.forceFallback || !config.llm.apiKey) {
    return getOngoingCrisisResponse({ turns: turnsList, locale: effectiveLocale, category });
  }

  // Include recent conversation turns for context
  const recentTurns = turnsList.slice(-6);
  const transcript = recentTurns
    .map((t) => `${t.speaker === 'person' ? 'PERSON' : 'SERVICE'}: ${t.text}`)
    .join('\n');

  const messages = [
    { role: 'system', content: CRISIS_FOLLOW_UP_SYSTEM_PROMPT },
    {
      role: 'user',
      content: `Language: ${effectiveLocale}.\nCrisis Category: ${category ?? 'distress'}.\n\n--- RECENT CONVERSATION ---\n${transcript}\n--- END ---\n\nGenerate the next de-escalation message.`,
    },
  ];

  const client = new Groq({ apiKey: config.llm.apiKey });

  try {
    const raw = await callGroq(client, config.llm.model, messages, config.llm.timeoutMs);
    const parsed = safeParse(raw);
    if (parsed && typeof parsed.message === 'string' && parsed.message.trim().length > 0) {
      const result = await moderateText(parsed.message);
      if (result.pass) {
        return parsed.message.trim();
      }
    }
  } catch {
    // Model error / timeout — fall through to ongoing crisis template engine
  }

  return getOngoingCrisisResponse({ turns: turnsList, locale: effectiveLocale, category });
}

/**
 * Moderate a piece of generated text against the content-safety rules.
 *
 * @param {string} text — the text to check.
 * @returns {{ pass: boolean, failed: string[], why: string }}
 */
export async function moderateText(text) {
  if (config.llm.forceFallback || !config.llm.apiKey) {
    return { pass: true, failed: [], why: 'moderation skipped (no live model)' };
  }

  const client = new Groq({ apiKey: config.llm.apiKey });
  const messages = [
    { role: 'system', content: MODERATION_SYSTEM_PROMPT },
    { role: 'user', content: text },
  ];

  try {
    const raw = await callGroq(client, config.llm.modelModeration, messages, config.llm.timeoutMs);
    const parsed = safeParse(raw);
    if (parsed && typeof parsed.pass === 'boolean') {
      return {
        pass: parsed.pass,
        failed: Array.isArray(parsed.failed) ? parsed.failed : [],
        why: typeof parsed.why === 'string' ? parsed.why : '',
      };
    }
  } catch {
    // Moderation model unavailable — pass by default rather than blocking.
  }

  return { pass: true, failed: [], why: 'moderation model unavailable' };
}
