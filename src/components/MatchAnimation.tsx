import React, { useEffect, useRef } from 'react';
import { playSoftChime, triggerHaptic } from '../services/feedback';

interface MatchAnimationProps {
  onConnection?: () => void;
  onComplete: () => void;
}

interface SparkParticle {
  angle: number;
  speed: number;
  maxDist: number;
  size: number;
  color: string;
  delay: number;
}

/**
 * Draws a prominent, classic, delicate 5-point romantic star with soft rounded corners at (cx, cy)
 */
function drawFivePointStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  fillColor: string,
  glowColor: string,
  alpha: number
) {
  if (alpha <= 0.001 || outerRadius <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

  // 1. Soft diffused outer glow halo
  const outerGlowRadius = outerRadius * 3.4;
  const glowGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerGlowRadius);
  glowGrad.addColorStop(0, glowColor);
  glowGrad.addColorStop(0.35, glowColor.replace(/[\d.]+\)$/, '0.4)'));
  glowGrad.addColorStop(0.7, glowColor.replace(/[\d.]+\)$/, '0.1)'));
  glowGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

  ctx.fillStyle = glowGrad;
  ctx.beginPath();
  ctx.arc(cx, cy, outerGlowRadius, 0, Math.PI * 2);
  ctx.fill();

  // 2. Star Geometry: 5-point star with soft, elegant rounded vertices
  const points = 5;
  const innerRadius = outerRadius * 0.48; // Classic harmonic star ratio
  const cornerRadius = outerRadius * 0.14; // Softly rounded tips and valleys

  const getStarVertices = (outR: number, inR: number) => {
    const verts: { x: number; y: number }[] = [];
    const step = Math.PI / points;
    const startAngle = -Math.PI / 2; // Top tip pointing vertically upward

    for (let i = 0; i < points * 2; i++) {
      const rad = i % 2 === 0 ? outR : inR;
      const angle = startAngle + i * step;
      verts.push({
        x: cx + Math.cos(angle) * rad,
        y: cy + Math.sin(angle) * rad,
      });
    }
    return verts;
  };

  const drawRoundedStarPath = (verts: { x: number; y: number }[], roundR: number) => {
    ctx.beginPath();
    const n = verts.length;
    for (let i = 0; i < n; i++) {
      const p0 = verts[(i - 1 + n) % n];
      const p1 = verts[i];
      const p2 = verts[(i + 1) % n];

      if (i === 0) {
        const midX = (p0.x + p1.x) / 2;
        const midY = (p0.y + p1.y) / 2;
        ctx.moveTo(midX, midY);
      }
      ctx.arcTo(p1.x, p1.y, p2.x, p2.y, roundR);
    }
    ctx.closePath();
  };

  // Draw Main Star Body
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 14;
  ctx.fillStyle = fillColor;
  const mainVerts = getStarVertices(outerRadius, innerRadius);
  drawRoundedStarPath(mainVerts, cornerRadius);
  ctx.fill();

  // 3. Bright White Core Shimmer
  const coreOuterR = outerRadius * 0.44;
  const coreInnerR = coreOuterR * 0.48;
  const coreCornerR = coreOuterR * 0.14;
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowBlur = 6;
  ctx.shadowColor = '#FFFFFF';
  const coreVerts = getStarVertices(coreOuterR, coreInnerR);
  drawRoundedStarPath(coreVerts, coreCornerR);
  ctx.fill();

  ctx.restore();
}

/**
 * OURS Pure Luminous Match Presentation Scene
 * 
 * Single-System Continuous Canvas Engine:
 * - Significantly Larger 5-Point Stars: Scaled 1.7x (~24px radius, ~50px span) for prominent visual presence.
 * - Elevated Positioning: Unified vertical offset of -52px for perfect visual balance in Phone Preview.
 * - Large Radiant Bloom: 1.8x larger layered radial glow (up to 270px) filling the central screen.
 * - Extended Post-Meet Culmination: 1600ms graceful hold & tranquil fade for a deep emotional impression.
 * - Total duration: 2950ms.
 */
