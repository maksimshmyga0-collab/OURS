import React, { useMemo } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { Moment, HistoryDay, CoupleState, CoupleStreakInfo } from '../types';
import {
  getCoupleMatchedDates,
  getMatchedDatesForMonth,
  getSkyForMonth,
  isMomentMatched,
} from '../services/sky/skyService';
import { pluralizeWord } from '../services/gamification';
import { triggerHaptic, playSoftChime } from '../services/feedback';

export interface OurSkyPreviewProps {
  couple: CoupleState;
  todayMoments?: Moment[];
  history?: HistoryDay[];
  pairSeed?: string;
  streakInfo?: CoupleStreakInfo;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
  variant?: 'default' | 'compact';
  onOpenSky: () => void;
  className?: string;
}

/**
 * «Наше небо» Live Preview Window
 *
 * An intimate, miniature celestial window on the Today & Profile screens:
 * - Real sky state matching OurSkyModal (exact count of lit stars from completed MATCH moments)
 * - Deep velvet midnight gradient background (#1A162B -> #100E1C -> #08070E)
 * - Soft nebula ambient glow with quiet twinkling stars & delicate constellation connections
 * - Tactile, pressable window leading directly to the full OurSkyModal
 * - Follows OURS aesthetic: minimal, warm, quiet, zero-pill typography
 */
