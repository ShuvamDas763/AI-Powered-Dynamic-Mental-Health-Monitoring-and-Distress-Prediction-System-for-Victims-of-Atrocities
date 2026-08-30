/**
 * Rolling baseline for voice features, stored in localStorage.
 *
 * Each case keeps up to `MAX_HISTORY` prior check-in feature snapshots.
 * The baseline is a simple rolling average of those snapshots, giving
 * the person's own "normal" against which the current check-in is compared.
 *
 * All data stays in the browser. Nothing is sent to the server.
 */

const STORAGE_KEY = 'sih26094_voice_baseline';
const MAX_HISTORY = 8;

/**
 * Load all stored baselines from localStorage.
 * Shape: { [caseId]: Array<{ features, timestamp }> }
 */
function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAll(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked — degrade silently.
  }
}

/**
 * Record a set of voice features for a check-in.
 *
 * @param {string} caseId
 * @param {object} features  Output of computeFeatures().
 */
export function recordCheckin(caseId, features) {
  if (!caseId || !features) return;
  const all = loadAll();
  if (!all[caseId]) all[caseId] = [];
  all[caseId].push({ features, timestamp: Date.now() });
  // Keep a rolling window.
  if (all[caseId].length > MAX_HISTORY) {
    all[caseId] = all[caseId].slice(-MAX_HISTORY);
  }
  saveAll(all);
}

/**
 * Get the rolling baseline (average) for a case.
 *
 * Returns null if there are fewer than 2 prior check-ins (not enough
 * data to form a meaningful baseline).
 *
 * @param {string} caseId
 * @returns {object|null}  Averaged feature object.
 */
export function getBaseline(caseId) {
  const all = loadAll();
  const history = all[caseId];
  if (!history || history.length < 2) return null;

  const n = history.length;
  const sum = { avgPitch: 0, pitchVariability: 0, pauseCount: 0, pauseRatio: 0, speakingPace: 0 };

  for (const { features } of history) {
    sum.avgPitch += features.avgPitch;
    sum.pitchVariability += features.pitchVariability;
    sum.pauseCount += features.pauseCount;
    sum.pauseRatio += features.pauseRatio;
    sum.speakingPace += features.speakingPace;
  }

  return {
    avgPitch: +(sum.avgPitch / n).toFixed(1),
    pitchVariability: +(sum.pitchVariability / n).toFixed(1),
    pauseCount: +(sum.pauseCount / n).toFixed(1),
    pauseRatio: +(sum.pauseRatio / n).toFixed(3),
    speakingPace: +(sum.speakingPace / n).toFixed(2),
    sampleCount: n,
  };
}

/**
 * Clear stored baselines for a case (e.g. on sign-out).
 * @param {string} caseId
 */
export function clearBaseline(caseId) {
  const all = loadAll();
  delete all[caseId];
  saveAll(all);
}
