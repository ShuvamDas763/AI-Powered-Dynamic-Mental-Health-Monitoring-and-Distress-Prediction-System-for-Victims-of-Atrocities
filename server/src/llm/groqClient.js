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
import { ANALYSIS_SYSTEM_PROMPT, buildAnalysisUserMessage, FOLLOW_UP_SYSTEM_PROMPT, MODERATION_SYSTEM_PROMPT } from './prompts.js';

/** A plausible but obviously-cached sentiment reading. */
const FALLBACK_SENTIMENT = 45;
const FALLBACK_SIGNALS = [];
const FALLBACK_PHRASES = [];
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
  // Fast path: no API key or forced fallback — serve cached immediately.
  if (config.llm.forceFallback) {
    return {
      surfaceSentiment: FALLBACK_SENTIMENT,
      signals: [...FALLBACK_SIGNALS],
      signalPhrases: [...FALLBACK_PHRASES],
      notes: FALLBACK_NOTES,
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

  // Both models failed — cached fallback.
  return {
    surfaceSentiment: FALLBACK_SENTIMENT,
    signals: [...FALLBACK_SIGNALS],
    signalPhrases: [...FALLBACK_PHRASES],
    notes: FALLBACK_NOTES,
    provenance: {
      source: 'cached-fallback',
      model: null,
      fallbackReason: `both models failed (primary: ${config.llm.model}, fallback: ${config.llm.modelFallback})`,
    },
  };
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

  // If forced fallback, return the default.
  if (config.llm.forceFallback) {
    return DEFAULT_FOLLOW_UP[locale] ?? DEFAULT_FOLLOW_UP.en;
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
    // Fall through to default.
  }

  return DEFAULT_FOLLOW_UP[locale] ?? DEFAULT_FOLLOW_UP.en;
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
