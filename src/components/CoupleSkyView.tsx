import React from 'react';
import { SkyState } from '../services/sky/skyService';

export interface CoupleSkyViewProps {
  sky: SkyState;
  compact?: boolean;
  className?: string;
}

/**
 * Atmospheric Night Sky of the Couple («Наше небо»)
 * - Deep cozy dark-blue/indigo velvet background with layered celestial gradients
 * - Warm champagne/cream/rose glowing stars with natural halos and asynchronous twinkle
 * - Organic, delicate semi-transparent constellation threads
 * - Gentle blooming micro-animation for new stars
 * - 100% deterministic (x,y) positioning derived from pair history
 */
function getFivePointStarPath(cx: number, cy: number, outerR: number, innerR: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 5; i++) {
    const outerAngle = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x1 = cx + outerR * Math.cos(outerAngle);
    const y1 = cy + outerR * Math.sin(outerAngle);
    pts.push(`${i === 0 ? 'M' : 'L'} ${x1.toFixed(3)} ${y1.toFixed(3)}`);

    const innerAngle = outerAngle + Math.PI / 5;
    const x2 = cx + innerR * Math.cos(innerAngle);
    const y2 = cy + innerR * Math.sin(innerAngle);
    pts.push(`L ${x2.toFixed(3)} ${y2.toFixed(3)}`);
  }
  return pts.join(' ') + ' Z';
}

