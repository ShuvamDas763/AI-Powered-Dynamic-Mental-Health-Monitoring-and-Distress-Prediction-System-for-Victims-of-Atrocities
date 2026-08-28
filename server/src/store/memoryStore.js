/**
 * The in-memory store. Holds the identified tier and nothing else.
 *
 * WHAT THIS IS AND IS NOT
 * -------------------------------------------------------------------------
 * This is the IDENTIFIED data product from access/roles.js — pseudonymous case
 * records, their check-in history, and their assessment series. Counsellor-tier
 * routes read it. Admin-tier routes must never touch it; the aggregate tier is a
 * separate projection that consumes only latest-assessment summaries and emits
 * counts. Keeping that a module boundary rather than a conditional inside one
 * function is the point: there is no code path where an aggregate response is one
 * forgotten `if` away from serialising a person's check-in text.
 *
 * WHY RAW INPUTS ARE KEPT AND RECORDS ARE REBUILT
 * -------------------------------------------------------------------------
 * The store keeps the raw check-in declarations, not the finished records, and
 * rebuilds through makeCheckInHistory on every write. That looks wasteful for six
 * cases and it buys two things worth far more than the cycles:
 *
 *  - A live check-in added during the demo goes through exactly the same factory
 *    as the seed, so its word count is derived from what the person actually typed
 *    and cannot be asserted by whatever called the API.
 *  - Carry-forward of a surface reading across a missed check-in is threaded by
 *    the factory in one pass over the whole history. Appending to a finished array
 *    would need that logic duplicated here, where it would drift.
 *
 * The assessment series is recomputed the same way, so every point on a trend
 * chart stays a real prefix-only assessment after a live write, not a stale one
 * with a new dot on the end.
 */

import { buildPersonaCases } from '../data/personas.js';
import { assessCaseHistory } from '../domain/assessCase.js';
import { makeCheckInHistory, PROVENANCE } from '../domain/records.js';

/**
 * Build a store.
 *
 * Exposed as a factory rather than only a singleton so tests get an isolated
 * instance with a fixed clock instead of mutating shared module state.
 *
 * @param {{ now?: number }} options `now` fixes the clock the seed's relative
 *   dates resolve against. Defaults to the real one.
 */
