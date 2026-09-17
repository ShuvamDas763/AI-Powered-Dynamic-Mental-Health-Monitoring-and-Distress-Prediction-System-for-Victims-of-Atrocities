/**
 * VoicePatternIndicator — a supplementary acoustic pattern observation.
 *
 * This component captures a short microphone sample during a check-in,
 * computes simple acoustic features (pitch variability, pause patterns,
 * speaking pace) entirely in the browser, and compares them to the
 * person's own rolling baseline.
 *
 * IMPORTANT — this is NOT an emotion classifier. It describes acoustic
 * patterns ("wider pitch range", "more pauses than usual"), not feelings.
 * The output is labelled honestly and never feeds into the distress
 * score, the band rating, or the escalation logic.
 */

import { useState, useRef, useCallback } from 'react';
import { captureAudio, computeFeatures, compareFeatures } from './voiceAnalysis.js';
import { recordCheckin, getBaseline } from './voiceBaseline.js';

const RECORD_SECONDS = 12;

export default function VoicePatternIndicator({ caseId, enabled = true, hasVoiceConsent = false, onRequestConsent }) {
  const [recording, setRecording] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const handleToggle = useCallback(async () => {
    if (!hasVoiceConsent) {
      if (onRequestConsent) onRequestConsent();
      setError('Voice analysis requires explicit voluntary consent. Please enable voice consent in Consent Settings.');
      return;
    }

    if (recording) {
      // Stop recording — the interval in captureAudio will resolve naturally.
      setRecording(false);
      return;
    }

    setRecording(true);
    setResult(null);
    setError(null);
    setAnalyzing(true);

    try {
      const buf = await captureAudio(RECORD_SECONDS * 1000);
      setRecording(false);

      if (!buf) {
        setError('Microphone unavailable or permission denied.');
        setAnalyzing(false);
        return;
      }

      const features = computeFeatures(buf);
      if (!features) {
        setError('Not enough audio to analyse.');
        setAnalyzing(false);
        return;
      }

      const baseline = getBaseline(caseId);
      const comparison = compareFeatures(features, baseline);

      // Store this check-in's features for future baseline comparison.
      recordCheckin(caseId, features);

      setResult({
        features,
        baseline,
        comparison,
      });
    } catch {
      setError('Could not access microphone.');
    }

    setAnalyzing(false);
  }, [recording, caseId, hasVoiceConsent, onRequestConsent]);

  if (!enabled) return null;

  return (
    <div style={{
      padding: '0.75rem 0.95rem',
      margin: '0.65rem 0',
      background: 'var(--surface)',
      border: '1px solid var(--line-faint)',
      borderRadius: 'var(--radius)',
      fontSize: '0.82rem',
      animation: 'fadeIn 0.3s var(--ease-out)',
    }}>
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '0.35rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.95rem' }}>🎙</span>
          <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '0.82rem' }}>
            Acoustic Pattern Check
          </span>
          <span style={{
            fontSize: '0.68rem',
            padding: '0.1rem 0.4rem',
            borderRadius: 'var(--radius-full)',
            background: hasVoiceConsent ? 'var(--accent-pale)' : 'var(--surface-sunken)',
            color: hasVoiceConsent ? 'var(--accent)' : 'var(--ink-muted)',
            fontWeight: 600,
          }}>
            {hasVoiceConsent ? 'Consented' : 'Consent needed'}
          </span>
        </div>

        <button
          onClick={handleToggle}
          disabled={analyzing}
          style={{
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            border: recording ? '1.5px solid var(--risk-elevated)' : hasVoiceConsent ? '1.5px solid var(--accent)' : '1.5px solid var(--line)',
            background: recording ? 'var(--risk-elevated-bg)' : hasVoiceConsent ? 'var(--accent-pale)' : 'transparent',
            color: recording ? 'var(--risk-elevated)' : hasVoiceConsent ? 'var(--accent)' : 'var(--ink-muted)',
            fontSize: '0.75rem',
            fontWeight: 600,
            cursor: analyzing ? 'not-allowed' : 'pointer',
            transition: 'all var(--duration-fast)',
            font: 'inherit',
            opacity: analyzing ? 0.5 : 1,
          }}
        >
          {recording ? '⏹ Stop' : analyzing ? 'Analysing…' : hasVoiceConsent ? '🎙 Record voice' : 'Enable voice'}
        </button>
      </div>

      {/* Recording indicator */}
      {recording && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.4rem 0',
          color: 'var(--risk-elevated)',
          fontSize: '0.78rem',
          fontWeight: 500,
        }}>
          <span style={{ animation: 'pulse 1s infinite' }}>●</span>
          Recording — speak naturally for a few seconds…
        </div>
      )}

      {/* Error */}
      {error && (
        <p style={{ margin: '0.25rem 0 0', color: 'var(--ink-muted)', fontSize: '0.78rem' }}>
          {error}
        </p>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop: '0.35rem' }}>
          <p style={{
            margin: 0,
            fontSize: '0.82rem',
            fontWeight: 500,
            color: result.comparison.notable ? 'var(--ink)' : 'var(--ink-soft)',
          }}>
            {result.comparison.summary || 'Voice pattern recorded.'}
          </p>

          {/* Feature details — shown only when notable, to avoid noise. */}
          {result.comparison.notable && (
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              flexWrap: 'wrap',
              marginTop: '0.35rem',
            }}>
              {result.features.speakingPace > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                  Pace: {result.features.speakingPace} frames/s
                  {result.baseline?.speakingPace
                    ? ` (baseline: ${result.baseline.speakingPace})`
                    : ''}
                </span>
              )}
              {result.features.pauseCount > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                  Pauses: {result.features.pauseCount}
                  {result.baseline?.pauseCount != null
                    ? ` (baseline: ${result.baseline.pauseCount})`
                    : ''}
                </span>
              )}
              {result.features.pitchVariability > 0 && (
                <span style={{ fontSize: '0.72rem', color: 'var(--ink-muted)' }}>
                  Pitch range: ±{result.features.pitchVariability} Hz
                  {result.baseline?.pitchVariability
                    ? ` (baseline: ±${result.baseline.pitchVariability})`
                    : ''}
                </span>
              )}
            </div>
          )}

          {/* Baseline info */}
          <p style={{
            margin: '0.3rem 0 0',
            fontSize: '0.7rem',
            color: 'var(--ink-faint)',
            fontStyle: 'italic',
          }}>
            {result.baseline
              ? `Compared to your last ${result.baseline.sampleCount} check-in${result.baseline.sampleCount === 1 ? '' : 's'}.`
              : 'Baseline builds after your next check-in — first recording is saved for comparison.'}
          </p>
        </div>
      )}

      {/* Disclaimer — always visible */}
      <p style={{
        margin: '0.4rem 0 0',
        fontSize: '0.68rem',
        color: 'var(--ink-faint)',
        lineHeight: 1.5,
      }}>
        Acoustic pattern indicator — describes how your voice sounds, not how you feel.
        Never used for scoring or escalation.{' '}
        <a
          href="#how-voice-works"
          style={{ color: 'var(--ink-muted)', textDecoration: 'underline' }}
          onClick={(e) => e.preventDefault()}
        >
          How this works
        </a>
      </p>
    </div>
  );
}
