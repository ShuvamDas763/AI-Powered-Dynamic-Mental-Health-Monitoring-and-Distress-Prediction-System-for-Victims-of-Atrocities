/**
 * Client-side voice feature extraction using the Web Audio API.
 *
 * Computes three acoustic dimensions — pitch variability, pause patterns,
 * and speaking pace — from raw microphone audio. All processing is
 * synchronous DSP on a captured buffer; there is no model, no network
 * call, and no classification step.
 *
 * IMPORTANT — this is an acoustic pattern indicator, not an emotion
 * classifier. The features describe how someone's voice sounds relative
 * to their own baseline, not what they are feeling. The output is a
 * supplementary observation for a counsellor, never a distress signal
 * and never fed into the scoring or escalation pipeline.
 */

const SAMPLE_RATE = 16_000;
const FFT_SIZE = 2048;
const AMPLITUDE_THRESHOLD = 0.02;   // Below this, a frame is "silence"
const PAUSE_MIN_MS = 300;           // Shorter gaps are not counted as pauses

/**
 * Capture microphone audio for `durationMs` and return a mono Float32Array.
 *
 * Returns null if the microphone is unavailable (permission denied, no
 * device, or the user is on an unsupported browser). The caller must
 * handle the null case gracefully — the feature is entirely optional.
 *
 * @param {number} durationMs  How long to record (capped at 30 s).
 * @returns {Promise<Float32Array|null>}  Mono PCM samples at 16 kHz.
 */
export async function captureAudio(durationMs = 15_000) {
  const cappedMs = Math.min(durationMs, 30_000);

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, sampleRate: SAMPLE_RATE },
    });
  } catch {
    // Permission denied, no mic, or insecure context.
    return null;
  }

  const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = FFT_SIZE;
  analyser.smoothingTimeConstant = 0;
  source.connect(analyser);

  // Collect raw samples for the requested duration.
  const totalSamples = Math.floor((cappedMs / 1000) * SAMPLE_RATE);
  const buffer = new Float32Array(totalSamples);
  let written = 0;
  const chunkSize = FFT_SIZE;

  const frameData = new Float32Array(FFT_SIZE);

  let closed = false;
  const result = await new Promise((resolve) => {
    const timer = setInterval(() => {
      analyser.getFloatTimeDomainData(frameData);
      const remaining = totalSamples - written;
      const toCopy = Math.min(chunkSize, remaining);
      buffer.set(frameData.subarray(0, toCopy), written);
      written += toCopy;

      if (written >= totalSamples && !closed) {
        closed = true;
        clearInterval(timer);
        source.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        resolve(buffer);
      }
    }, (chunkSize / SAMPLE_RATE) * 1000);

    // Safety timeout so we never hang.
    setTimeout(() => {
      if (closed) return;
      closed = true;
      clearInterval(timer);
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      try { ctx.close(); } catch { /* already closed */ }
      resolve(buffer.subarray(0, written));
    }, cappedMs + 500);
  });

  return result.length > SAMPLE_RATE ? result : null; // Need at least 1 s
}

/* ── Pitch detection (autocorrelation) ───────────────────────────────── */

/**
 * Detect the dominant pitch (F0) in a single analysis frame.
 * Uses the YIN-style autocorrelation method.
 *
 * @param {Float32Array} frame  Time-domain samples (one FFT_SIZE frame).
 * @returns {number}  Frequency in Hz, or 0 if unvoiced.
 */
function detectPitch(frame) {
  const len = frame.length;
  // Compute squared difference buffer.
  const diff = new Float32Array(len);
  for (let tau = 1; tau < len; tau++) {
    let sum = 0;
    for (let j = 0; j < len - tau; j++) {
      const d = frame[j] - frame[j + tau];
      sum += d * d;
    }
    diff[tau] = sum;
  }

  // Find the first dip below 20% of the initial value (parabolic interp).
  const threshold = diff[1] * 0.2;
  let tau = 2;
  while (tau < len - 1 && diff[tau] > threshold) tau++;
  if (tau >= len - 1) return 0;

  // Parabolic interpolation around the minimum.
  const t0 = tau - 1;
  const t1 = tau;
  const t2 = tau + 1;
  const s0 = diff[t0];
  const s1 = diff[t1];
  const s2 = diff[t2];
  const denom = 2 * (2 * s1 - s0 - s2);
  const shift = denom === 0 ? 0 : (s0 - s2) / denom;
  const period = t1 + shift;

  return period > 0 ? SAMPLE_RATE / period : 0;
}

/* ── Pause detection ─────────────────────────────────────────────────── */

/**
 * Detect pauses (silent segments) in the audio buffer.
 *
 * @param {Float32Array} buf  Full mono buffer.
 * @returns {{ count: number, totalMs: number, segments: Array<{startMs, endMs}> }}
 */
function detectPauses(buf) {
  const frameMs = (FFT_SIZE / SAMPLE_RATE) * 1000;
  const step = FFT_SIZE >> 2; // 75 % overlap for smoother detection
  const segments = [];
  let silenceStart = -1;

  for (let i = 0; i < buf.length - FFT_SIZE; i += step) {
    // RMS of this frame.
    let sum = 0;
    for (let j = 0; j < FFT_SIZE; j++) sum += buf[i + j] ** 2;
    const rms = Math.sqrt(sum / FFT_SIZE);
    const tMs = (i / SAMPLE_RATE) * 1000;

    if (rms < AMPLITUDE_THRESHOLD) {
      if (silenceStart < 0) silenceStart = tMs;
    } else {
      if (silenceStart >= 0) {
        const dur = tMs - silenceStart;
        if (dur >= PAUSE_MIN_MS) {
          segments.push({ startMs: silenceStart, endMs: tMs });
        }
        silenceStart = -1;
      }
    }
  }

  // Close trailing silence.
  if (silenceStart >= 0) {
    const dur = (buf.length / SAMPLE_RATE) * 1000 - silenceStart;
    if (dur >= PAUSE_MIN_MS) {
      segments.push({ startMs: silenceStart, endMs: (buf.length / SAMPLE_RATE) * 1000 });
    }
  }

  const totalMs = segments.reduce((s, seg) => s + (seg.endMs - seg.startMs), 0);
  return { count: segments.length, totalMs, segments };
}

