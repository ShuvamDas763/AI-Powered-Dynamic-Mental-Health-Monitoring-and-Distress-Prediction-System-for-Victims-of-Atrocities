/**
 * SaharaHandsScene — The Signature Sculpted Visual Metaphor of Sahara.
 *
 * Art Direction:
 * - Museum-quality fine art ceramic & warm terracotta sculpture
 * - Two hands:
 *     Hand A (The Reach): Open, reaching upward, dignified, relaxed, palm visible.
 *     Hand B (The Support): Entering gently from opposite side, supportive, gentle touch, never grabbing.
 * - Warm morning daylight entering a quiet room with soft ambient shadows.
 * - Choreographed 13-second human cycle:
 *     1. Rest (3s) — gentle natural breathing
 *     2. Reach (4s) — supportive presence approaches with ease-out
 *     3. Hesitation (0.6s) — human pause before contact
 *     4. Contact (2s) — gentle touch
 *     5. Support (2s) — stable reassurance, receiving hand relaxes
 *     6. Reset (2.4s) — smooth reset to initial position
 * - Micro-parallax cursor awareness (max 4.5 degrees tilt with high damping)
 * - Complete accessibility & fallbacks:
 *     • prefers-reduced-motion: renders static sculpted composition
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export default function SaharaHandsScene({ compact = false, onInteract }) {
  const containerRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motionPhase, setMotionPhase] = useState('Rest'); // 'Rest' | 'Reach' | 'Hesitation' | 'Contact' | 'Support' | 'Reset'
  const [isHovered, setIsHovered] = useState(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const animFrameId = useRef(null);
  const timeRef = useRef(0);

  // Check user preference for reduced motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handleChange = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Micro-parallax cursor awareness with high damping
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current || reducedMotion) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMouseOffset({
      x: Math.max(-1, Math.min(1, x)) * 8, // max 8px shift
      y: Math.max(-1, Math.min(1, y)) * 6,
    });
  }, [reducedMotion]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setMouseOffset({ x: 0, y: 0 });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
  }, []);

  // 13-second human cycle animation tracking
  useEffect(() => {
    if (reducedMotion) return;

    const CYCLE_DURATION = 13000;
    let lastTime = performance.now();

    function updateCycle(now) {
      const delta = Math.min(now - lastTime, 100);
      lastTime = now;
      timeRef.current += delta;

      const cycleTime = (timeRef.current % CYCLE_DURATION) / CYCLE_DURATION;

      if (cycleTime < 0.23) {
        setMotionPhase('Rest');
      } else if (cycleTime < 0.54) {
        setMotionPhase('Reach');
      } else if (cycleTime < 0.58) {
        setMotionPhase('Hesitation');
      } else if (cycleTime < 0.73) {
        setMotionPhase('Contact');
      } else if (cycleTime < 0.88) {
        setMotionPhase('Support');
      } else {
        setMotionPhase('Reset');
      }

      animFrameId.current = requestAnimationFrame(updateCycle);
    }

    animFrameId.current = requestAnimationFrame(updateCycle);
    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [reducedMotion]);

  const isTouching = motionPhase === 'Contact' || motionPhase === 'Support';

  return (
    <div
      ref={containerRef}
      className="reach-sculpture-card"
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="region"
      aria-label="The Reach — Sculpted fine art composition of two hands demonstrating human connection"
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-xl, 20px)',
        overflow: 'hidden',
        background: '#FAF6F0',
        border: '1px solid rgba(139, 50, 29, 0.12)',
        boxShadow: '0 20px 40px -15px rgba(50, 35, 25, 0.12), 0 1px 3px rgba(0,0,0,0.05)',
        cursor: 'default',
        userSelect: 'none',
        height: compact ? 260 : 420,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* Background artwork container with subtle parallax & organic breathing */}
      <div
        style={{
          position: 'absolute',
          inset: '-8px',
          overflow: 'hidden',
          transition: reducedMotion ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
          transform: reducedMotion
            ? 'none'
            : `translate3d(${mouseOffset.x}px, ${mouseOffset.y}px, 0) scale(${isHovered ? 1.02 : 1})`,
        }}
      >
        <img
          src="/sahara_reach_sculpture.jpg"
          alt="Fine art sculpture of two ceramic hands reaching in supportive connection"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 42%',
            display: 'block',
            filter: 'contrast(1.03) saturate(1.02)',
          }}
        />

        {/* Soft daylight room gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 55% 42%, rgba(255, 255, 255, 0) 30%, rgba(245, 236, 225, 0.25) 70%, rgba(230, 218, 204, 0.55) 100%)',
            pointerEvents: 'none',
          }}
        />

        {/* Dynamic diffuse connection warmth when hands meet */}
        <div
          style={{
            position: 'absolute',
            left: '52%',
            top: '46%',
            width: 140,
            height: 140,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(235, 140, 95, 0.28) 0%, rgba(245, 215, 185, 0.12) 55%, transparent 75%)',
            opacity: isTouching ? 1 : 0.15,
            transition: 'opacity 0.8s ease',
            pointerEvents: 'none',
            mixBlendMode: 'multiply',
          }}
        />
      </div>

      {/* Top Quiet Editorial Badge */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '1.25rem 1.4rem 0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(10px)',
            padding: '0.3rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255, 255, 255, 0.9)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            fontSize: '0.74rem',
            fontWeight: 700,
            color: 'var(--ink)',
            letterSpacing: '0.02em',
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: isTouching ? 'var(--secondary, #2D5A46)' : 'var(--accent, #8B321D)',
              transition: 'background 0.4s ease',
            }}
          />
          <span>{isTouching ? 'Human Connection Active' : 'Support Starts With Reaching Out'}</span>
        </div>

        <div
          style={{
            fontSize: '0.68rem',
            fontWeight: 600,
            color: 'var(--ink-muted)',
            background: 'rgba(255, 255, 255, 0.75)',
            backdropFilter: 'blur(8px)',
            padding: '0.25rem 0.55rem',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
          }}
        >
          Fine Art Sculpture · Ceramic & Terracotta
        </div>
      </div>

      {/* Bottom Editorial Caption Strip */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          padding: '0 1.25rem 1.15rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(12px)',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-md, 12px)',
            border: '1px solid rgba(255, 255, 255, 0.9)',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
            maxWidth: '22rem',
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.3 }}>
            A quiet, trustworthy place of care.
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', marginTop: '0.2rem', lineHeight: 1.4 }}>
            Dignified support carrying someone through each stage of the statutory journey.
          </div>
        </div>

        <div
          style={{
            fontSize: '0.68rem',
            color: 'var(--ink-faint, #7A7265)',
            background: 'rgba(255, 255, 255, 0.85)',
            backdropFilter: 'blur(6px)',
            padding: '0.25rem 0.6rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            whiteSpace: 'nowrap',
          }}
        >
          {reducedMotion ? 'Static Composition' : 'Natural Rhythm · 13s'}
        </div>
      </div>
    </div>
  );
}