export const OurSkyPreview: React.FC<OurSkyPreviewProps> = ({
  couple,
  todayMoments = [],
  history = [],
  pairSeed,
  soundEnabled = true,
  hapticEnabled = true,
  variant = 'default',
  onOpenSky,
  className = '',
}) => {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 - 12

  // Derive stable pair seed
  const stablePairSeed = useMemo(() => {
    return (
      couple.id
        ? `pair_${couple.id}`
        : couple.pairSeed || pairSeed || couple.inviteCode || 'ours_pair'
    );
  }, [couple.id, couple.pairSeed, couple.inviteCode, pairSeed]);

  // Extract deduplicated matched calendar dates from today + history
  const allMatchedDates = useMemo(() => {
    return getCoupleMatchedDates(couple, todayMoments, history, now);
  }, [couple, todayMoments, history, now]);

  const monthMatchedDates = useMemo(() => {
    return getMatchedDatesForMonth(allMatchedDates, currentYear, currentMonth);
  }, [allMatchedDates, currentYear, currentMonth]);

  const starsCount = monthMatchedDates.length;

  // Generate authoritative Sky state
  const sky = useMemo(() => {
    return getSkyForMonth(
      stablePairSeed,
      currentYear,
      currentMonth,
      starsCount,
      true
    );
  }, [stablePairSeed, currentYear, currentMonth, starsCount]);

  // Check if today newly completed a MATCH
  const hasMatchedToday = useMemo(() => {
    return todayMoments.some(isMomentMatched);
  }, [todayMoments]);

  const litPoints = useMemo(() => {
    return (sky?.points || []).filter((p) => p && p.isLit);
  }, [sky]);

  const litLines = useMemo(() => {
    return (sky?.lines || []).filter((l) => l && l.isLit);
  }, [sky]);

  // Map 0-100 coordinates into the 260x100 panoramic viewBox with safe padding
  const mapX = (x: number) => 24 + (x / 100) * 212;
  const mapY = (y: number) => 16 + (y / 100) * 68;

  const handleClick = () => {
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);
    onOpenSky();
  };

  const isCompact = variant === 'compact';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      className={`group relative w-full select-none overflow-hidden cursor-pointer transition-all duration-300 ease-out active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BFC7] ${
        isCompact ? 'h-[82px] sm:h-[86px] rounded-[22px]' : 'h-[108px] sm:h-[114px] rounded-[24px]'
      } ${className}`}
      style={{
        backgroundColor: '#0A0912',
        background:
          'radial-gradient(130% 120% at 50% 15%, #181528 0%, #100E1C 48%, #07060D 100%)',
        boxShadow:
          'inset 0 1px 1.5px rgba(255, 255, 255, 0.09), 0 8px 24px -6px rgba(10, 8, 18, 0.45)',
        border: '1px solid rgba(232, 191, 199, 0.15)',
      }}
      aria-label="Наше небо: открыть звездное созвездие пары"
    >
      {/* 1. Deep Celestial Stardust & Nebula Background (SVG Layer) */}
      <svg
        viewBox="0 0 260 100"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full pointer-events-none block"
        aria-hidden="true"
      >
        <defs>
          {/* Nebula Glow Gradients */}
          <radialGradient id="skyNebulaRose" cx="45%" cy="40%" r="55%">
            <stop offset="0%" stopColor="#E8BFC7" stopOpacity="0.12" />
            <stop offset="50%" stopColor="#E2768E" stopOpacity="0.04" />
            <stop offset="100%" stopColor="#100E1C" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="skyNebulaBlue" cx="75%" cy="60%" r="45%">
            <stop offset="0%" stopColor="#97B2EB" stopOpacity="0.09" />
            <stop offset="60%" stopColor="#7A99E1" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#07060D" stopOpacity="0" />
          </radialGradient>

          {/* Star Halo Gradients */}
          <radialGradient id="previewStarHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="30%" stopColor="#FDECEF" stopOpacity="0.75" />
            <stop offset="65%" stopColor="#E8BFC7" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#E8BFC7" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="previewNewStarHalo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
            <stop offset="25%" stopColor="#FFF0F3" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#E98787" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#E98787" stopOpacity="0" />
          </radialGradient>

          {/* Constellation Line Gradient */}
          <linearGradient id="previewLineStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FCE4EC" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#E59CAD" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {/* Ambient Nebula Clouds */}
        <rect width="100%" height="100%" fill="url(#skyNebulaRose)" />
        <rect width="100%" height="100%" fill="url(#skyNebulaBlue)" />

        {/* Quiet Ambient Stardust Dots */}
        <g opacity="0.22">
          <circle cx="35" cy="22" r="0.6" fill="#FFFFFF" />
          <circle cx="82" cy="78" r="0.5" fill="#FFFFFF" />
          <circle cx="128" cy="18" r="0.7" fill="#FFFFFF" />
          <circle cx="174" cy="82" r="0.6" fill="#FFFFFF" />
          <circle cx="215" cy="30" r="0.5" fill="#FFFFFF" />
          <circle cx="242" cy="68" r="0.6" fill="#FFFFFF" />
        </g>

        {/* 2. Constellation Lines */}
        <g className="sky-lines">
          {litLines.map((line) => {
            const x1 = mapX(line.from.x);
            const y1 = mapY(line.from.y);
            const x2 = mapX(line.to.x);
            const y2 = mapY(line.to.y);
            return (
              <line
                key={`prev-line-${line.fromId}-${line.toId}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="url(#previewLineStroke)"
                strokeWidth="1.1"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>

        {/* 3. Real Lit Constellation Stars */}
        <g className="sky-stars">
          {litPoints.map((point, idx) => {
            const cx = mapX(point.x);
            const cy = mapY(point.y);
            const isNew = Boolean(point.isNewest && hasMatchedToday);
            const isAnchor = point.role === 'anchor';
            const animDuration = 3.2 + (idx % 3) * 0.8;
            const animDelay = (idx * 0.45) % 2.4;

            return (
              <g
                key={`prev-star-${point.id}`}
                style={{
                  animation: `skyTwinkle ${animDuration}s ease-in-out ${animDelay}s infinite`,
                }}
              >
                {/* Outer Glow Halo */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isNew ? 6.8 : isAnchor ? 5.2 : 3.8}
                  fill={isNew ? 'url(#previewNewStarHalo)' : 'url(#previewStarHalo)'}
                  opacity={isNew ? 0.95 : 0.8}
                />

                {/* Star Core Shape */}
                {isAnchor ? (
                  <path
                    d={`M ${cx} ${cy - 2.8} Q ${cx} ${cy} ${cx + 2.8} ${cy} Q ${cx} ${cy} ${cx} ${cy + 2.8} Q ${cx} ${cy} ${cx - 2.8} ${cy} Q ${cx} ${cy} ${cx} ${cy - 2.8} Z`}
                    fill="#FFFFFF"
                  />
                ) : (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isNew ? 1.8 : 1.4}
                    fill="#FFFFFF"
                  />
                )}

                {/* Glint center */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={0.6}
                  fill="#FFFFFF"
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* 2. Glassmorphism Light Reflection Sheen on Top Edge */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

      {/* 3. Content Overlay with Typography and Interactive Indicator */}
      <div
        className={`relative z-10 h-full w-full flex items-center justify-between pointer-events-none ${
          isCompact ? 'px-4.5 py-2.5' : 'px-5 py-3.5'
        }`}
      >
        {/* Left Slot: Emotional Title & Star Count / Status */}
        <div className="flex flex-col justify-center space-y-0.5">
          <div className="inline-flex items-center gap-1.5 text-white">
            <Sparkles size={13} className="text-[#E8BFC7] shrink-0 opacity-95 group-hover:rotate-12 transition-transform duration-300" />
            <span className="font-display font-bold text-sm tracking-tight text-white">
              Наше небо
            </span>
          </div>

          <p className="text-[11px] text-[#D3CDD7] tracking-tight">
            {starsCount === 0 ? (
              <span className="text-[#B5ADC0]">Каждый MATCH зажигает звезду ✨</span>
            ) : (
              <span className="text-[#F3DDE1] font-medium">
                {starsCount} {pluralizeWord(starsCount, 'звезда', 'звезды', 'звёзд')}
                <span className="text-[#988FA4] mx-1">·</span>
                <span className="text-[#D3CDD7]">{sky.monthName}</span>
              </span>
            )}
          </p>
        </div>

        {/* Right Slot: Minimalist Action Affordance */}
        <div className="flex items-center gap-1.5 pl-2">
          <div className="px-2.5 py-1 rounded-full bg-white/12 border border-white/18 text-white text-[10.5px] font-medium flex items-center gap-1 group-hover:bg-white/18 group-hover:border-white/25 transition-all duration-200 shadow-2xs">
            <span>Открыть</span>
            <ChevronRight
              size={12}
              className="text-[#E8BFC7] group-hover:translate-x-0.5 transition-transform duration-200"
            />
          </div>
        </div>
      </div>

      {/* Pure Opacity Twinkle (preserves razor-sharp SVG vector coordinate rasterization) */}
      <style>{`
        @keyframes skyTwinkle {
          0%, 100% {
            opacity: 0.78;
          }
          50% {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};
