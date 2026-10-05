import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { triggerHaptic, playSoftChime } from '../services/feedback';

interface MatchButtonProps {
  onClick: () => void;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
  disabled?: boolean;
  className?: string;
}

export const MatchButton: React.FC<MatchButtonProps> = ({
  onClick,
  soundEnabled = true,
  hapticEnabled = true,
  disabled = false,
  className = '',
}) => {
  const [isActivating, setIsActivating] = useState(false);

  const handleClick = () => {
    if (disabled || isActivating) return;

    // Trigger immediate tactile and audible response
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);

    // Enter State 5: Converging Connection Bloom (~140ms before launching full Match scene)
    setIsActivating(true);

    setTimeout(() => {
      onClick();
    }, 140);
  };

  return (
    <div className={`w-full max-w-[320px] xs:max-w-[340px] mx-auto relative ${className}`}>
      {/* 1. Atmospheric Ambient Aura (Breathes softly behind the button) */}
      <div
        className={`absolute -inset-1.5 rounded-full transition-all duration-500 ease-out pointer-events-none blur-lg ${
          isActivating
            ? 'bg-gradient-to-r from-rose-300 via-pink-300 to-amber-200 opacity-95 scale-110'
            : 'bg-gradient-to-r from-[#F7B0BE]/40 via-[#E98787]/45 to-[#F39C7D]/35 opacity-70 group-hover:opacity-100 group-hover:scale-105'
        }`}
      />

      {/* 2. Main Match Pill CTA Button */}
      <button
        type="button"
        disabled={disabled || isActivating}
        onClick={handleClick}
        className="group relative w-full h-[52px] xs:h-[54px] rounded-full px-6 py-3 bg-gradient-to-r from-[#F0B9C6] via-[#E98787] to-[#E27A7A] dark:from-[#C95B6F] dark:via-[#B84E5B] dark:to-[#A33E4D] border border-white/35 dark:border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.45),0_8px_24px_-6px_rgba(233,135,135,0.32)] dark:shadow-[inset_0_1px_1px_rgba(255,255,255,0.2),0_8px_24px_-6px_rgba(0,0,0,0.5)] flex items-center justify-center gap-2.5 cursor-pointer select-none transition-all duration-200 ease-out hover:opacity-95 active:scale-[0.985] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
        aria-label="Открыть момент"
      >
        {/* Subtle glass reflection sheen on top half */}
        <div className="absolute inset-x-3 top-0 h-1/2 bg-gradient-to-b from-white/28 via-white/10 to-transparent rounded-t-full pointer-events-none" />

        {/* 3. The Converging Two-Soul Connection Motif */}
        <div className="flex items-center gap-1.5 shrink-0 relative z-10">
          {/* Left Soul Node (User) */}
          <span
            className={`w-2 h-2 rounded-full bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out ${
              isActivating ? 'translate-x-3 opacity-0 scale-50' : 'group-hover:scale-110'
            }`}
          />

          {/* Whispering connection bridge */}
          <span
            className={`w-1.5 h-px bg-white/50 transition-opacity duration-300 ${
              isActivating ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Central Union Heart */}
          <div
            className={`flex items-center justify-center transition-transform duration-300 ease-out ${
              isActivating ? 'scale-135' : 'group-hover:scale-108'
            }`}
          >
            <Heart
              size={15}
              fill="currentColor"
              className="text-white"
            />
          </div>

          {/* Whispering connection bridge */}
          <span
            className={`w-1.5 h-px bg-white/50 transition-opacity duration-300 ${
              isActivating ? 'opacity-0' : 'opacity-100'
            }`}
          />

          {/* Right Soul Node (Partner) */}
          <span
            className={`w-2 h-2 rounded-full bg-white/95 shadow-[0_1px_3px_rgba(0,0,0,0.18)] transition-all duration-300 ease-out ${
              isActivating ? '-translate-x-3 opacity-0 scale-50' : 'group-hover:scale-110'
            }`}
          />
        </div>

        {/* Button Typography */}
        <span className="font-display font-bold text-[15px] xs:text-[16px] tracking-tight text-white relative z-10">
          {isActivating ? 'Соединяем...' : 'Открыть момент'}
        </span>
      </button>

      {/* Gentle Subtitle */}
      <p className="text-[11px] text-center text-[#8A8488] dark:text-[#B8B2B5] font-medium pt-2 transition-opacity duration-200">
        Оба фото готовы к MATCH ✨
      </p>
    </div>
  );
};
