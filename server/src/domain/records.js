/**
 * The record schema: case, check-in, and assessment.
 *
 * WHY THE FACTORIES DERIVE RATHER THAN ACCEPT
 * -------------------------------------------------------------------------
 * Engagement and trend metrics are computed from how long someone's replies are
 * and how quickly they arrive. If a seed file could simply assert
 * `wordCount: 1` beside a forty-word reply, every chart in the dashboard would
 * be a decoration rather than a measurement. So the factory counts the words in
 * the actual text and ignores any hand-written value. Demo data and live data go
 * through the same door.
 *
 * TIME IS RELATIVE, NOT BAKED IN
 * Seed check-ins are declared as `daysAgo` and resolved against a clock passed
 * in. Tests pass a fixed clock and stay deterministic; the running app passes
 * the real one, so a demo months from now still shows a recent history instead
 * of dates from the week this was written.
 *
 * PSEUDONYMS ONLY
 * A case record has no field capable of holding a real name, phone number or
 * address — not "left blank", but absent from the shape. Tested.
 */

import { CHECK_IN_STATUS } from './engagement.js';
import { PRIORITY_USE_CASE } from './priorityWeighting.js';
import { SIGNAL } from './escalation.js';

/** Who is speaking in a check-in conversation. */
export const SPEAKER = Object.freeze({
  /** The check-in assistant's prompt. */
  SYSTEM: 'system',
  /** The person answering. Only these words count toward engagement. */
  PERSON: 'person',
});

/**
 * How a check-in reached the person. SMS and IVRS are simulated as UI states in
 * this prototype — spec Section 5 lists them as honestly-simulated, not real
 * telephony — but the channel is recorded so the dashboard can show the mix.
 */
export const CHANNEL = Object.freeze({
  APP: 'app',
  WEB: 'web',
  SMS: 'sms',
  IVRS: 'ivrs',
});

/** Languages this prototype demonstrates. Two, done properly. */
export const LOCALE = Object.freeze({
  EN: 'en',
  HI: 'hi',
});

/**
 * Where a number came from. Shown in the UI so nobody has to guess whether a
 * score was reasoned live or served from cache after an API failure.
 */
export const PROVENANCE = Object.freeze({
  /** Pre-populated demonstration history. */
  SEED: 'seed',
  /** Produced by a live model call in this session. */
  LIVE: 'live',
  /** Served from cache because the live call failed or timed out. */
  CACHED_FALLBACK: 'cached-fallback',
});

const MS_PER_DAY = 86_400_000;

const isFiniteNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const oneOf = (value, allowed, fallback) =>
  Object.values(allowed).includes(value) ? value : fallback;

/**
 * Keep only signals from the closed vocabulary.
 *
 * Unrecognised entries are dropped rather than passed through, because the
 * escalation rule matches on exact codes. A model that invents
 * "feeling_a_bit_low" must not be able to introduce a signal no rule can see
 * and no reviewer knows exists.
 */
function normalizeSignals(signals) {
  if (!Array.isArray(signals)) return [];
  const known = Object.values(SIGNAL);
  return [...new Set(signals.filter((s) => known.includes(s)))];
}

/**
 * Short phrases in the person's own words that drove the reading.
 *
 * These are quotes, so they are length-capped and never rewritten — the
 * explainability panel has to show what was actually said, and a paraphrase
 * generated for display would defeat the purpose of showing it.
 */
function normalizePhrases(phrases) {
  if (!Array.isArray(phrases)) return [];
  return phrases
    .filter((p) => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim().slice(0, 120));
}

/** Clamp to 0-100, or null when there is genuinely no reading. */
function optionalScore(value) {
  if (!isFiniteNumber(value)) return null;
  return Math.min(100, Math.max(0, value));
}

/** ISO timestamp for a point `daysAgo` before `now`. Pure. */
export function resolveOccurredAt(daysAgo, now) {
  const base = isFiniteNumber(now) ? now : Date.now();
  const offset = isFiniteNumber(daysAgo) ? daysAgo : 0;
  return new Date(base - offset * MS_PER_DAY).toISOString();
}

