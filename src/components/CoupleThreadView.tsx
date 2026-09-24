import React, { useMemo } from 'react';
import { generateCoupleThread } from '../services/thread/threadGenerator';

interface CoupleThreadViewProps {
  seed: string;
  totalActiveDays: number;
  currentStreak: number;
  totalMoments: number;
  duoMomentsCount: number;
  partnerAName: string;
  partnerBName: string;
  compact?: boolean;
  className?: string;
}

export const CoupleThreadView: React.FC<CoupleThreadViewProps> = ({
  seed,
  totalActiveDays,
  currentStreak,
  totalMoments,
  duoMomentsCount,
  partnerAName,
  partnerBName,
  compact = false,
  className = '',
}) => {
  const width = compact ? 220 : 320;
  const height = compact ? 64 : 100;

  const artifact = useMemo(() => {
    return generateCoupleThread({
      seed,
      totalActiveDays,
      currentStreak,
      totalMoments,
      duoMomentsCount,
      width,
      height,
    });
  }, [seed, totalActiveDays, currentStreak, totalMoments, duoMomentsCount, width, height]);

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* SVG Canvas for the Two Threads */}
      <div className="relative w-full flex items-center justify-center py-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto max-h-[110px] overflow-visible"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Subtle atmospheric radial glow centered behind thread intersections */}
            <radialGradient id="threadAura" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F6DCE1" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#FFF9FA" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft background aura */}
          <ellipse
            cx={width / 2}
            cy={height / 2}
            rx={width * 0.42}
            ry={height * 0.45}
            fill="url(#threadAura)"
          />

          {/* Line B (Partner) - Warm muted rose-mauve */}
          <path
            d={artifact.pathB}
            stroke="#C9948D"
            strokeWidth={compact ? 2.2 : 2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.75"
            className="transition-all duration-700 ease-out"
          />

          {/* Line A (User) - Soft signature coral-rose */}
          <path
            d={artifact.pathA}
            stroke="#E98787"
            strokeWidth={compact ? 2.2 : 2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity="0.85"
            className="transition-all duration-700 ease-out"
          />

          {/* Shared milestone intersection nodes */}
          {artifact.intersections.map((node) => (
            <g key={node.id}>
              {/* Subtle outer halo */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size + 2.5}
                fill="#F6DCE1"
                fillOpacity="0.5"
              />
              {/* Core node */}
              <circle
                cx={node.x}
                cy={node.y}
                r={node.size}
                fill="#FFFFFF"
                stroke="#E98787"
                strokeWidth="1.5"
              />
            </g>
          ))}
        </svg>
      </div>

      {/* Discreet Legend & Level */}
      {!compact && (
        <div className="w-full flex items-center justify-between text-[11px] text-[#777277] px-2 pt-2 border-t border-[#F0E6E8]/70">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#E98787]" />
              {partnerAName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#C9948D]" />
              {partnerBName}
            </span>
          </div>

          <span className="font-medium text-[#343033]">
            {artifact.levelName}
          </span>
        </div>
      )}
    </div>
  );
};
