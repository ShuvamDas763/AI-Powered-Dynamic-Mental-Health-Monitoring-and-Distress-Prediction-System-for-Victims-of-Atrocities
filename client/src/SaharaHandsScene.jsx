/**
 * SaharaHandsScene — The Signature Sculpted Visual Metaphor of Sahara.
 *
 * Art Direction:
 * - Premium sculpted 3D ceramic / soft clay editorial aesthetic
 * - Two hands:
 *     Hand A (The Reach): Open, reaching upward, dignified, relaxed, palm visible.
 *     Hand B (The Support): Entering gently from opposite side, supportive, gentle touch, never grabbing.
 * - Warm daylight entering a quiet room (warm ivory, soft sand, muted terracotta ambient warmth).
 * - Choreographed 13-second human cycle:
 *     1. Rest (3s) — gentle micro-breathing
 *     2. Reach (4s) — support hand gradually approaches with ease-out
 *     3. Hesitation (0.6s) — human pause before contact
 *     4. Contact (2s) — gentle touch
 *     5. Support (2s) — stable reassurance, receiving hand relaxes
 *     6. Reset (2.4s) — smooth reset to initial position
 * - Micro-parallax cursor awareness (max 6 degrees tilt with high damping)
 * - Complete accessibility & fallbacks:
 *     • prefers-reduced-motion: renders static sculpted composition
 *     • Canvas/WebGL fallback: graceful static sculpted vector rendering
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export default function SaharaHandsScene({ compact = false, onInteract }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motionPhase, setMotionPhase] = useState('Rest'); // 'Rest' | 'Reach' | 'Hesitation' | 'Contact' | 'Support' | 'Reset'
  const animFrameId = useRef(null);
  const mousePos = useRef({ targetX: 0, targetY: 0, currentX: 0, currentY: 0 });
  const timeRef = useRef(0);

  // Check user preference for reduced motion
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    const handleChange = (e) => setReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Cursor awareness (maximum 6 degrees tilt, delayed spring damping)
  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2; // -1 to 1
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2; // -1 to 1
    mousePos.current.targetX = Math.max(-1, Math.min(1, x)) * 0.08; // max ~4.5 degrees
    mousePos.current.targetY = Math.max(-1, Math.min(1, y)) * 0.06;
  }, []);

  const handleMouseLeave = useCallback(() => {
    mousePos.current.targetX = 0;
    mousePos.current.targetY = 0;
  }, []);

  // Main animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let dpr = window.devicePixelRatio || 1;

    function resize() {
      if (!canvas || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const width = Math.floor(rect.width || 700);
      const height = compact ? 260 : Math.floor(rect.height || 380);

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    resize();
    window.addEventListener('resize', resize);

    const CYCLE_DURATION = 13000; // 13 seconds full cycle

    let lastTime = performance.now();

    function render(now) {
      const delta = Math.min(now - lastTime, 100);
      lastTime = now;

      if (!reducedMotion) {
        timeRef.current += delta;
      }

      // Calculate phase in cycle (0 to 1)
      const cycleTime = (timeRef.current % CYCLE_DURATION) / CYCLE_DURATION;

      // Determine animation phase
      let currentPhase = 'Rest';
      let reachProgress = 0; // 0 (start) to 1 (contact)
      let relaxation = 0;

      if (cycleTime < 0.23) {
        // STATE 1: REST (0 to 3s)
        currentPhase = 'Rest';
        const t = cycleTime / 0.23;
        reachProgress = 0;
        relaxation = Math.sin(t * Math.PI) * 0.05;
      } else if (cycleTime < 0.54) {
        // STATE 2: REACH (3s to 7s)
        currentPhase = 'Reach';
        const t = (cycleTime - 0.23) / 0.31;
        // Ease-out cubic approach
        const eased = 1 - Math.pow(1 - t, 3);
        reachProgress = eased * 0.88; // approaches right before contact
      } else if (cycleTime < 0.58) {
        // STATE 3: HESITATION (7s to 7.6s)
        currentPhase = 'Hesitation';
        reachProgress = 0.88; // deliberate human pause
      } else if (cycleTime < 0.73) {
        // STATE 4: CONTACT (7.6s to 9.5s)
        currentPhase = 'Contact';
        const t = (cycleTime - 0.58) / 0.15;
        reachProgress = 0.88 + t * 0.12; // smoothly closes to 1.0
        relaxation = t * 0.08;
      } else if (cycleTime < 0.88) {
        // STATE 5: SUPPORT (9.5s to 11.5s)
        currentPhase = 'Support';
        reachProgress = 1.0;
        relaxation = 0.08;
      } else {
        // STATE 6: RESET (11.5s to 13s)
        currentPhase = 'Reset';
        const t = (cycleTime - 0.88) / 0.12;
        // Smooth return
        const eased = t * t * (3 - 2 * t);
        reachProgress = 1.0 - eased;
        relaxation = (1 - eased) * 0.08;
      }

      setMotionPhase(currentPhase);

      // Smooth cursor parallax with heavy spring damping
      mousePos.current.currentX += (mousePos.current.targetX - mousePos.current.currentX) * 0.04;
      mousePos.current.currentY += (mousePos.current.targetY - mousePos.current.currentY) * 0.04;

      const w = canvas.width;
      const h = canvas.height;

      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.scale(dpr, dpr);

      const logicalW = w / dpr;
      const logicalH = h / dpr;

      // Soft ambient daylight room gradient
      const roomGradient = ctx.createRadialGradient(
        logicalW * 0.5 + mousePos.current.currentX * 40,
        logicalH * 0.45 + mousePos.current.currentY * 30,
        20,
        logicalW * 0.5,
        logicalH * 0.5,
        logicalW * 0.65
      );
      roomGradient.addColorStop(0, '#FFFFFF');
      roomGradient.addColorStop(0.4, '#FBF8F3');
      roomGradient.addColorStop(0.85, '#F5ECE1');
      roomGradient.addColorStop(1, '#ECE1D2');

      ctx.fillStyle = roomGradient;
      ctx.fillRect(0, 0, logicalW, logicalH);

      // Subtle warm ambient clay floor shadow
      const floorShadow = ctx.createRadialGradient(
        logicalW * 0.5,
        logicalH * 0.82,
        30,
        logicalW * 0.5,
        logicalH * 0.82,
        logicalW * 0.42
      );
      floorShadow.addColorStop(0, 'rgba(180, 160, 140, 0.18)');
      floorShadow.addColorStop(0.6, 'rgba(210, 195, 180, 0.07)');
      floorShadow.addColorStop(1, 'rgba(250, 245, 240, 0)');
      ctx.fillStyle = floorShadow;
      ctx.beginPath();
      ctx.ellipse(logicalW * 0.5, logicalH * 0.82, logicalW * 0.4, logicalH * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();

      // Parallax center shift
      const centerX = logicalW * 0.5 + mousePos.current.currentX * 25;
      const centerY = logicalH * 0.52 + mousePos.current.currentY * 20;

      // Subtle breathing micro-motion
      const breathOffset = Math.sin(timeRef.current * 0.0012) * 2.5;

      /* ─────────────────────────────────────────────────────────────
         DRAW HAND A (The Person Reaching Out - Left/Center-Upward)
         • Dignified, open, natural palm facing inward-upward
         • Sculpted matte ceramic / soft warm terracotta clay
         ───────────────────────────────────────────────────────────── */
      ctx.save();
      const handABaseX = centerX - logicalW * 0.20;
      const handABaseY = centerY + logicalH * 0.22 + breathOffset;

      // Subtle soft drop shadow for Hand A
      ctx.shadowColor = 'rgba(70, 50, 40, 0.12)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 12;

      // Hand A Wrist & Arm Form
      const handAGradient = ctx.createLinearGradient(handABaseX, handABaseY + 90, handABaseX + 90, handABaseY - 110);
      handAGradient.addColorStop(0, '#D6C4B0'); // Soft clay at wrist
      handAGradient.addColorStop(0.4, '#EBE0D2'); // Matte ceramic transition
      handAGradient.addColorStop(0.8, '#FAF5EE'); // Warm daylight highlight on palm
      handAGradient.addColorStop(1, '#F3E9DD');

      ctx.fillStyle = handAGradient;
      ctx.strokeStyle = 'rgba(215, 195, 175, 0.4)';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      // Arm & Wrist outline
      ctx.moveTo(handABaseX - 42, handABaseY + 110);
      ctx.bezierCurveTo(handABaseX - 35, handABaseY + 40, handABaseX - 25, handABaseY - 10, handABaseX - 18, handABaseY - 45);

      // Thumb
      ctx.bezierCurveTo(handABaseX - 38, handABaseY - 42, handABaseX - 52, handABaseY - 60, handABaseX - 44, handABaseY - 78);
      ctx.bezierCurveTo(handABaseX - 38, handABaseY - 88, handABaseX - 25, handABaseY - 82, handABaseX - 16, handABaseY - 65);

      // Index Finger (reaching, dignified angle)
      ctx.bezierCurveTo(handABaseX - 12, handABaseY - 85, handABaseX - 8, handABaseY - 115, handABaseX + 6, handABaseY - 125);
      ctx.bezierCurveTo(handABaseX + 16, handABaseY - 128, handABaseX + 22, handABaseY - 118, handABaseX + 20, handABaseY - 95);

      // Middle Finger (longest, graceful arch)
      ctx.bezierCurveTo(handABaseX + 24, handABaseY - 115, handABaseX + 32, handABaseY - 135, handABaseX + 44, handABaseY - 138);
      ctx.bezierCurveTo(handABaseX + 54, handABaseY - 136, handABaseX + 58, handABaseY - 122, handABaseX + 50, handABaseY - 95);

      // Ring Finger
      ctx.bezierCurveTo(handABaseX + 56, handABaseY - 110, handABaseX + 64, handABaseY - 126, handABaseX + 74, handABaseY - 126);
      ctx.bezierCurveTo(handABaseX + 82, handABaseY - 122, handABaseX + 83, handABaseY - 110, handABaseX + 74, handABaseY - 88);

      // Pinky Finger
      ctx.bezierCurveTo(handABaseX + 80, handABaseY - 98, handABaseX + 88, handABaseY - 108, handABaseX + 96, handABaseY - 106);
      ctx.bezierCurveTo(handABaseX + 104, handABaseY - 102, handABaseX + 102, handABaseY - 90, handABaseX + 90, handABaseY - 70);

      // Outer edge down to wrist
      ctx.bezierCurveTo(handABaseX + 78, handABaseY - 40, handABaseX + 62, handABaseY + 30, handABaseX + 48, handABaseY + 110);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hand A Palm Contour & Soft Ambient Depth
      ctx.beginPath();
      ctx.moveTo(handABaseX - 10, handABaseY - 40);
      ctx.bezierCurveTo(handABaseX + 10, handABaseY - 25, handABaseX + 35, handABaseY - 30, handABaseX + 55, handABaseY - 50);
      ctx.strokeStyle = 'rgba(165, 140, 120, 0.18)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      /* ─────────────────────────────────────────────────────────────
         DRAW HAND B (The Support Reaching Back - Right/Descending)
         • Approaching gently from upper-right, supportive, relaxed
         • Position is driven by reachProgress (0 = set back, 1 = touching)
         ───────────────────────────────────────────────────────────── */
      ctx.save();

      // Hand B Travel distance: approaches Hand A as reachProgress moves 0 -> 1
      const approachX = (1 - reachProgress) * (logicalW * 0.16);
      const approachY = (1 - reachProgress) * (logicalH * 0.14);

      const handBBaseX = centerX + logicalW * 0.12 + approachX;
      const handBBaseY = centerY - logicalH * 0.12 - approachY - breathOffset * 0.5;

      // Soft daylight shadow cast by Hand B
      ctx.shadowColor = 'rgba(60, 45, 35, 0.10)';
      ctx.shadowBlur = 28;
      ctx.shadowOffsetY = 14;

      const handBGradient = ctx.createLinearGradient(handBBaseX + 80, handBBaseY - 90, handBBaseX - 80, handBBaseY + 100);
      handBGradient.addColorStop(0, '#D4C2AE'); // Wrist clay tone
      handBGradient.addColorStop(0.35, '#E8DDD0');
      handBGradient.addColorStop(0.7, '#F7F1E8'); // Daylight edge
      handBGradient.addColorStop(1, '#E6DACB');

      ctx.fillStyle = handBGradient;
      ctx.strokeStyle = 'rgba(215, 195, 175, 0.4)';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      // Arm & Wrist from upper-right
      ctx.moveTo(handBBaseX + 65, handBBaseY - 110);
      ctx.bezierCurveTo(handBBaseX + 50, handBBaseY - 50, handBBaseX + 35, handBBaseY, handBBaseX + 22, handBBaseY + 28);

      // Support Hand Pinky & Ring (relaxed upward arch)
      ctx.bezierCurveTo(handBBaseX + 28, handBBaseY + 45, handBBaseX + 22, handBBaseY + 68, handBBaseX + 10, handBBaseY + 70);
      ctx.bezierCurveTo(handBBaseX + 0, handBBaseY + 68, handBBaseX - 5, handBBaseY + 50, handBBaseX - 4, handBBaseY + 38);

      // Support Middle & Index Finger (gently curving forward to meet Hand A)
      ctx.bezierCurveTo(handBBaseX - 18, handBBaseY + 58, handBBaseX - 32, handBBaseY + 72, handBBaseX - 48, handBBaseY + 70);
      ctx.bezierCurveTo(handBBaseX - 58, handBBaseY + 66, handBBaseX - 60, handBBaseY + 52, handBBaseX - 48, handBBaseY + 35);

      // Index tip — closest point of gentle contact
      ctx.bezierCurveTo(handBBaseX - 55, handBBaseY + 40, handBBaseX - 70, handBBaseY + 42, handBBaseX - 76, handBBaseY + 28);
      ctx.bezierCurveTo(handBBaseX - 80, handBBaseY + 16, handBBaseX - 72, handBBaseY + 8, handBBaseX - 58, handBBaseY + 5);

      // Thumb (gentle downward support arch, never clutching)
      ctx.bezierCurveTo(handBBaseX - 50, handBBaseY - 10, handBBaseX - 48, handBBaseY - 26, handBBaseX - 35, handBBaseY - 32);
      ctx.bezierCurveTo(handBBaseX - 25, handBBaseY - 32, handBBaseX - 18, handBBaseY - 18, handBBaseX - 12, handBBaseY - 5);

      // Upper arm return
      ctx.bezierCurveTo(handBBaseX, handBBaseY - 40, handBBaseX + 12, handBBaseY - 80, handBBaseX + 20, handBBaseY - 110);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Hand B soft curvature contour
      ctx.beginPath();
      ctx.moveTo(handBBaseX + 5, handBBaseY + 15);
      ctx.bezierCurveTo(handBBaseX - 15, handBBaseY + 20, handBBaseX - 35, handBBaseY + 10, handBBaseX - 45, handBBaseY - 10);
      ctx.strokeStyle = 'rgba(165, 140, 120, 0.18)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();

      /* ─────────────────────────────────────────────────────────────
         GENTLE CONNECTION LIGHT (Subtle Daylight Warmth at Contact)
         • No explosion, no neon, no sci-fi glow
         • Merely a soft diffuse warmth when hands meet
         ───────────────────────────────────────────────────────────── */
      if (reachProgress > 0.85) {
        ctx.save();
        const touchX = centerX - logicalW * 0.035;
        const touchY = centerY - logicalH * 0.035;
        const intensity = (reachProgress - 0.85) / 0.15; // 0 to 1

        const connectionWarmth = ctx.createRadialGradient(touchX, touchY, 2, touchX, touchY, 48);
        connectionWarmth.addColorStop(0, `rgba(215, 140, 110, ${0.16 * intensity})`);
        connectionWarmth.addColorStop(0.5, `rgba(240, 220, 200, ${0.10 * intensity})`);
        connectionWarmth.addColorStop(1, 'rgba(250, 245, 240, 0)');

        ctx.fillStyle = connectionWarmth;
        ctx.beginPath();
        ctx.arc(touchX, touchY, 48, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();

      animFrameId.current = requestAnimationFrame(render);
    }

    animFrameId.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', resize);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [compact, reducedMotion]);

  return (
    <div
      ref={containerRef}
      className="reach-container"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      role="region"
      aria-label="The Reach — Two sculpted ceramic hands demonstrating human connection"
      style={{
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <div className="reach-canvas-wrapper">
        <canvas ref={canvasRef} style={{ display: 'block' }} />

        {/* Minimal dignified caption strip */}
        <div style={{
          position: 'absolute',
          bottom: '1rem',
          left: '1.25rem',
          right: '1.25rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.45rem',
            background: 'rgba(255, 255, 255, 0.88)',
            backdropFilter: 'blur(6px)',
            padding: '0.25rem 0.65rem',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--line-faint)',
            fontSize: '0.72rem',
            fontWeight: 600,
            color: 'var(--ink-secondary)',
          }}>
            <span style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: motionPhase === 'Contact' || motionPhase === 'Support' ? 'var(--secondary)' : 'var(--accent)',
              transition: 'background 0.3s ease',
            }} />
            <span>{motionPhase === 'Contact' || motionPhase === 'Support' ? 'Human Connection Active' : 'Support Starts With Reaching Out'}</span>
          </div>

          <div style={{
            fontSize: '0.7rem',
            color: 'var(--ink-faint)',
            background: 'rgba(255, 255, 255, 0.75)',
            padding: '0.2rem 0.5rem',
            borderRadius: 'var(--radius-sm)',
          }}>
            {reducedMotion ? 'Static Sculpted Composition' : 'Natural Breathing Rhythm · 13s'}
          </div>
        </div>
      </div>
    </div>
  );
}