/* ── Feature computation ─────────────────────────────────────────────── */

/**
 * Compute acoustic features from a captured audio buffer.
 *
 * @param {Float32Array} buf  Mono PCM at 16 kHz.
 * @returns {object|null}  Feature object, or null if buffer too short.
 */
export function computeFeatures(buf) {
  if (!buf || buf.length < SAMPLE_RATE) return null;

  const durationMs = (buf.length / SAMPLE_RATE) * 1000;
  const frameMs = (FFT_SIZE / SAMPLE_RATE) * 1000;
  const hopMs = frameMs * 0.25; // 75 % overlap
  const pitchValues = [];

  // Slide a window across the buffer and detect pitch per frame.
  for (let i = 0; i <= buf.length - FFT_SIZE; i += Math.floor(hopMs * SAMPLE_RATE / 1000)) {
    const frame = buf.subarray(i, i + FFT_SIZE);
    const f0 = detectPitch(frame);
    if (f0 >= 60 && f0 <= 600) { // Reasonable human pitch range
      pitchValues.push(f0);
    }
  }

  // Pause analysis.
  const pauses = detectPauses(buf);

  // Pitch statistics.
  const avgPitch = pitchValues.length > 0
    ? pitchValues.reduce((a, b) => a + b, 0) / pitchValues.length
    : 0;
  const pitchStdDev = pitchValues.length > 1
    ? Math.sqrt(pitchValues.reduce((s, p) => s + (p - avgPitch) ** 2, 0) / (pitchValues.length - 1))
    : 0;

  // Speaking pace: voiced frames per second (proxy for syllables/sec).
  const voicedDurationMs = durationMs - pauses.totalMs;
  const speakingPace = voicedDurationMs > 0
    ? (pitchValues.length / (voicedDurationMs / 1000))
    : 0;

  return {
    avgPitch: Math.round(avgPitch),
    pitchVariability: Math.round(pitchStdDev),         // Higher = more variation
    pauseCount: pauses.count,
    pauseRatio: +(pauses.totalMs / durationMs).toFixed(3), // Fraction of time silent
    speakingPace: +speakingPace.toFixed(2),             // Voiced frames / second
    durationMs: Math.round(durationMs),
  };
}

/* ── Baseline comparison ─────────────────────────────────────────────── */

/**
 * Compare current features to the person's own baseline.
 *
 * Returns an object with per-feature deviations (positive = higher than
 * baseline, negative = lower) and a human-readable summary string.
 *
 * The summary is the output shown in the UI. It is always framed as an
 * acoustic observation ("voice pattern"), never as an emotional read.
 *
 * @param {object} current   Output of computeFeatures().
 * @param {object} baseline  Rolling average from voiceBaseline.js.
 * @returns {object}  { deviations, summary, notable }
 */
export function compareFeatures(current, baseline) {
  if (!current || !baseline) {
    return {
      deviations: null,
      summary: 'Voice pattern recorded — baseline builds after your next check-in.',
      notable: false,
    };
  }

  const deviations = {
    pitchVariability: baseline.avgPitch > 0
      ? (current.pitchVariability - baseline.pitchVariability) / Math.max(baseline.pitchVariability, 1)
      : 0,
    pauseCount: baseline.pauseCount > 0
      ? (current.pauseCount - baseline.pauseCount) / Math.max(baseline.pauseCount, 1)
      : 0,
    pauseRatio: baseline.pauseRatio > 0
      ? (current.pauseRatio - baseline.pauseRatio) / Math.max(baseline.pauseRatio, 0.01)
      : 0,
    speakingPace: baseline.speakingPace > 0
      ? (current.speakingPace - baseline.speakingPace) / Math.max(baseline.speakingPace, 1)
      : 0,
  };

  // A feature is "notable" if it deviates by more than 25 % from baseline.
  const NOTABLE_THRESHOLD = 0.25;
  const flags = [];

  if (deviations.speakingPace > NOTABLE_THRESHOLD) flags.push('elevated pace');
  else if (deviations.speakingPace < -NOTABLE_THRESHOLD) flags.push('slower pace');

  if (deviations.pauseCount > NOTABLE_THRESHOLD) flags.push('more pauses than usual');
  else if (deviations.pauseCount < -NOTABLE_THRESHOLD) flags.push('fewer pauses than usual');

  if (deviations.pauseRatio > NOTABLE_THRESHOLD) flags.push('longer silences');
  else if (deviations.pauseRatio < -NOTABLE_THRESHOLD) flags.push('shorter silences');

  if (deviations.pitchVariability > NOTABLE_THRESHOLD) flags.push('wider pitch range');
  else if (deviations.pitchVariability < -NOTABLE_THRESHOLD) flags.push('flatter tone');

  const notable = flags.length > 0;
  const summary = notable
    ? `Voice pattern: ${flags.join(', ')}`
    : 'Voice pattern: consistent with your usual';

  return { deviations, summary, notable };
}
