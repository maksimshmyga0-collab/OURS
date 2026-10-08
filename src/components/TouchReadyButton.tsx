import React, { useRef } from 'react';
import { Heart } from 'lucide-react';
import { triggerHaptic, playSoftChime } from '../services/feedback';
import { optimizePhotoForUpload } from '../services/storage/imageOptimizer';

interface TouchReadyButtonProps {
  onClick?: () => void;
  onPhotoSelected?: (photoDataUrl: string) => void;
  text?: string;
  subtext?: string;
  icon?: React.ReactNode;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
  disabled?: boolean;
  className?: string;
}

export const TouchReadyButton: React.FC<TouchReadyButtonProps> = ({
  onClick,
  onPhotoSelected,
  text = 'Касание готово',
  subtext,
  icon,
  soundEnabled = true,
  hapticEnabled = true,
  disabled = false,
  className = '',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (disabled) return;
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);
    if (onClick) {
      onClick();
    } else if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const fastPreview = URL.createObjectURL(file);
    if (onPhotoSelected) {
      onPhotoSelected(fastPreview);
    }

    try {
      const optimized = await optimizePhotoForUpload(file);
      if (optimized && optimized !== fastPreview) {
        if (onPhotoSelected) {
          onPhotoSelected(optimized);
        }
      }
    } catch (err) {
      console.warn('[TouchReadyButton] Optimization fallback:', err);
    }
  };

  return (
    <div className={`w-full max-w-[335px] xs:max-w-[355px] sm:max-w-[365px] mx-auto select-none animate-touch-enter ${className}`}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {/* 
        Main CTA: Grand yet lightweight Pill CTA Button
        - Height: 58–62px (prominent touch target)
        - Shape: Pure Pill (rounded-full)
        - Footprint: max-w 335–365px (distinct hero presence)
        - Surface: Calm, luxurious pastel (bg-[#FAF0F2] dark:bg-[#150F13])
        - Border: Delicate hairline (border-[#E98787]/20 dark:border-[#E8BFC7]/15)
        - Shadow: Soft diffuse depth (shadow-[0_4px_20px_-4px_rgba(233,135,135,0.18)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)])
        - Preserved: Style and identity of «Купить Lovely»
        - NO heavy panels, NO outer glow rings, NO harsh neon
      */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleClick}
        className="group relative w-full h-[58px] xs:h-[60px] sm:h-[62px] rounded-full select-none overflow-hidden cursor-pointer transition-all duration-100 ease-out active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BFC7] bg-[#FAF0F2] dark:bg-[#150F13] border border-[#E98787]/20 dark:border-[#E8BFC7]/15 shadow-[0_4px_20px_-4px_rgba(233,135,135,0.18)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:border-[#E98787]/35 text-left disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100"
        aria-label={text}
      >
        {/* Ambient Background Aura & Delicate Floating Gleam (exact SVG Layer from «Купить Lovely») */}
        <svg
          viewBox="0 0 360 65"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full pointer-events-none block"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="touchPillLovelyGlow" cx="45%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#E98787" stopOpacity="0.09" />
              <stop offset="50%" stopColor="#FFDEE7" stopOpacity="0.03" />
              <stop offset="100%" stopColor="#FAF0F2" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#touchPillLovelyGlow)" />

          {/* Faint Romantic Gleam Particles matching Lovely reference */}
          <g opacity="0.25">
            <circle cx="42" cy="42" r="1.1" fill="#E98787" />
            <circle cx="135" cy="18" r="0.8" fill="#E98787" />
            <circle cx="235" cy="45" r="0.9" fill="#E98787" />
            <circle cx="315" cy="20" r="1.0" fill="#E98787" />
          </g>
        </svg>

        {/* Content Overlay */}
        <div className="relative z-10 h-full w-full px-5 xs:px-6 flex items-center justify-center gap-2.5 pointer-events-none">
          {icon !== undefined ? (
            icon
          ) : (
            <Heart
              size={16}
              className="shrink-0 fill-[#E98787] text-[#E98787] transition-transform duration-300 group-hover:scale-110"
            />
          )}
          <span className="font-display font-semibold text-[15px] xs:text-[16px] tracking-tight text-[#343033] dark:text-white whitespace-nowrap">
            {text}
          </span>
        </div>
      </button>

      {/* Optional Subtle Subtitle placed calmly beneath the pill button */}
      {subtext && (
        <p className="text-[11px] xs:text-[11.5px] text-center text-[#8A8488] dark:text-[#B8B2B5] font-medium pt-2 transition-opacity duration-200 leading-tight">
          {subtext}
        </p>
      )}
    </div>
  );
};