export function createStore(options = {}) {
  const seedClock = Number.isFinite(options.now) ? options.now : Date.now();

  /** caseId -> { caseRecord, raw, history, series }. */
  const cases = new Map();

  /** Recompute history and assessments for one case from its raw declarations. */
  function rebuild(entry) {
    const history = makeCheckInHistory(entry.caseRecord.caseId, entry.raw, { now: seedClock });
    const series = assessCaseHistory(entry.caseRecord, history, { now: seedClock });
    entry.history = history;
    entry.series = series;
    return entry;
  }

  // Seed the six personas. buildPersonaCases already returns finished records, but
  // the raw declarations are what this store needs to stay appendable, so the
  // history is unwrapped back into raw form here.
  for (const { caseRecord, history } of buildPersonaCases({ now: seedClock })) {
    const raw = history.map((c) => ({
      daysAgo: c.daysAgo,
      occurredAt: c.occurredAt,
      status: c.status,
      channel: c.channel,
      locale: c.locale,
      turns: c.turns.map((t) => ({ speaker: t.speaker, text: t.text })),
      responseLatencyHours: c.responseLatencyHours,
      // Only a reading the check-in owns is carried over. A value that was
      // inherited from the previous check-in must be re-derived on rebuild, not
      // frozen in as if it were this check-in's own.
      surfaceSentiment: c.surfaceSentimentCarriedForward ? undefined : c.surfaceSentiment,
      signals: [...c.signals],
      signalPhrases: [...c.signalPhrases],
      immediateReviewRequested: c.immediateReviewRequested,
      provenance: c.provenance,
    }));
    cases.set(caseRecord.caseId, rebuild({ caseRecord, raw, history: [], series: [] }));
  }

  const entry = (caseId) => cases.get(caseId) ?? null;

  return {
    /** The clock the seed resolved against. Useful for deterministic tests. */
    seedClock,

    /** Case records only — no history, no scores. */
    listCases() {
      return [...cases.values()].map((e) => e.caseRecord);
    },

    /** One case record, or null. */
    getCase(caseId) {
      return entry(caseId)?.caseRecord ?? null;
    },

    /** Full check-in history for one case, oldest first. */
    getHistory(caseId) {
      return entry(caseId)?.history ?? [];
    },

    /** Every assessment for one case, one per check-in, oldest first. */
    getAssessmentSeries(caseId) {
      return entry(caseId)?.series ?? [];
    },

    /** The current assessment for one case, or null when there is no history. */
    getLatestAssessment(caseId) {
      return entry(caseId)?.series.at(-1) ?? null;
    },

    /**
     * Record a new check-in and return the assessment it produces.
     *
     * `raw.turns` is the conversation as it happened. Word count, status and
     * engagement metrics are derived from it downstream — this method does not
     * accept them, so an API caller cannot assert an engagement pattern.
     *
     * @returns the new latest assessment, or null if the case does not exist.
     */
    appendCheckIn(caseId, raw = {}, appendOptions = {}) {
      const found = entry(caseId);
      if (!found) return null;

      const at = Number.isFinite(appendOptions.now) ? appendOptions.now : Date.now();
      found.raw = [...found.raw, {
        ...raw,
        // A live check-in is pinned to an absolute moment. Recording it as
        // `daysAgo` would make it drift backwards every time the store is rebuilt.
        occurredAt: raw.occurredAt ?? new Date(at).toISOString(),
        daysAgo: undefined,
        provenance: raw.provenance ?? PROVENANCE.LIVE,
      }];
      rebuild(found);
      return found.series.at(-1);
    },

    /**
     * Cases ranked for a counsellor's attention — spec Section 4's case
     * prioritisation requirement.
     *
     * Escalated cases come first as a block, because an unescalated case scoring
     * 60 must never sort above an escalated one scoring 45: escalation means a
     * named rule fired, and a raw number should not be able to outrank that.
     * Within each block, the priority-adjusted score orders them, so the docket's
     * own sensitivity is reflected rather than the bare distress reading.
     */
    prioritisedQueue() {
      return [...cases.values()]
        .map((e) => ({
          caseRecord: e.caseRecord,
          assessment: e.series.at(-1) ?? null,
          checkInCount: e.history.length,
        }))
        .filter((row) => row.assessment !== null)
        .sort((a, b) => {
          const escalated = Number(b.assessment.escalation.triggered) - Number(a.assessment.escalation.triggered);
          if (escalated !== 0) return escalated;
          const adjusted = b.assessment.escalation.priorityAdjustedScore - a.assessment.escalation.priorityAdjustedScore;
          if (adjusted !== 0) return adjusted;
          // Stable tie-break so the queue does not reshuffle between requests.
          return a.caseRecord.caseId.localeCompare(b.caseRecord.caseId);
        });
    },

    /** Just the cases a named rule has escalated, in queue order. */
    alerts() {
      return this.prioritisedQueue().filter((row) => row.assessment.escalation.triggered);
    },

    /**
     * Minimal per-case summaries for the aggregate projection to consume.
     *
     * Deliberately narrow: band, escalation flag, coarse geography, docket stage
     * and tags. No pseudonym, no case id, no check-in text, no quoted phrases.
     * The aggregate tier cannot leak what it was never handed, so the smallest
     * possible input to it is itself a privacy control.
     */
    aggregateInputs() {
      return [...cases.values()]
        .filter((e) => e.series.length > 0)
        .map((e) => {
          const latest = e.series.at(-1);
          return {
            district: e.caseRecord.district,
            state: e.caseRecord.state,
            caseStage: e.caseRecord.caseStage,
            priorityTags: [...e.caseRecord.priorityTags],
            monthsSinceRegistration: e.caseRecord.monthsSinceRegistration,
            band: latest.band,
            escalated: latest.escalation.triggered,
            trendDirection: latest.trend.direction,
            checkInCount: e.history.length,
          };
        });
    },
  };
}

/**
 * The process-wide store the routes read.
 *
 * A hackathon prototype with a lightweight local store, per the spec's stack
 * constraint. Everything above is a pure function of the seed plus whatever was
 * appended, so swapping this for a real database later is a change of one module.
 */
export const store = createStore();