export const MatchAnimation: React.FC<MatchAnimationProps> = ({
  onConnection,
  onComplete,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const onConnectionRef = useRef(onConnection);
  onConnectionRef.current = onConnection;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const hasConnectedRef = useRef(false);
  const hasSoundPlayedRef = useRef(false);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animId: number;
    let startTime: number | null = null;

    const TOTAL_DURATION = 2950; // ms (~3.0s total)
    const MEETING_TIME = 1350; // ms: exact moment stars touch at (cx, cy)
    const FLIGHT_START_DIST = 140; // px: comfortable romantic starting distance
    const VERTICAL_OFFSET = 52; // px: elevated 52px above viewport geometric center for optical harmony

    // Pre-generate delicate stardust particles for the fusion moment
    const sparkParticles: SparkParticle[] = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2 + (Math.random() * 0.3 - 0.15);
      const isPink = i % 2 === 0;
      return {
        angle,
        speed: 0.04 + Math.random() * 0.06,
        maxDist: 50 + Math.random() * 60,
        size: 2 + Math.random() * 2.5,
        color: isPink ? 'rgba(244, 184, 197, ' : 'rgba(151, 178, 235, ',
        delay: Math.random() * 120,
      };
    });

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    updateSize();
    window.addEventListener('resize', updateSize);

    // Continuous easing: gentle start, silky-smooth glide into the center without stops
    const easeFlight = (p: number) => {
      const t = Math.max(0, Math.min(1, p));
      return 1 - Math.pow(1 - t, 2.6);
    };

    const renderFrame = (timestamp: number) => {
      if (startTime === null) {
        startTime = timestamp;
      }
      const elapsed = timestamp - startTime;

      const rect = container.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      const cx = width / 2;
      const cy = height / 2 - VERTICAL_OFFSET; // Unified elevated center for all elements

      ctx.clearRect(0, 0, width, height);

      // --- 1. Overlay Fade In & Dissolve ---
      let overlayAlpha = 1.0;
      if (elapsed < 320) {
        overlayAlpha = elapsed / 320;
      } else if (elapsed > 2450) {
        overlayAlpha = Math.max(0, 1 - (elapsed - 2450) / 500);
      }
      if (container) {
        container.style.opacity = `${overlayAlpha}`;
      }

      // --- 2. Ambient Background Glow Halo ---
      if (elapsed < 2800) {
        let ambientAlpha = 0;
        if (elapsed < MEETING_TIME) {
          ambientAlpha = (elapsed / MEETING_TIME) * 0.5;
        } else {
          ambientAlpha = Math.max(0, 0.5 * (1 - (elapsed - MEETING_TIME) / (2800 - MEETING_TIME)));
        }

        const ambientRadius = 220 + Math.sin(Math.min(1, elapsed / TOTAL_DURATION) * Math.PI) * 35;
        const ambGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ambientRadius);
        ambGrad.addColorStop(0, `rgba(240, 185, 198, ${ambientAlpha * 0.4})`);
        ambGrad.addColorStop(0.45, `rgba(151, 178, 235, ${ambientAlpha * 0.25})`);
        ambGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        ctx.save();
        ctx.fillStyle = ambGrad;
        ctx.beginPath();
        ctx.arc(cx, cy, ambientRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- 3. Continuous Star Flight & Convergence ---
      if (elapsed < MEETING_TIME + 200) {
        const flightProg = Math.min(1, elapsed / MEETING_TIME);
        const ease = easeFlight(flightProg);

        // Continuous displacement straight to center
        const currentDist = FLIGHT_START_DIST * (1 - ease);
        
        // Subtle vertical breathing arc
        const arcY = Math.sin(flightProg * Math.PI) * 5;

        const xLeft = cx - currentDist;
        const yLeft = cy - arcY;

        const xRight = cx + currentDist;
        const yRight = cy + arcY;

        // Star Opacity & Size
        let starAlpha = 1.0;
        if (elapsed < 240) {
          starAlpha = elapsed / 240;
        } else if (elapsed > MEETING_TIME) {
          // Smooth dissolution into the central spark
          starAlpha = Math.max(0, 1 - (elapsed - MEETING_TIME) / 200);
        }

        // Prominently enlarged 5-point stars (~36px base radius -> 72-80px total span)
        const starBaseRadius = 36.0;
        const starScale = 0.90 + ease * 0.20; // Gently expands as it nears center

        // Draw Left Star: Yogurt / Romantic Pink 5-point Star (User)
        drawFivePointStar(
          ctx,
          xLeft,
          yLeft,
          starBaseRadius * starScale,
          '#F4B8C5',
          'rgba(244, 184, 197, 0.88)',
          starAlpha
        );

        // Draw Right Star: Soft Celestial Blue 5-point Star (Partner)
        drawFivePointStar(
          ctx,
          xRight,
          yRight,
          starBaseRadius * starScale,
          '#97B2EB',
          'rgba(151, 178, 235, 0.88)',
          starAlpha
        );
      }

      // --- 4. Meeting Sound & Haptic Trigger ---
      if (elapsed >= MEETING_TIME && !hasSoundPlayedRef.current) {
        hasSoundPlayedRef.current = true;
        playSoftChime('match', true);
        triggerHaptic(true);
      }

      // --- 5. Contact Flash Spark & Extended Large Luminous Bloom ---
      if (elapsed >= MEETING_TIME && elapsed < 2900) {
        const postMeet = elapsed - MEETING_TIME;
        const totalPostMeet = TOTAL_DURATION - MEETING_TIME; // 1600ms

        // A. Instant Contact Shimmer Core (0–280ms after meeting)
        if (postMeet < 280) {
          const sparkProg = postMeet / 280;
          const sparkAlpha = Math.sin(sparkProg * Math.PI);
          const sparkRadius = 12 + sparkProg * 36;

          ctx.save();
          const sparkGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sparkRadius);
          sparkGrad.addColorStop(0, `rgba(255, 255, 255, ${sparkAlpha * 0.98})`);
          sparkGrad.addColorStop(0.35, `rgba(244, 184, 197, ${sparkAlpha * 0.8})`);
          sparkGrad.addColorStop(0.7, `rgba(151, 178, 235, ${sparkAlpha * 0.5})`);
          sparkGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

          ctx.fillStyle = sparkGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, sparkRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // B. Large Radiant Luminous Bloom Aura (0–1550ms after meeting)
        if (postMeet < 1550) {
          const bloomProg = postMeet / 1550;
          
          // Eased expansion: expands rapidly in first 500ms, stays large during hold, then fades
          let bloomAlpha = 0;
          if (postMeet < 450) {
            bloomAlpha = (postMeet / 450) * 0.92;
          } else if (postMeet < 1050) {
            bloomAlpha = 0.92; // Serene full bloom hold
          } else {
            bloomAlpha = Math.max(0, 0.92 * (1 - (postMeet - 1050) / 500));
          }

          // Large outer radius up to 260px (fills the central area with soft romantic light)
          const bloomRadius = 40 + Math.pow(Math.min(1, postMeet / 700), 0.7) * 220;

          ctx.save();
          const bloomGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomRadius);
          bloomGrad.addColorStop(0, `rgba(255, 248, 250, ${bloomAlpha * 0.96})`);
          bloomGrad.addColorStop(0.24, `rgba(244, 184, 197, ${bloomAlpha * 0.70})`);
          bloomGrad.addColorStop(0.55, `rgba(151, 178, 235, ${bloomAlpha * 0.50})`);
          bloomGrad.addColorStop(0.82, `rgba(151, 178, 235, ${bloomAlpha * 0.15})`);
          bloomGrad.addColorStop(1, 'rgba(151, 178, 235, 0)');

          ctx.fillStyle = bloomGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, bloomRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // Delicate luminous silk inner core
          ctx.save();
          const coreRadius = 20 + Math.pow(Math.min(1, postMeet / 600), 0.7) * 60;
          const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
          coreGrad.addColorStop(0, `rgba(255, 255, 255, ${bloomAlpha * 0.98})`);
          coreGrad.addColorStop(0.45, `rgba(255, 238, 243, ${bloomAlpha * 0.75})`);
          coreGrad.addColorStop(0.8, `rgba(240, 185, 198, ${bloomAlpha * 0.25})`);
          coreGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
          ctx.fillStyle = coreGrad;
          ctx.beginPath();
          ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        // C. Two Gentle Expanding Ripple Waves
        // Ripple 1
        if (postMeet < 700) {
          const ripProg = postMeet / 700;
          const ripRadius = 12 + Math.pow(ripProg, 0.75) * 130;
          const ripAlpha = (1 - ripProg) * 0.65;

          ctx.save();
          ctx.strokeStyle = `rgba(240, 185, 198, ${ripAlpha})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(cx, cy, ripRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Ripple 2 (delayed by 180ms)
        if (postMeet > 180 && postMeet < 950) {
          const ripProg2 = (postMeet - 180) / 770;
          const ripRadius2 = 14 + Math.pow(ripProg2, 0.75) * 160;
          const ripAlpha2 = (1 - ripProg2) * 0.45;

          ctx.save();
          ctx.strokeStyle = `rgba(151, 178, 235, ${ripAlpha2})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(cx, cy, ripRadius2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // D. Floating Stardust Sparks
        sparkParticles.forEach((sp) => {
          if (postMeet > sp.delay) {
            const pTime = postMeet - sp.delay;
            const pProg = Math.min(1, pTime / 950);
            const dist = sp.maxDist * (1 - Math.pow(1 - pProg, 2.2));
            const px = cx + Math.cos(sp.angle) * dist;
            const py = cy + Math.sin(sp.angle) * dist;
            const pAlpha = Math.sin(pProg * Math.PI) * 0.85;

            ctx.save();
            ctx.fillStyle = `${sp.color}${pAlpha})`;
            ctx.shadowColor = `${sp.color}1)`;
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.arc(px, py, sp.size * (1 - pProg * 0.35), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
      }

      // --- 6. Trigger Background State Update ---
      if (elapsed >= 2400 && !hasConnectedRef.current) {
        hasConnectedRef.current = true;
        onConnectionRef.current?.();
      }

      // --- 7. Animation Complete Callback ---
      if (elapsed >= TOTAL_DURATION) {
        if (!hasCompletedRef.current) {
          hasCompletedRef.current = true;
          onCompleteRef.current?.();
        }
        return;
      }

      animId = requestAnimationFrame(renderFrame);
    };

    animId = requestAnimationFrame(renderFrame);

    return () => {
      window.removeEventListener('resize', updateSize);
      cancelAnimationFrame(animId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] w-full h-full select-none pointer-events-auto bg-[#FFF9FA]/65 dark:bg-[#050406]/70 backdrop-blur-md overflow-hidden flex items-center justify-center"
      aria-label="Момент совпал"
      role="dialog"
      aria-modal="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
      />
    </div>
  );
};
