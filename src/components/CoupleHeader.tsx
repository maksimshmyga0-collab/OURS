import React from 'react';
import { OursLogo } from './OursLogo';
import { Avatar } from './Avatar';
import { CoupleState } from '../types';
import { Sparkles } from 'lucide-react';

interface CoupleHeaderProps {
  couple: CoupleState;
  onOpenProfile?: () => void;
  currentStreak?: number;
  onOpenStreak?: () => void;
}

export const CoupleHeader: React.FC<CoupleHeaderProps> = ({
  couple,
  onOpenProfile,
  currentStreak = 0,
  onOpenStreak,
}) => {
  const isLovely = Boolean(couple.isLovely || couple.subscription === 'premium');

  return (
    <header
      className="sticky top-0 z-30 bg-[#FFF9FA]/92 dark:bg-[#000000]/92 backdrop-blur-xl border-b border-[#000000]/6 dark:border-[#242024] transition-colors"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      <div className="px-3.5 sm:px-4 h-[52px] sm:h-[56px] grid grid-cols-[1fr_auto_1fr] items-center">
        {/* 1. Left Zone: Star Counter («Наше небо») */}
        <div className="flex items-center justify-start min-w-0 pr-1">
          <button
            type="button"
            onClick={onOpenStreak}
            className="min-h-[32px] sm:min-h-[34px] flex items-center gap-1 sm:gap-1.5 py-1 px-2.5 rounded-full bg-white/85 dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] text-xs font-semibold text-[#343033] dark:text-white transition-all duration-200 ease-out hover:bg-white dark:hover:bg-[#252225] active:scale-[0.97] cursor-pointer shadow-2xs shrink-0"
            title="Наше небо"
          >
            <Sparkles size={14} className="text-[#E98787] dark:text-[#F0B9C6] shrink-0" />
            <span>{currentStreak > 0 ? `${currentStreak}` : '0'}</span>
          </button>
        </div>

        {/* 2. Center Zone: Brand logo & wordmark lockup (Visually optical centered, shifted 10px left) */}
        <div className="flex items-center justify-center shrink-0 px-1 sm:px-2 select-none -translate-x-[10px]">
          <OursLogo size={isLovely ? 46 : 52} className="shrink-0 -mr-2.5" />
          <div className="flex flex-col items-start justify-center shrink-0">
            <span className="font-display font-semibold tracking-wide text-base sm:text-lg text-[#343033] dark:text-white leading-none shrink-0">
              OURS
            </span>
            {isLovely && (
              <span className="text-[8px] font-bold tracking-[0.14em] text-[#E98787] dark:text-[#F0B9C6] uppercase leading-none mt-1 shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#FAF0F2] dark:bg-[#251720] border border-[#EED7DC]/80 dark:border-[#382329]">
                <span className="text-[7px] leading-none">♡</span> LOVELY
              </span>
            )}
          </div>
        </div>

        {/* 3. Right Zone: Two Paired Avatars only (No text, 1:1 container matching left star pill) */}
        <div className="flex items-center justify-end min-w-0 pl-1">
          <button
            type="button"
            onClick={onOpenProfile}
            className="min-h-[32px] sm:min-h-[34px] flex items-center justify-center py-1 px-2 rounded-full bg-white/85 dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] transition-all duration-200 ease-out hover:bg-white dark:hover:bg-[#252225] active:scale-[0.97] cursor-pointer shadow-2xs shrink-0"
            title="Профиль пары"
          >
            <div className="flex items-center -space-x-1.5 shrink-0">
              <Avatar
                name={couple.user.name}
                size="xs"
                bgColor={couple.user.avatarColor}
                imageUrl={couple.user.avatarUrl}
                variant="user"
                className="ring-1.5 ring-white dark:ring-[#1E1C1E]"
              />
              <Avatar
                name={couple.partner.name}
                size="xs"
                bgColor={couple.partner.avatarColor}
                imageUrl={couple.partner.avatarUrl}
                variant="partner"
                className="ring-1.5 ring-white dark:ring-[#1E1C1E]"
              />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
