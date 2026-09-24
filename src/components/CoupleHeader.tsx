import React from 'react';
import { OursLogo } from './OursLogo';
import { Avatar } from './Avatar';
import { CoupleState } from '../types';
import { Flame } from 'lucide-react';

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
  return (
    <header className="sticky top-0 z-30 bg-[#FFF9FA]/92 backdrop-blur-xl border-b border-[#000000]/6 px-4 py-2.5 flex items-center justify-between transition-colors">
      {/* Brand logo & wordmark */}
      <div className="flex items-center gap-2">
        <OursLogo size={20} />
        <span className="font-display font-semibold tracking-wide text-lg text-[#343033]">
          OURS
        </span>
      </div>

      <div className="flex items-center gap-2">
        {/* Streak Pill */}
        <button
          type="button"
          onClick={onOpenStreak}
          className="min-h-[34px] flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-white/85 border border-[#EBE3E5] text-xs font-semibold text-[#343033] transition-all duration-200 ease-out hover:bg-white active:scale-[0.97] cursor-pointer shadow-2xs"
          title="Ваша серия и нить"
        >
          <Flame size={14} className="text-[#E2765A] fill-[#E2765A]/25" />
          <span>{currentStreak > 0 ? `${currentStreak}` : '0'}</span>
        </button>

        {/* Partner names & paired mini avatars */}
        <button
          type="button"
          onClick={onOpenProfile}
          className="min-h-[34px] flex items-center gap-2 py-1 px-2.5 rounded-full bg-white/85 border border-[#EBE3E5] transition-all duration-200 ease-out hover:bg-white active:scale-[0.97] cursor-pointer shadow-2xs"
          title="Профиль пары"
        >
          <div className="flex items-center -space-x-2">
            <Avatar
              name={couple.user.name}
              size="sm"
              bgColor={couple.user.avatarColor}
              imageUrl={couple.user.avatarUrl}
            />
            <Avatar
              name={couple.partner.name}
              size="sm"
              bgColor={couple.partner.avatarColor}
              imageUrl={couple.partner.avatarUrl}
            />
          </div>
          <span className="text-xs font-medium text-[#343033] tracking-tight">
            {couple.user.name} + {couple.partner.name}
          </span>
        </button>
      </div>
    </header>
  );
};

