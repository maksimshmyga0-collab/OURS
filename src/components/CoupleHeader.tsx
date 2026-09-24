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
    <header className="sticky top-0 z-30 bg-[#FFF9FA]/92 dark:bg-[#000000]/92 backdrop-blur-xl border-b border-[#000000]/6 dark:border-[#242024] px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 transition-colors">
      {/* Brand logo & wordmark + LOVELY status */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 min-w-0">
        <OursLogo size={20} className="shrink-0" />
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-display font-semibold tracking-wide text-base sm:text-lg text-[#343033] dark:text-white leading-none shrink-0">
            OURS
          </span>
          {isLovely && (
            <span className="text-[9px] sm:text-[10px] font-bold tracking-wider sm:tracking-widest text-[#E98787] dark:text-[#F0B9C6] uppercase leading-none select-none px-1.5 py-0.5 rounded-full bg-[#FAF0F2] dark:bg-[#251720] border border-[#EED7DC]/70 dark:border-[#382329] shrink-0">
              LOVELY
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 shrink">
        {/* Наше небо Pill */}
        <button
          type="button"
          onClick={onOpenStreak}
          className="min-h-[32px] sm:min-h-[34px] flex items-center gap-1 sm:gap-1.5 py-1 px-2 sm:px-2.5 rounded-full bg-white/85 dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] text-xs font-semibold text-[#343033] dark:text-white transition-all duration-200 ease-out hover:bg-white dark:hover:bg-[#252225] active:scale-[0.97] cursor-pointer shadow-2xs shrink-0"
          title="Наше небо"
        >
          <Sparkles size={14} className="text-[#E98787] dark:text-[#F0B9C6] shrink-0" />
          <span>{currentStreak > 0 ? `${currentStreak}` : '0'}</span>
        </button>

        {/* Partner names & paired mini avatars */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="min-h-[32px] sm:min-h-[34px] flex items-center gap-1.5 sm:gap-2 py-1 px-2 sm:px-2.5 rounded-full bg-white/85 dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] transition-all duration-200 ease-out hover:bg-white dark:hover:bg-[#252225] active:scale-[0.97] cursor-pointer shadow-2xs min-w-0 max-w-[130px] sm:max-w-[200px]"
          title="Профиль пары"
        >
          <div className="flex items-center -space-x-2 shrink-0">
            <Avatar
              name={couple.user.name}
              size="sm"
              bgColor={couple.user.avatarColor}
              imageUrl={couple.user.avatarUrl}
              variant="user"
            />
            <Avatar
              name={couple.partner.name}
              size="sm"
              bgColor={couple.partner.avatarColor}
              imageUrl={couple.partner.avatarUrl}
              variant="partner"
            />
          </div>
          <span className="text-xs font-medium text-[#343033] dark:text-white tracking-tight truncate">
            {couple.user.name} + {couple.partner.name}
          </span>
        </button>
      </div>
    </header>
  );
};
