/**
 * Deterministic engagement and longitudinal trend metrics.
 *
 * WHY NONE OF THIS CALLS AN LLM
 * -------------------------------------------------------------------------
 * Engagement is a fact about the record, not a reading of text: how many
 * check-ins were missed, whether replies are getting shorter, whether the
 * person is taking longer to answer. Computing it in plain arithmetic makes it
 * reproducible, auditable, free, and available when the network is down.
 *
 * It also makes it impossible for a single cheerful sentence to talk the score
 * down — which is exactly the failure mode spec Section 6's edge-case profile
 * ("I'm totally fine" repeated while engagement collapses) is designed to test.
 *
 * Everything here is a pure function of the check-in history it is handed.
 */

/** Outcome of a scheduled check-in. */
export const CHECK_IN_STATUS = Object.freeze({
  COMPLETED: 'completed',
  /** Started but abandoned partway. Counts as half-engagement. */
  PARTIAL: 'partial',
  MISSED: 'missed',
});

/**
 * How many consecutive mismatched check-ins count as a sustained pattern.
 *
 * Exported so the escalation rule uses the same number rather than keeping its
 * own copy that could drift out of step with the detector.
 */
export const SUSTAINED_MISMATCH_RUN = 3;

/** A surface reading at or below this is "the words sound fine". */
const LOW_SURFACE_DISTRESS = 35;

/** A reply this fraction of the person's own baseline length reads as withdrawn. */
const WITHDRAWN_LENGTH_RATIO = 0.25;

/** Longest missed streak that still adds signal; beyond this it is saturated. */
const MISSED_STREAK_CAP = 3;

/** How much each evidence source can contribute on its own (see combine()). */
const EVIDENCE_CEILING = Object.freeze({
  missed: 0.85,
  streak: 0.7,
  shorteningReplies: 0.75,
  risingLatency: 0.5,
});

const clamp01 = (n) => Math.min(1, Math.max(0, n));
const finite = (n, fallback = 0) => (Number.isFinite(n) ? n : fallback);

/** Least-squares slope of `values` against their index. 0 for <2 points. */
function slope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((a, b) => a + b, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - meanX) * (values[i] - meanY);
    sxx += (i - meanX) ** 2;
  }
  return sxx === 0 ? 0 : sxy / sxx;
}

/**
 * How strongly a series moved in `direction`, as a 0-1 fraction.
 *
 * Compares the mean of the first half against the second half rather than using
 * the raw slope, because a fraction-of-baseline reading stays comparable across
 * people who write at very different lengths.
 */
function shiftStrength(values, direction) {
  if (values.length < 2) return 0;
  const mid = Math.floor(values.length / 2);
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const first = mean(values.slice(0, mid));
  const second = mean(values.slice(mid));
  const [from, to] = direction === 'down' ? [first, second] : [second, first];
  const reference = Math.max(direction === 'down' ? first : second, 1);
  return clamp01((from - to) / reference);
}

/**
 * Combine independent evidence sources into a single 0-100 reading.
 *
 * Uses a noisy-OR rather than a weighted average on purpose. With an average,
 * one strong signal gets diluted by the quiet ones — a person who has missed
 * three check-ins in a row would score mid-range because their replies, when
 * they do reply, are still a normal length. Any one sufficient reason to be
 * concerned should be able to raise the reading by itself; several together
 * raise it further without ever exceeding 100.
 */
function combine(probabilities) {
  const survival = probabilities.reduce((acc, p) => acc * (1 - clamp01(p)), 1);
  return Math.round(100 * (1 - survival));
}

/** Was this check-in answered at all? */
const isCompleted = (c) => c?.status === CHECK_IN_STATUS.COMPLETED;

/** Engagement credit for one check-in: answered 1, abandoned 0.5, missed 0. */
function credit(c) {
  if (c?.status === CHECK_IN_STATUS.COMPLETED) return 1;
  if (c?.status === CHECK_IN_STATUS.PARTIAL) return 0.5;
  return 0;
}

/**
 * Engagement metrics for one person's check-in history.
 *
 * `disengagementScore` is 0-100 where HIGHER MEANS MORE WITHDRAWN, so it points
 * the same direction as every other component of the distress score. Read it as
 * "how much concern does this person's participation pattern warrant".
 */