/** Whitespace-separated tokens. Emoji-only replies still count as a reply. */
function countWords(text) {
  if (typeof text !== 'string') return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function normalizeTurns(turns) {
  if (!Array.isArray(turns)) return [];
  return turns
    .filter((t) => t && typeof t.text === 'string')
    .map((t) => Object.freeze({
      speaker: oneOf(t.speaker, SPEAKER, SPEAKER.PERSON),
      text: t.text,
    }));
}

/**
 * One check-in.
 *
 * `surfaceSentiment` is 0-100 where higher means the WORDS read as more
 * distressed. It is deliberately named "surface" because it is only what the
 * text sounds like — the mismatch detector exists precisely because that can
 * disagree with what the participation pattern shows.
 */
export function makeCheckIn(raw, options = {}) {
  const input = raw ?? {};
  const { now, caseId = null, sequence = 1, previousSurfaceSentiment = null } = options;

  const turns = normalizeTurns(input.turns);
  const spokenWords = turns
    .filter((t) => t.speaker === SPEAKER.PERSON)
    .reduce((sum, t) => sum + countWords(t.text), 0);

  // Status is inferred from whether anything was actually said, unless the caller
  // explicitly declares one.
  //
  // Silence infers MISSED, not COMPLETED, and the distinction is not cosmetic. A
  // completed check-in with zero words would be counted twice over: it would crash
  // the reply-length trend as though the person had answered in no words, while
  // never registering as an unanswered check-in. Absence and a very short answer
  // are different findings and the engagement model treats them differently.
  const declared = oneOf(input.status, CHECK_IN_STATUS, null);
  const status = declared ?? (spokenWords > 0 ? CHECK_IN_STATUS.COMPLETED : CHECK_IN_STATUS.MISSED);
  const missed = status === CHECK_IN_STATUS.MISSED;

  const own = optionalScore(input.surfaceSentiment);
  const carried = own === null ? optionalScore(previousSurfaceSentiment) : null;

  return Object.freeze({
    id: `${caseId ?? 'unassigned'}#${sequence}`,
    caseId,
    sequence,
    daysAgo: isFiniteNumber(input.daysAgo) ? input.daysAgo : null,
    occurredAt:
      typeof input.occurredAt === 'string'
        ? input.occurredAt
        : resolveOccurredAt(input.daysAgo, now),
    status,
    channel: oneOf(input.channel, CHANNEL, CHANNEL.APP),
    locale: oneOf(input.locale, LOCALE, LOCALE.EN),
    turns: Object.freeze(missed ? [] : turns),
    /** Derived from the text above. A hand-written value is ignored on purpose. */
    wordCount: missed ? 0 : spokenWords,
    responseLatencyHours: missed ? null : (isFiniteNumber(input.responseLatencyHours) ? input.responseLatencyHours : null),
    surfaceSentiment: own ?? carried,
    /**
     * True when the reading above was inherited from the previous check-in
     * because this one has no words of its own. Surfaced rather than hidden, so
     * an explanation panel never presents a borrowed number as a fresh one.
     */
    surfaceSentimentCarriedForward: own === null && carried !== null,
    /** Closed-vocabulary signals. Empty for a missed check-in — silence is not evidence. */
    signals: Object.freeze(missed ? [] : normalizeSignals(input.signals)),
    /** The person's own words, quoted verbatim for the explainability panel. */
    signalPhrases: Object.freeze(missed ? [] : normalizePhrases(input.signalPhrases)),
    /**
     * Set when the analysis layer asked for a person to look at this now. It is
     * a request for review, never a decision — and the escalation rule can
     * escalate without it, because the Phase 1 probe showed both models leave it
     * false on cases that plainly warrant attention.
     */
    immediateReviewRequested: missed ? false : input.immediateReviewRequested === true,

    /**
     * Set when the pattern-based crisis detection layer fires on explicit
     * self-harm/suicide language. Runs independently of the LLM scoring
     * pipeline — must work in cached-fallback mode. When true, the assessment
     * is forced to URGENT/HIGH and the counsellor is alerted immediately.
     * Carries the detection metadata for explainability.
     */
    crisisDetected: missed ? false : input.crisisDetected === true,
    crisisMetadata: missed ? null : (input.crisisMetadata ?? null),
    /**
     * Lightweight consent acknowledgment. True when the person confirmed they
     * understand this check-in helps connect them with support. Shown once on
     * first check-in, stored for audit trail.
     */
    consentAcknowledged: input.consentAcknowledged === true,

    provenance: oneOf(input.provenance, PROVENANCE, PROVENANCE.SEED),
  });
}

/**
 * Build a full history for one case.
 *
 * Sorted oldest-first, because every trend function in engagement.js reads the
 * array in order and a reversed history would silently invert every direction it
 * reports. Sorting here rather than trusting the seed means a reordered seed file
 * can never flip a "rising" trend into an "improving" one.
 */
export function makeCheckInHistory(caseId, rawHistory, options = {}) {
  if (!Array.isArray(rawHistory) || rawHistory.length === 0) return [];

  const chronological = [...rawHistory].sort((a, b) => {
    const at = Date.parse(a?.occurredAt ?? resolveOccurredAt(a?.daysAgo, options.now));
    const bt = Date.parse(b?.occurredAt ?? resolveOccurredAt(b?.daysAgo, options.now));
    return at - bt;
  });

  const history = [];
  let previousSurfaceSentiment = null;
  for (const [index, item] of chronological.entries()) {
    const record = makeCheckIn(item, {
      ...options,
      caseId,
      sequence: index + 1,
      previousSurfaceSentiment,
    });
    if (record.surfaceSentiment !== null) previousSurfaceSentiment = record.surfaceSentiment;
    history.push(record);
  }
  return Object.freeze(history);
}

/**
 * One case.
 *
 * Identity is a pseudonym and a docket reference. There is no field for a name,
 * a number, or a location finer than district — the two-tier access model is only
 * as strong as the data it has to protect, and the cheapest protection is not
 * holding the data at all.
 */
export function makeCase(raw) {
  const input = raw ?? {};
  const tags = Array.isArray(input.priorityTags) && input.priorityTags.length
    ? input.priorityTags
    : [PRIORITY_USE_CASE.SC_ST_ACT_BENEFICIARY];

  return Object.freeze({
    key: input.key ?? null,
    caseId: input.caseId ?? null,
    pseudonym: input.pseudonym ?? 'Unnamed case',
    /** The session username that owns this case. Enables self-scoping in requireVictim. */
    victimUsername: input.victimUsername ?? null,
    /** Coarse geography only — enough for aggregate reporting, no finer. */
    district: input.district ?? null,
    state: input.state ?? null,
    /** Administrative stage, not a description of anything that happened. */
    caseStage: input.caseStage ?? null,
    monthsSinceRegistration: isFiniteNumber(input.monthsSinceRegistration)
      ? input.monthsSinceRegistration
      : null,
    priorityTags: Object.freeze([...tags]),
    preferredLocale: oneOf(input.preferredLocale, LOCALE, LOCALE.EN),
    /** One line of administrative context for the counsellor view. */
    contextNote: input.contextNote ?? '',
  });
}

/**
 * One distress assessment, attached to one check-in.
 *
 * Provenance defaults to SEED rather than LIVE. Defaulting the other way would
 * let a missing field quietly upgrade a cached number into a claim that the
 * model reasoned about this person live, which is exactly the kind of unearned
 * accuracy claim this build is not allowed to make.
 */
export function makeAssessment(raw, options = {}) {
  const input = raw ?? {};
  const now = isFiniteNumber(options.now) ? options.now : Date.now();
  const explanation = input.explanation ?? {};

  return Object.freeze({
    id: `${input.checkInId ?? input.caseId ?? 'unassigned'}@assessment`,
    caseId: input.caseId ?? null,
    checkInId: input.checkInId ?? null,
    createdAt: new Date(now).toISOString(),

    score: isFiniteNumber(input.score) ? input.score : 0,
    band: input.band ?? null,
    components: Object.freeze({ ...(input.components ?? {}) }),
    contributions: Object.freeze({ ...(input.contributions ?? {}) }),

    engagement: Object.freeze({ ...(input.engagement ?? {}) }),
    trend: Object.freeze({ ...(input.trend ?? {}) }),
    mismatch: Object.freeze({ ...(input.mismatch ?? {}) }),
    escalation: Object.freeze({ ...(input.escalation ?? {}) }),

    /** Everything the UI needs to justify the number to the person it is about. */
    explanation: Object.freeze({
      headline: typeof explanation.headline === 'string' ? explanation.headline : '',
      drivers: Object.freeze(Array.isArray(explanation.drivers) ? [...explanation.drivers] : []),
      signalPhrases: Object.freeze(
        Array.isArray(explanation.signalPhrases) ? [...explanation.signalPhrases] : [],
      ),
    }),

    /**
     * Recommended interventions, determined by the mapping table in
     * interventions.js. Not generated by an LLM — a deterministic lookup
     * that a policy team can audit and edit.
     */
    interventions: Object.freeze(
      Array.isArray(input.interventions) ? input.interventions.map((i) => Object.freeze({ ...i })) : [],
    ),

    provenance: Object.freeze({
      source: oneOf(input.provenance?.source, PROVENANCE, PROVENANCE.SEED),
      model: input.provenance?.model ?? null,
      generatedAt: new Date(now).toISOString(),
      /** Set when a live call failed, so the reason is inspectable, not guessed. */
      fallbackReason: input.provenance?.fallbackReason ?? null,
    }),
  });
}
