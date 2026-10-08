import React, { useMemo } from 'react';
import { Moment, HistoryDay, CoupleState, CoupleStreakInfo } from '../types';
import {
  getCoupleMatchedDates,
  getCoupleSkyDates,
  getMatchedDatesForMonth,
  getSkyForMonth,
} from '../services/sky/skyService';
import { dateInvitationService } from '../services/dates/dateInvitationService';
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
 * «Наше небо» Calm & Cohesive Card Button
 * - Minimalist, unified with OURS palette and card architecture
 * - Removed noisy saturated gradients, left star icon, and right look button
 */
export const OurSkyPreview: React.FC<OurSkyPreviewProps> = React.memo(({
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
  const currentMonth = now.getMonth() + 1;

  const stablePairSeed = useMemo(() => {
    return (
      couple.id
        ? `pair_${couple.id}`
        : couple.pairSeed || pairSeed || couple.inviteCode || 'ours_pair'
    );
  }, [couple.id, couple.pairSeed, couple.inviteCode, pairSeed]);

  // Retrieve calendar days with completed/conducted dates (real, confirmed dates only)
  const completedDateDays = useMemo(() => {
    return dateInvitationService.getCompletedDateDays();
  }, [todayMoments, history]);

  // All deduplicated sky dates (1 day = max 1 star: either authentic match or confirmed date)
  const allSkyDates = useMemo(() => {
    return getCoupleSkyDates(couple, todayMoments, history, completedDateDays, now);
  }, [couple, todayMoments, history, completedDateDays, now]);

  const monthSkyDates = useMemo(() => {
    return getMatchedDatesForMonth(allSkyDates, currentYear, currentMonth);
  }, [allSkyDates, currentYear, currentMonth]);

  const starsCount = monthSkyDates.length;

  const sky = useMemo(() => {
    return getSkyForMonth(
      stablePairSeed,
      currentYear,
      currentMonth,
      starsCount,
      true,
      monthSkyDates,
      completedDateDays
    );
  }, [stablePairSeed, currentYear, currentMonth, starsCount, monthSkyDates, completedDateDays]);

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
      className={`group relative w-full select-none overflow-hidden cursor-pointer transition-all duration-200 ease-out active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BFC7] ${
        isCompact
          ? 'min-h-[82px] sm:min-h-[86px] rounded-[22px] p-3.5 sm:p-4'
          : 'min-h-[90px] sm:min-h-[96px] rounded-[24px] p-4 sm:p-4.5'
      } ${className}`}
      style={{
        backgroundColor: '#0A0A14',
        background:
          'radial-gradient(130% 130% at 50% 25%, #161830 0%, #0F1022 45%, #0A0A15 78%, #06060C 100%)',
        boxShadow:
          'inset 0 1px 2px rgba(245, 222, 230, 0.08), 0 12px 32px -8px rgba(6, 6, 14, 0.75)',
        border: '1px solid rgba(232, 191, 199, 0.16)',
      }}
      aria-label={`Наше небо: созвездие за ${sky.monthName}, ${starsCount} ${pluralizeWord(starsCount, 'звезда', 'звезды', 'звёзд')}`}
    >
      {/* 1. Deep Celestial Nebula Atmosphere (Matching Our Sky canvas backdrop) */}
      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full pointer-events-none block"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="skyPreviewNebulaCenter" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="#E8B0BE" stopOpacity="0.14" />
            <stop offset="45%" stopColor="#5B76BA" stopOpacity="0.09" />
            <stop offset="85%" stopColor="#14152B" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#080811" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="skyPreviewNebulaCorner" cx="85%" cy="70%" r="55%">
            <stop offset="0%" stopColor="#7E9BE6" stopOpacity="0.10" />
            <stop offset="60%" stopColor="#2D2B52" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#06060C" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width="100%" height="100%" fill="url(#skyPreviewNebulaCenter)" />
        <rect width="100%" height="100%" fill="url(#skyPreviewNebulaCorner)" />

        {/* Subtle Background Micro-Stardust (Ambient depth only, no main stars) */}
        <g opacity="0.25">
          <circle cx="28" cy="24" r="0.8" fill="#FFFDF8" />
          <circle cx="110" cy="85" r="0.7" fill="#FFF5EA" />
          <circle cx="195" cy="30" r="0.9" fill="#FCE6EC" />
          <circle cx="285" cy="78" r="0.8" fill="#FFFDF8" />
          <circle cx="360" cy="35" r="0.75" fill="#FCE6EC" />
          <circle cx="340" cy="95" r="0.65" fill="#FFF5EA" />
          <circle cx="65" cy="98" r="0.6" fill="#FFFDF8" />
        </g>
      </svg>

      {/* 2. Delicate Top Light Highlight Rim */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/18 to-transparent pointer-events-none" />

      {/* 3. Card Content */}
      <div className="relative z-10 h-full w-full flex items-center justify-between gap-3 pointer-events-none">
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-bold text-[15px] sm:text-[16px] text-white tracking-tight leading-tight">
              Наше небо
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-white/10 text-[#F0B9C6] border border-white/12 shadow-2xs">
              {sky.monthName}
            </span>
          </div>

          <p className="text-[12px] sm:text-[12.5px] text-[#A9A1B8] mt-1 tracking-tight line-clamp-1 font-medium">
            {starsCount === 0 ? (
              <span>Каждый MATCH зажигает звезду в небе</span>
            ) : (
              <span>
                <strong className="font-semibold text-white">
                  {starsCount} {pluralizeWord(starsCount, 'звезда', 'звезды', 'звёзд')}
                </strong>{' '}
                в вашем общем созвездии
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
});

