import React from 'react';

export type AvatarVariant = 'user' | 'partner';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  bgColor?: string;
  imageUrl?: string | null;
  className?: string;
  variant?: AvatarVariant;
}

/**
 * Deterministic string hasher to select stable abstract variant
 */
function getDeterministicHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Soft Abstract Couple Avatar - Partner A (Rose / Dusty Blush / Warm Peach tones)
 * Minimalist, organic forms, soft serene contours matching OURS aesthetic.
 */
const AbstractAvatarVariantRose: React.FC<{ hashSeed: number }> = ({ hashSeed }) => {
  const rotation = (hashSeed % 4) * 45;
  return (
    <svg
      viewBox="0 0 80 80"
      className="w-full h-full select-none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="roseAura" cx="38%" cy="35%" r="62%">
          <stop offset="0%" stopColor="#FFF2F5" />
          <stop offset="65%" stopColor="#F8D3DC" />
          <stop offset="100%" stopColor="#EEBAC5" />
        </radialGradient>
        <linearGradient id="rosePebble" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFA6B8" />
          <stop offset="100%" stopColor="#EA758D" />
        </linearGradient>
        <linearGradient id="warmSun" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFE6D6" />
          <stop offset="100%" stopColor="#F9C6AE" />
        </linearGradient>
      </defs>

      {/* Base soft canvas */}
      <rect width="80" height="80" rx="40" fill="url(#roseAura)" />

      {/* Organic composition */}
      <g transform={`rotate(${rotation} 40 40)`}>
        {/* Soft floating warm pebble */}
        <path
          d="M 28 22 C 44 14, 62 26, 58 44 C 54 62, 34 64, 24 50 C 16 38, 18 27, 28 22 Z"
          fill="url(#rosePebble)"
          opacity="0.88"
        />

        {/* Overlapping soft pearl arch */}
        <circle cx="48" cy="46" r="15" fill="url(#warmSun)" opacity="0.9" />

        {/* Minimalist central calm focal dot */}
        <circle cx="37" cy="38" r="4.5" fill="#FFFFFF" opacity="0.95" />
        <circle cx="37" cy="38" r="2.2" fill="#E86E87" />
      </g>
    </svg>
  );
};

/**
 * Soft Abstract Couple Avatar - Partner B (Soft Sky Blue / Lavender / Periwinkle tones)
 * Minimalist, organic forms, soft serene contours matching OURS aesthetic.
 */
const AbstractAvatarVariantBlue: React.FC<{ hashSeed: number }> = ({ hashSeed }) => {
  const rotation = (hashSeed % 4) * 45;
  return (
    <svg
      viewBox="0 0 80 80"
      className="w-full h-full select-none"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="blueAura" cx="38%" cy="35%" r="62%">
          <stop offset="0%" stopColor="#F4F8FD" />
          <stop offset="65%" stopColor="#D8E8F8" />
          <stop offset="100%" stopColor="#BCD5EE" />
        </radialGradient>
        <linearGradient id="bluePebble" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9BC3F2" />
          <stop offset="100%" stopColor="#6C9FD6" />
        </linearGradient>
        <linearGradient id="lavenderGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E9DFF7" />
          <stop offset="100%" stopColor="#D1BFE8" />
        </linearGradient>
      </defs>

      {/* Base soft canvas */}
      <rect width="80" height="80" rx="40" fill="url(#blueAura)" />

      {/* Organic composition */}
      <g transform={`rotate(${rotation} 40 40)`}>
        {/* Soft floating cool pebble */}
        <path
          d="M 52 24 C 66 38, 56 60, 38 60 C 22 60, 18 42, 28 28 C 36 16, 44 16, 52 24 Z"
          fill="url(#bluePebble)"
          opacity="0.88"
        />

        {/* Overlapping soft lavender pearl */}
        <circle cx="34" cy="44" r="14" fill="url(#lavenderGlow)" opacity="0.9" />

        {/* Minimalist central calm focal dot */}
        <circle cx="45" cy="36" r="4.5" fill="#FFFFFF" opacity="0.95" />
        <circle cx="45" cy="36" r="2.2" fill="#5F91C7" />
      </g>
    </svg>
  );
};

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  bgColor,
  imageUrl,
  className = '',
  variant,
}) => {
  const [hasError, setHasError] = React.useState(false);

  // Reset error if imageUrl changes
  React.useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  const sizeClasses = {
    xs: 'w-5 h-5 text-[10px]',
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold',
  }[size];

  // Resolve partner role for placeholder: explicit prop, or inferred from bgColor / name
  const effectiveVariant: AvatarVariant =
    variant ||
    (bgColor?.toLowerCase().includes('ddeaf7') ||
    bgColor?.toLowerCase().includes('edf4fb') ||
    bgColor?.toLowerCase().includes('blue') ||
    name?.toLowerCase().includes('макс') ||
    name?.toLowerCase().includes('партнёр')
      ? 'partner'
      : 'user');

  const hashSeed = React.useMemo(() => getDeterministicHash(name || 'ours'), [name]);

  return (
    <div
      className={`rounded-full flex items-center justify-center font-medium text-[#343033] dark:text-white shrink-0 border border-white/85 dark:border-[#242024] shadow-xs select-none overflow-hidden relative ${sizeClasses} ${className}`}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
      aria-label={name}
    >
      {imageUrl && !hasError ? (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : effectiveVariant === 'partner' ? (
        <AbstractAvatarVariantBlue hashSeed={hashSeed} />
      ) : (
        <AbstractAvatarVariantRose hashSeed={hashSeed} />
      )}
    </div>
  );
};