export function engagementMetrics(checkIns) {
  const history = Array.isArray(checkIns) ? checkIns : [];
  if (history.length === 0) {
    return {
      total: 0,
      completionRate: 1,
      missedStreak: 0,
      wordCountSlope: 0,
      latencySlope: 0,
      disengagementScore: 0,
    };
  }

  const completionRate =
    history.reduce((sum, c) => sum + credit(c), 0) / history.length;

  // Trailing run of missed check-ins. Counted from the most recent backwards,
  // because three missed last month matters less than three missed this week.
  let missedStreak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i]?.status !== CHECK_IN_STATUS.MISSED) break;
    missedStreak++;
  }

  const answered = history.filter(isCompleted);
  const words = answered.map((c) => finite(c.wordCount));
  const latencies = answered.map((c) => finite(c.responseLatencyHours));

  const disengagementScore = combine([
    (1 - completionRate) * EVIDENCE_CEILING.missed,
    (Math.min(missedStreak, MISSED_STREAK_CAP) / MISSED_STREAK_CAP) * EVIDENCE_CEILING.streak,
    shiftStrength(words, 'down') * EVIDENCE_CEILING.shorteningReplies,
    shiftStrength(latencies, 'up') * EVIDENCE_CEILING.risingLatency,
  ]);

  return {
    total: history.length,
    completionRate,
    missedStreak,
    wordCountSlope: slope(words),
    latencySlope: slope(latencies),
    disengagementScore,
  };
}

/** Minimum slope that counts as a real direction rather than noise. */
const TREND_NOISE_FLOOR = 1.5;

/**
 * Direction of travel across a series of distress readings.
 *
 * Spec Section 6's long-pending profile exists to test exactly this: a single
 * message can look unremarkable while the trajectory across months does not.
 */
export function sentimentTrend(values) {
  const series = (Array.isArray(values) ? values : []).map((v) => finite(v));
  if (series.length < 2) return { slope: 0, delta: 0, direction: 'stable' };

  const s = slope(series);
  const delta = series[series.length - 1] - series[0];
  let direction = 'stable';
  if (s > TREND_NOISE_FLOOR) direction = 'rising';
  else if (s < -TREND_NOISE_FLOOR) direction = 'improving';

  return { slope: s, delta, direction };
}

/**
 * Detect surface-positive words paired with withdrawn behaviour.
 *
 * This is the deflection detector, and the reason it is arithmetic rather than a
 * model call: it compares what someone's words *sound like* against what their
 * participation *shows*. An LLM reading one upbeat message has no access to the
 * second half of that comparison.
 *
 * A check-in mismatches when the words read as untroubled AND the person either
 * missed it or answered at a small fraction of their own usual length. Only a
 * trailing run counts — an isolated terse "fine" is ordinary, three in a row
 * while replies shrink is a pattern.
 *
 * Deliberately silent on two shapes it must NOT flag:
 *  - genuinely settled cases (untroubled words, normal participation)
 *  - openly distressed cases (nothing is being masked, so score alone routes it)
 */
export function surfaceUnderlyingMismatch(checkIns) {
  const history = Array.isArray(checkIns) ? checkIns : [];
  if (history.length === 0) return { sustained: false, run: 0, detail: '' };

  // The person's own baseline, not a global one — people write at different
  // lengths, and the signal is a drop relative to how they normally write.
  const baselineWords = Math.max(...history.map((c) => finite(c?.wordCount)), 0);
  const withdrawnBelow = baselineWords * WITHDRAWN_LENGTH_RATIO;

  const mismatched = (c) => {
    const soundsFine = finite(c?.surfaceSentiment, 100) <= LOW_SURFACE_DISTRESS;
    if (!soundsFine) return false;
    if (c?.status === CHECK_IN_STATUS.MISSED) return true;
    return baselineWords > 0 && finite(c?.wordCount) <= withdrawnBelow;
  };

  let run = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    if (!mismatched(history[i])) break;
    run++;
  }

  const sustained = run >= SUSTAINED_MISMATCH_RUN;
  return {
    sustained,
    run,
    detail: run
      ? `Replies have read as untroubled across the last ${run} check-in(s) while ` +
        `participation dropped (usual reply length ~${Math.round(baselineWords)} words).`
      : '',
  };
}
