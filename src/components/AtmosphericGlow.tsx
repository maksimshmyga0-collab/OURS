import React from 'react';

export interface AtmosphericGlowProps {
  className?: string;
  insetClassName?: string;
  roundedClassName?: string;
  blurClassName?: string;
  variant?: 'standard' | 'prominent' | 'card';
  style?: React.CSSProperties;
}

/**
 * Reusable atmospheric ambient backlight aura.
 * Restores 100% original approved OURS visual atmosphere with organic morphing bloby layers.
 */
export const AtmosphericGlow: React.FC<AtmosphericGlowProps> = React.memo(({
  className = '',
  insetClassName,
  roundedClassName = 'rounded-[36px]',
  blurClassName = 'blur-2xl',
  variant = 'standard',
  style,
}) => {
  const getInsets = () => {
    if (insetClassName) return insetClassName;
    if (variant === 'card') return '-inset-2.5 sm:-inset-3.5';
    if (variant === 'prominent') return '-inset-3 xs:-inset-3.5 sm:-inset-4';
    return '-inset-3 sm:-inset-4';
  };

  const getRounded = () => {
    if (roundedClassName) return roundedClassName;
    if (variant === 'prominent') return 'rounded-[28px] sm:rounded-[32px]';
    if (variant === 'card') return 'rounded-[28px]';
    return 'rounded-[36px]';
  };

  if (variant === 'card') {
    return (
      <div
        className={`ours-glow-layer atmospheric-glow absolute ${getInsets()} ${getRounded()} pointer-events-none -z-10 select-none ${className}`}
        style={style}
        aria-hidden="true"
      >
        <div className={`absolute inset-0 ${getRounded()} bg-gradient-to-b from-[#FAD4DF]/30 via-[#F7CAD6]/15 to-transparent dark:from-[#3D1E2A]/35 dark:via-[#2F1A24]/15 ${blurClassName} transform-gpu`} />
      </div>
    );
  }

  if (variant === 'prominent') {
    return (
      <div
        className={`ours-glow-layer atmospheric-glow absolute ${getInsets()} ${getRounded()} pointer-events-none -z-10 select-none ${className}`}
        style={style}
        aria-hidden="true"
      >
        <div className={`absolute inset-0 ${getRounded()} bg-gradient-to-tr from-[#E98787]/35 via-[#F0B9C6]/20 to-transparent dark:from-[#4D1D2B]/45 dark:via-[#381B24]/20 ${blurClassName} animate-fluid-blob-1 transform-gpu`} />
        <div className={`absolute inset-1 ${getRounded()} bg-gradient-to-bl from-[#FAD4DF]/25 via-[#E98787]/15 to-transparent dark:from-[#3D1E2A]/30 dark:via-[#2A141C]/15 ${blurClassName} animate-fluid-blob-2 transform-gpu`} />
      </div>
    );
  }

  return (
    <div
      className={`ours-glow-layer atmospheric-glow absolute ${getInsets()} ${getRounded()} pointer-events-none -z-10 select-none ${className}`}
      style={style}
      aria-hidden="true"
    >
      <div className={`absolute inset-0 ${getRounded()} bg-gradient-to-r from-[#FAD4DF]/30 via-[#F7CAD6]/18 to-transparent dark:from-[#3D1E2A]/35 dark:via-[#2F1A24]/18 ${blurClassName} animate-fluid-blob-1 transform-gpu`} />
      <div className={`absolute inset-1 ${getRounded()} bg-gradient-to-br from-[#97B2EB]/12 via-[#E98787]/10 to-transparent dark:from-[#1E2838]/20 dark:via-[#321820]/15 ${blurClassName} animate-fluid-blob-2 transform-gpu`} />
    </div>
  );
});

AtmosphericGlow.displayName = 'AtmosphericGlow';
