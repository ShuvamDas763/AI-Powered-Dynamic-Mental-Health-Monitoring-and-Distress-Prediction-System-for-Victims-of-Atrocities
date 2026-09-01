/**
 * Environment configuration.
 *
 * Loads `.env` from the project root and exposes a single frozen `config`
 * object. Nothing else in the codebase reads `process.env` directly — that way
 * there is exactly one place to look when a key is missing or misnamed.
 *
 * DEMO-RELIABILITY NOTE
 * ---------------------
 * A missing GROQ_API_KEY is deliberately NOT a fatal error. The app degrades
 * into cached-response mode and stays fully demoable. This is the same code
 * path that protects a live jury demo when the venue network dies, so it gets
 * exercised every time someone runs the project without a key rather than
 * sitting untested until the moment it matters.
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/** Read an integer env var, falling back to `fallback` if unset or unparseable. */
function intFromEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Read a boolean env var. Only the exact string "true" counts as true. */
function boolFromEnv(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw.toLowerCase() === 'true';
}

const groqApiKey = process.env.GROQ_API_KEY?.trim() ?? '';

// A placeholder copied from .env.example is treated as "no key" so that an
// unedited .env behaves the same as a missing one instead of failing at the
// first API call with a confusing 401.
const hasRealKey = groqApiKey !== '' && groqApiKey !== 'gsk_your_key_here';

export const config = Object.freeze({
  /**
   * API server port.
   *
   * Deliberately named API_PORT rather than the conventional PORT. Dev tooling
   * and launch harnesses routinely inject PORT for the *frontend*; when the API
   * also read PORT it would silently start on the client's port, and the Vite
   * proxy would then fail with ECONNREFUSED against an empty 3001. A dedicated
   * name makes that collision impossible.
   */
  port: intFromEnv('API_PORT', 3001),
  sessionSecret: process.env.SESSION_SECRET || 'dev-only-insecure-session-secret',

  llm: Object.freeze({
    apiKey: hasRealKey ? groqApiKey : null,

    /**
     * Primary model for scoring, explainability text and intervention wording.
     *
     * The default here must name a model this account can actually serve. An
     * earlier default named a model that does not exist on the account, which
     * fails only at the first live call — long after startup, and looking like a
     * network fault rather than a config one. See docs/model-selection.md.
     */
    model: process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b',

    /**
     * Secondary model, used only when the primary errors or times out, before
     * giving up to a cached response.
     *
     * Stays secondary permanently. The Phase 1 probe found it both scored the
     * witness-intimidation case lower than the primary did and was the more
     * susceptible of the two to prompt injection. It is faster, and that is not
     * a good enough reason to promote it.
     */
    modelFallback: process.env.GROQ_MODEL_FALLBACK?.trim() || 'qwen/qwen3.8-27b',

    /**
     * Moderation pass over generated text before any of it reaches a screen.
     *
     * A runtime gate, not a formality. The content-safety rules (no diagnostic
     * labels, nothing graphic, nothing that reads like real case reporting) are
     * stated in the system prompt, but a prompt is a request and this is a check.
     */
    modelModeration: process.env.GROQ_MODEL_MODERATION?.trim() || 'openai/gpt-oss-safeguard-20b',

    timeoutMs: intFromEnv('LLM_TIMEOUT_MS', 8000),

    /**
     * True when every LLM call should skip the network and serve a
     * pre-generated cached response instead. Either the operator asked for it
     * (FORCE_FALLBACK_MODE=true, the panic switch for a bad venue network) or
     * there is no usable key to call with.
     */
    forceFallback: boolFromEnv('FORCE_FALLBACK_MODE') || !hasRealKey,
  }),

  /**
   * Development mode flag. When false, the dev-only router (persona switcher,
   * seed reset, synthetic check-in injection) is not mounted — making those
   * endpoints completely unreachable in the deployed build.
   */
  isDev: process.env.NODE_ENV !== 'production',

  privacy: Object.freeze({
    /**
     * Small-cell suppression threshold for the aggregate (admin) tier.
     *
     * Any aggregate bucket containing fewer than this many cases renders as
     * "<5" rather than an exact count. Reporting "1 high-risk case in this
     * block" would re-identify that person to anyone who knows the caseload,
     * which would defeat the two-tier separation from the aggregate side even
     * though no name was ever sent.
     */
    minCellSize: intFromEnv('MIN_CELL_SIZE', 5),
  }),
});

/** Human-readable startup banner lines describing how the app is configured. */
export function describeConfig() {
  const lines = [`port=${config.port}`, `model=${config.llm.model}`];
  lines.push(
    config.llm.forceFallback
      ? `llm=CACHED-FALLBACK-ONLY (${config.llm.apiKey ? 'forced by FORCE_FALLBACK_MODE' : 'no GROQ_API_KEY set'})`
      : `llm=live (timeout ${config.llm.timeoutMs}ms)`,
  );
  lines.push(`min-cell-size=${config.privacy.minCellSize}`);
  return lines;
}