export const CoupleSkyView: React.FC<CoupleSkyViewProps> = ({
  sky,
  compact = false,
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const litPoints = (sky?.points || []).filter((p) => p && p.isLit);
  const litLines = (sky?.lines || []).filter((l) => l && l.isLit);
  const isEmpty = litPoints.length === 0;

  return (
    <div
      className={`relative select-none overflow-hidden rounded-[28px] sm:rounded-[34px] transition-all duration-300 ${
        compact ? 'w-24 h-24' : 'w-full aspect-square max-w-[340px]'
      } ${className}`}
      style={{
        backgroundColor: '#0A0A14',
        background:
          'radial-gradient(120% 120% at 50% 25%, #161830 0%, #0F1022 45%, #0A0A15 78%, #06060C 100%)',
        boxShadow: compact
          ? '0 3px 12px rgba(6, 6, 14, 0.45)'
          : 'inset 0 1px 2px rgba(245, 222, 230, 0.12), 0 16px 44px -10px rgba(6, 6, 14, 0.75)',
        border: '1px solid rgba(232, 191, 199, 0.14)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
        aria-label={`Наше небо: ${sky?.title || ''}`}
      >
        <defs>
          {/* 1. Deep Celestial Nebula Clouds (Background Atmosphere) */}
          <radialGradient id={`skyNebulaCenter-${uid}`} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#E8B0BE" stopOpacity="0.10" />
            <stop offset="45%" stopColor="#5B76BA" stopOpacity="0.08" />
            <stop offset="85%" stopColor="#14152B" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#080811" stopOpacity="0" />
          </radialGradient>

          <radialGradient id={`skyNebulaCorner-${uid}`} cx="80%" cy="75%" r="50%">
            <stop offset="0%" stopColor="#7E9BE6" stopOpacity="0.09" />
            <stop offset="60%" stopColor="#2D2B52" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#06060C" stopOpacity="0" />
          </radialGradient>

          {/* 2. Small Star (Moment ⭐) — Soft Champagne-Rose Luminary Halo */}
          <radialGradient id={`oursMomentAura-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFDF8" stopOpacity="1" />
            <stop offset="25%" stopColor="#FFEED8" stopOpacity="0.65" />
            <stop offset="58%" stopColor="#ECAAB9" stopOpacity="0.20" />
            <stop offset="85%" stopColor="#E98787" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#E98787" stopOpacity="0" />
          </radialGradient>

          {/* 3. Big Star (Date ✨) — Neat Delicate Champagne Glow */}
          <radialGradient id={`oursDateAura-${uid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFDF8" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#FFEED8" stopOpacity="0.55" />
            <stop offset="68%" stopColor="#ECAAB9" stopOpacity="0.14" />
            <stop offset="100%" stopColor="#E98787" stopOpacity="0" />
          </radialGradient>

          {/* 4. Ultra-thin Delicate Constellation Gossamer Thread Gradient */}
          <linearGradient id={`warmLineStroke-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF4E8" stopOpacity="0.28" />
            <stop offset="50%" stopColor="#F4CBD6" stopOpacity="0.20" />
            <stop offset="100%" stopColor="#E8ABC0" stopOpacity="0.14" />
          </linearGradient>

          {/* Delicate soft filter for connecting constellation threads */}
          <filter id={`lineGlow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.14" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Background Ambient Nebula Atmosphere */}
        <rect width="100%" height="100%" fill={`url(#skyNebulaCenter-${uid})`} />
        <rect width="100%" height="100%" fill={`url(#skyNebulaCorner-${uid})`} />

        {/* Subtle Background Micro-Stardust */}
        <g opacity="0.22">
          <circle cx="18" cy="22" r="0.4" fill="#FFFDF8" />
          <circle cx="84" cy="16" r="0.45" fill="#FFF5EA" />
          <circle cx="28" cy="80" r="0.35" fill="#FCE6EC" />
          <circle cx="88" cy="78" r="0.5" fill="#FFFDF8" />
          <circle cx="72" cy="40" r="0.3" fill="#FCE6EC" />
          <circle cx="12" cy="52" r="0.35" fill="#FFF5EA" />
          <circle cx="48" cy="90" r="0.4" fill="#FFFDF8" />
        </g>

        {/* 2. Ultra-Thin Gossamer Constellation Connecting Lines */}
        <g className="constellation-lines" filter={`url(#lineGlow-${uid})`}>
          {litLines.map((line) => {
            const isNew = Boolean(line.connectsNewest);
            return (
              <line
                key={`line-${line.fromId}-${line.toId}`}
                x1={line.from.x}
                y1={line.from.y}
                x2={line.to.x}
                y2={line.to.y}
                stroke={`url(#warmLineStroke-${uid})`}
                strokeWidth={compact ? '0.28' : '0.35'}
                strokeLinecap="round"
                strokeDasharray={isNew ? '100' : undefined}
                style={
                  isNew
                    ? {
                        animation:
                          'drawWarmLine 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.2s forwards',
                        strokeDashoffset: 100,
                        opacity: 0,
                      }
                    : undefined
                }
              />
            );
          })}
        </g>

        {/* 3. Luminous Stars: Small Stars ⭐ (Moments) & Big 5-Point Stars ✨ (Dates) */}
        <g className="constellation-stars">
          {litPoints.map((point, idx) => {
            const isNew = Boolean(point.isNewest);
            const isDateStar = point.starType === 'date';

            // Small Stars scale: natural delicate point (~0.88-0.95)
            const scale = 0.88 + (((idx * 17) % 5) * 0.03);
            const baseOpacity = isDateStar ? 0.96 : 0.82 + (((idx * 11) % 5) * 0.035);

            // Asynchronous, natural breathing rhythm per star (pure opacity pulse, 100% stable in place)
            const animDuration = isDateStar
              ? (4.2 + ((idx * 5) % 4) * 0.4).toFixed(2)
              : (3.2 + ((idx * 7) % 6) * 0.35).toFixed(2);
            const animDelay = (((idx * 13) % 11) * 0.4).toFixed(2);

            return (
              <g
                key={`star-${point.id}`}
                className={isNew ? 'animate-star-bloom' : undefined}
                style={{
                  animation: isNew
                    ? 'newStarWarmFadeIn 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards'
                    : `skyTwinkleAsync ${animDuration}s ease-in-out -${animDelay}s infinite`,
                }}
              >
                {isDateStar ? (
                  /* =======================================================
                     BIG STAR (Date ✨): Neat, classic 5-pointed star
                     ======================================================= */
                  <g>
                    {/* Soft neat outer aura */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={4.6}
                      fill={`url(#oursDateAura-${uid})`}
                      opacity={baseOpacity}
                    />

                    {/* Classic 5-pointed star body */}
                    <path
                      d={getFivePointStarPath(point.x, point.y, 2.45, 1.16)}
                      fill="#FFFDF8"
                      stroke="#FFEED8"
                      strokeWidth="0.22"
                      strokeLinejoin="round"
                    />

                    {/* Central tiny glint core */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={0.65}
                      fill="#FFFFFF"
                    />
                  </g>
                ) : (
                  /* =======================================================
                     SMALL STAR (Moment ⭐): Beloved minimal glowing dot
                     ======================================================= */
                  <g>
                    {/* 1. Deep Atmospheric Outer Halo */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={3.8 * scale}
                      fill={`url(#oursMomentAura-${uid})`}
                      opacity={baseOpacity}
                    />

                    {/* 2. Mid Light-Dispersal Body */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={1.5 * scale}
                      fill="#FFF8EE"
                      opacity={0.64}
                    />

                    {/* 3. Soft oval pearl lens with gentle warmth */}
                    <ellipse
                      cx={point.x}
                      cy={point.y}
                      rx={1.15 * scale}
                      ry={0.98 * scale}
                      fill="#FFFDF8"
                      opacity={0.90}
                    />

                    {/* 4. Central Concentrated Warm Jewel Nucleus */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={0.65 * scale}
                      fill="#FFFDF7"
                    />
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* 4. Empty Sky State (0 stars yet) */}
        {isEmpty && !compact && (
          <g>
            <text
              x="50"
              y="49"
              textAnchor="middle"
              fill="#E8BFC7"
              fontSize="3.6"
              fontFamily="inherit"
              fontWeight="600"
              letterSpacing="0.04em"
              opacity="0.85"
            >
              Ваше созвездие начнётся здесь.
            </text>
            <text
              x="50"
              y="55"
              textAnchor="middle"
              fill="#A9A1B2"
              fontSize="2.8"
              fontFamily="inherit"
              letterSpacing="0.02em"
              opacity="0.70"
            >
              Каждый день с MATCH зажигает новую звезду ✨
            </text>
          </g>
        )}
      </svg>

      {/* Ambient Top Luster Sheen */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/8 via-white/2 to-transparent pointer-events-none" />

      <style>{`
        @keyframes drawWarmLine {
          from {
            stroke-dashoffset: 100;
            opacity: 0;
          }
          to {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
        @keyframes newStarWarmFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
        @keyframes skyTwinkleAsync {
          0%, 100% {
            opacity: 0.76;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
