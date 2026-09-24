import React from 'react';
import { SkyState } from '../services/sky/skyService';

export interface CoupleSkyViewProps {
  sky: SkyState;
  compact?: boolean;
  className?: string;
  showMeaning?: boolean;
}

/**
 * Quiet, minimalist Night Sky of the Couple («Наше небо»)
 * - Deep serene dark background
 * - 0 stars = pure empty sky waiting for the first day
 * - Exactly 1 star per real completed calendar MATCH day
 * - New star blooms softly once (500ms) -> line draws gently once (800ms) -> everything stops.
 * - Zero infinite animations, no screensaver particles, no moving objects.
 * - Rock-solid direct SVG coordinate rendering (never clobbered or hidden).
 */
export const CoupleSkyView: React.FC<CoupleSkyViewProps> = ({
  sky,
  compact = false,
  className = '',
  showMeaning = false,
}) => {
  const litPoints = (sky?.points || []).filter((p) => p && p.isLit);
  const litLines = (sky?.lines || []).filter((l) => l && l.isLit);
  const isEmpty = litPoints.length === 0;

  return (
    <div
      className={`relative select-none overflow-hidden rounded-[26px] sm:rounded-[32px] transition-all duration-300 ${
        compact ? 'w-24 h-24' : 'w-full aspect-square max-w-[340px]'
      } ${className}`}
      style={{
        backgroundColor: '#0B0A12',
        background: 'radial-gradient(ellipse at 50% 45%, #161324 0%, #0D0C15 65%, #07060A 100%)',
        boxShadow: compact
          ? '0 2px 10px rgba(0,0,0,0.25)'
          : 'inset 0 1px 1px rgba(255,255,255,0.08), 0 14px 40px -10px rgba(0, 0, 0, 0.7)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="w-full h-full block"
        preserveAspectRatio="xMidYMid meet"
        aria-label={`Наше небо: ${sky?.title || ''}`}
      >
        <defs>
          {/* Subtle star halo */}
          <radialGradient id="quietStarHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="35%" stopColor="#FAD4DF" stopOpacity="0.65" />
            <stop offset="70%" stopColor="#E98787" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#E98787" stopOpacity="0" />
          </radialGradient>

          {/* New star bloom aura */}
          <radialGradient id="newStarBloomHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="30%" stopColor="#FFDEE7" stopOpacity="0.8" />
            <stop offset="65%" stopColor="#E2768E" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#E2768E" stopOpacity="0" />
          </radialGradient>

          {/* Minimalist constellation line stroke */}
          <linearGradient id="quietLineStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCE4EC" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#E59CAD" stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {/* 1. Constellation Connecting Lines */}
        <g className="constellation-lines">
          {litLines.map((line) => {
            const isNew = Boolean(line.connectsNewest);
            return (
              <line
                key={`line-${line.fromId}-${line.toId}`}
                x1={line.from.x}
                y1={line.from.y}
                x2={line.to.x}
                y2={line.to.y}
                stroke="url(#quietLineStroke)"
                strokeWidth={compact ? '1.1' : '1.35'}
                strokeLinecap="round"
                strokeDasharray={isNew ? '100' : undefined}
                style={
                  isNew
                    ? {
                        animation:
                          'drawQuietLine 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s forwards',
                        strokeDashoffset: 100,
                        opacity: 0,
                      }
                    : undefined
                }
              />
            );
          })}
        </g>

        {/* 2. Constellation Stars (direct (x, y) placement, guaranteed visible) */}
        <g className="constellation-stars">
          {litPoints.map((point) => {
            const isNew = Boolean(point.isNewest);
            return (
              <g
                key={`star-${point.id}`}
                className={isNew ? 'animate-star-bloom' : undefined}
                style={
                  isNew
                    ? {
                        animation:
                          'newStarFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                      }
                    : undefined
                }
              >
                {/* 1. Soft atmospheric outer aura */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isNew ? 6.5 : 4.8}
                  fill={isNew ? 'url(#newStarBloomHalo)' : 'url(#quietStarHalo)'}
                  opacity={isNew ? 0.95 : 0.75}
                />

                {/* 2. Mid-glow layer */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isNew ? 3.6 : 2.8}
                  fill="#FAD2DC"
                  opacity={0.6}
                />

                {/* 3. Star shape: 4-point Diamond sparkle for anchors, or solid star core */}
                {point.role === 'anchor' ? (
                  <path
                    d={`M ${point.x} ${point.y - 3.2} Q ${point.x} ${point.y} ${point.x + 3.2} ${point.y} Q ${point.x} ${point.y} ${point.x} ${point.y + 3.2} Q ${point.x} ${point.y} ${point.x - 3.2} ${point.y} Q ${point.x} ${point.y} ${point.x} ${point.y - 3.2} Z`}
                    fill="#FFFFFF"
                  />
                ) : (
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={isNew ? 2.2 : 1.8}
                    fill="#FFFFFF"
                  />
                )}

                {/* 4. Bright white glint center */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isNew ? 1.0 : 0.8}
                  fill="#FFFFFF"
                />
              </g>
            );
          })}
        </g>

        {/* 3. Empty Sky Text (If 0 stars yet) */}
        {isEmpty && !compact && (
          <text
            x="50"
            y="52"
            textAnchor="middle"
            fill="#8E8594"
            fontSize="3.8"
            fontFamily="inherit"
            letterSpacing="0.04em"
            opacity="0.8"
          >
            Здесь будет ваша история.
          </text>
        )}
      </svg>

      {/* Optional meaning footnote if requested */}
      {showMeaning && !isEmpty && sky?.template?.meaning && (
        <div className="absolute bottom-2.5 inset-x-3 text-center pointer-events-none">
          <span className="text-[10px] text-[#C4B7C1] bg-[#0A0910]/70 backdrop-blur-xs px-2 py-0.5 rounded-full border border-white/10">
            {sky.template.meaning}
          </span>
        </div>
      )}

      <style>{`
        @keyframes drawQuietLine {
          from {
            stroke-dashoffset: 100;
            opacity: 0;
          }
          to {
            stroke-dashoffset: 0;
            opacity: 1;
          }
        }
        @keyframes newStarFadeIn {
          0% {
            opacity: 0;
          }
          100% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
