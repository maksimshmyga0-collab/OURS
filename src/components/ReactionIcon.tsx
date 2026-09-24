import React from 'react';
import { ReactionEmoji } from '../types';

export interface ReactionIconProps {
  reaction: ReactionEmoji | string;
  size?: number;
  className?: string;
}

/**
 * 5 Custom inline vector SVG reactions in pastel OURS aesthetic:
 * 1. ❤️ Heart (Сердечко)
 * 2. 😂 Laugh (Смех)
 * 3. 🔥 Fire (Огонёк)
 * 4. 😢 Sad (Грустный)
 * 5. 🥹 Touched / Sparkly Eyes (Умиляющийся)
 */
export const ReactionIcon: React.FC<ReactionIconProps> = ({
  reaction,
  size = 24,
  className = '',
}) => {
  switch (reaction) {
    case '❤️':
    case 'heart':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 select-none ${className}`}
        >
          <defs>
            <linearGradient id="oursHeartGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFA0AD" />
              <stop offset="50%" stopColor="#F27285" />
              <stop offset="100%" stopColor="#E4566C" />
            </linearGradient>
            <radialGradient id="oursHeartGlow" cx="35%" cy="30%" r="45%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="url(#oursHeartGrad)"
          />
          {/* Subtle soft specular shine on top-left lobe */}
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
            fill="url(#oursHeartGlow)"
          />
          <circle cx="7.5" cy="7" r="1.5" fill="#FFFFFF" opacity="0.65" />
        </svg>
      );

    case '😂':
    case 'laugh':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 select-none ${className}`}
        >
          <defs>
            <linearGradient id="oursLaughGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFC876" />
              <stop offset="100%" stopColor="#F99F44" />
            </linearGradient>
          </defs>
          {/* Base Face Circle */}
          <circle cx="12" cy="12" r="10" fill="url(#oursLaughGrad)" />
          
          {/* Soft Blush Cheeks */}
          <circle cx="4.8" cy="13.2" r="2" fill="#E86278" opacity="0.45" />
          <circle cx="19.2" cy="13.2" r="2" fill="#E86278" opacity="0.45" />

          {/* Laughing Arc Eyes (^ ^) */}
          <path
            d="M6.2 10.5c.8-1.5 2.4-1.5 3.2 0"
            stroke="#4A2E18"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <path
            d="M14.6 10.5c.8-1.5 2.4-1.5 3.2 0"
            stroke="#4A2E18"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Happy Open Laugh Mouth */}
          <path
            d="M7 13.5c0 3.1 2.2 5.2 5 5.2s5-2.1 5-5.2H7z"
            fill="#4A2E18"
          />
          {/* Cute Tongue */}
          <path
            d="M9.5 16.2c.7 1.6 1.8 2.5 2.5 2.5s1.8-.9 2.5-2.5c-.8-.4-1.7-.6-2.5-.6s-1.7.2-2.5.6z"
            fill="#FF7488"
          />
        </svg>
      );

    case '🔥':
    case 'fire':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 select-none ${className}`}
        >
          <defs>
            <linearGradient id="oursFireOuter" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FF775A" />
              <stop offset="50%" stopColor="#F9544A" />
              <stop offset="100%" stopColor="#E03C4B" />
            </linearGradient>
            <linearGradient id="oursFireInner" x1="12" y1="10" x2="12" y2="21" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFF176" />
              <stop offset="100%" stopColor="#FFA726" />
            </linearGradient>
          </defs>
          {/* Outer Organic Flame */}
          <path
            d="M12.5 2.5c.3 2.6-1.2 4.4-2.8 6.2-1.8 2.1-3.7 4.3-3.7 7.3a6 6 0 0012 0c0-4-2.5-6.5-3.8-8.8-.9-1.6-1.2-3.1-.7-4.7z"
            fill="url(#oursFireOuter)"
          />
          {/* Inner Golden Core */}
          <path
            d="M12 11c-.4 1.5-1.2 2.5-2 3.6-.9 1.1-1.5 2.2-1.5 3.7a3.5 3.5 0 007 0c0-2-1.4-3.5-2.1-4.7-.5-.9-.8-1.8-.4-2.6z"
            fill="url(#oursFireInner)"
          />
        </svg>
      );

    case '😢':
    case 'sad':
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 select-none ${className}`}
        >
          <defs>
            <linearGradient id="oursSadGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A4C4FB" />
              <stop offset="100%" stopColor="#7E9FE8" />
            </linearGradient>
            <linearGradient id="oursTearGrad" x1="17.5" y1="12.5" x2="17.5" y2="18" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#E1F5FE" />
              <stop offset="100%" stopColor="#4FC3F7" />
            </linearGradient>
          </defs>
          {/* Soft Periwinkle Face Circle */}
          <circle cx="12" cy="12" r="10" fill="url(#oursSadGrad)" />
          
          {/* Gentle Blush */}
          <circle cx="5" cy="14" r="1.8" fill="#5C7BC9" opacity="0.35" />

          {/* Sad downturned eyebrows / eyes */}
          <circle cx="8" cy="10.5" r="1.5" fill="#2C3A66" />
          <circle cx="16" cy="10.5" r="1.5" fill="#2C3A66" />
          <circle cx="7.5" cy="10" r="0.5" fill="#FFFFFF" />
          <circle cx="15.5" cy="10" r="0.5" fill="#FFFFFF" />

          {/* Gentle Pout Mouth */}
          <path
            d="M9 16.5c1-1 5-1 6 0"
            stroke="#2C3A66"
            strokeWidth="1.7"
            strokeLinecap="round"
          />

          {/* Cute Crystal Teardrop */}
          <path
            d="M17.5 13c-1.2 1.8-1.5 2.8-1.5 3.5a1.5 1.5 0 003 0c0-.7-.3-1.7-1.5-3.5z"
            fill="url(#oursTearGrad)"
          />
          <circle cx="17.2" cy="15.5" r="0.4" fill="#FFFFFF" />
        </svg>
      );

    case '🥹':
    case 'touched':
    case 'pleading':
    default:
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 select-none ${className}`}
        >
          <defs>
            <linearGradient id="oursTouchedGrad" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFB3C3" />
              <stop offset="100%" stopColor="#F4839B" />
            </linearGradient>
          </defs>
          {/* Soft Rose Pink Face Circle */}
          <circle cx="12" cy="12" r="10" fill="url(#oursTouchedGrad)" />

          {/* Cute Rosy Blush Cheeks */}
          <circle cx="4.8" cy="14" r="2.2" fill="#E64A6E" opacity="0.45" />
          <circle cx="19.2" cy="14" r="2.2" fill="#E64A6E" opacity="0.45" />

          {/* Left Big Sparkly Anime Eye */}
          <circle cx="8" cy="10" r="3.2" fill="#3D1A24" />
          <circle cx="7" cy="8.6" r="1.3" fill="#FFFFFF" />
          <circle cx="9.2" cy="11.4" r="0.7" fill="#FFFFFF" />

          {/* Right Big Sparkly Anime Eye */}
          <circle cx="16" cy="10" r="3.2" fill="#3D1A24" />
          <circle cx="15" cy="8.6" r="1.3" fill="#FFFFFF" />
          <circle cx="17.2" cy="11.4" r="0.7" fill="#FFFFFF" />

          {/* Gentle Sweet Smile */}
          <path
            d="M10 16.3c.7.8 3.3.8 4 0"
            stroke="#3D1A24"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
  }
};
