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
 * Preserves the signature OURS palette while offering:
 * 1. 'standard': Calm halo behind photo diptych
 * 2. 'prominent': Organic, chaotic, luminous fluid aura behind the floating Date envelope
 * 3. 'card': Multi-layered organic glow behind cards in History and sections
 */
export const AtmosphericGlow: React.FC<AtmosphericGlowProps> = ({
  className = '',
  insetClassName,
  roundedClassName = 'rounded-[36px]',
  blurClassName,
  variant = 'standard',
  style,
}) => {
  if (variant === 'card') {
    const defaultInsets = insetClassName || '-inset-2 sm:-inset-2.5';
    const defaultRounded = roundedClassName || 'rounded-[28px]';
    return (
      <div
        className={`absolute ${defaultInsets} pointer-events-none -z-10 overflow-visible select-none opacity-85 dark:opacity-80 ${className}`}
        style={style}
        aria-hidden="true"
      >
        {/* Layer 1: Wide ambient soft halo */}
        <div
          className={`absolute -inset-2 ${defaultRounded} blur-2xl animate-diptych-halo bg-[radial-gradient(ellipse_at_center,_rgba(240,185,198,0.55)_0%,_rgba(254,235,240,0.30)_45%,_rgba(254,235,240,0.10)_65%,_transparent_75%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(215,85,105,0.40)_0%,_rgba(140,40,60,0.18)_45%,_rgba(140,40,60,0.05)_65%,_transparent_75%)]`}
        />

        {/* Layer 2: Organic fluid rounded wave */}
        <div
          className={`absolute -inset-1 ${defaultRounded} blur-xl animate-fluid-blob-1 bg-[radial-gradient(ellipse_at_center,_rgba(240,185,198,0.58)_0%,_rgba(254,235,240,0.28)_45%,_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(215,85,105,0.45)_0%,_rgba(140,40,60,0.20)_45%,_transparent_70%)]`}
        />

        {/* Layer 3: Vibrant luminous warm core */}
        <div
          className="absolute inset-x-4 inset-y-2 rounded-full blur-lg animate-fluid-pulse bg-[radial-gradient(circle,_rgba(254,235,240,0.65)_0%,_rgba(240,185,198,0.35)_45%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(215,85,105,0.52)_0%,_rgba(140,40,60,0.25)_45%,_transparent_70%)]"
        />
      </div>
    );
  }

  if (variant === 'prominent') {
    return (
      <div
        className={`absolute inset-0 pointer-events-none -z-10 overflow-visible select-none ${className}`}
        style={style}
        aria-hidden="true"
      >
        {/* 1. Base rounded elliptical aura - Soft, round, radiant halo with zero flat edges */}
        <div
          className="absolute -inset-x-2 -inset-y-6 xs:-inset-x-3 xs:-inset-y-7 rounded-full blur-2xl origin-center animate-diptych-halo bg-[radial-gradient(ellipse_at_center,_rgba(255,215,226,0.92)_0%,_rgba(250,185,205,0.58)_36%,_rgba(242,160,185,0.18)_56%,_transparent_74%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(255,190,210,0.85)_0%,_rgba(240,140,168,0.52)_36%,_rgba(205,85,115,0.16)_56%,_transparent_74%)]"
        />

        {/* 2. Organic fluid rounded wave - Living breathing rounded ellipse */}
        <div
          className="absolute -inset-x-1 -inset-y-5 xs:-inset-x-2 xs:-inset-y-6 rounded-full blur-xl origin-center animate-fluid-blob-1 bg-[radial-gradient(ellipse_at_center,_rgba(255,230,240,0.82)_0%,_rgba(252,190,210,0.44)_38%,_transparent_68%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(255,210,225,0.76)_0%,_rgba(242,150,175,0.38)_38%,_transparent_68%)]"
        />

        {/* 3. Luminous warm core heart of light - Round centered floating depth */}
        <div
          className="absolute inset-x-6 inset-y-2 rounded-full blur-lg origin-center animate-fluid-pulse bg-[radial-gradient(circle,_rgba(255,242,248,0.80)_0%,_rgba(250,200,220,0.38)_40%,_transparent_66%)] dark:bg-[radial-gradient(circle,_rgba(255,230,242,0.72)_0%,_rgba(245,170,192,0.34)_40%,_transparent_66%)]"
        />
      </div>
    );
  }

  const defaultInsets = insetClassName || '-inset-2.5 sm:-inset-3.5';
  const defaultBlur = blurClassName || 'blur-2xl';

  return (
    <div
      className={`absolute ${defaultInsets} ${roundedClassName} pointer-events-none -z-10 transition-all duration-700 ${defaultBlur} animate-diptych-halo bg-[radial-gradient(ellipse_at_center,_rgba(240,185,198,0.36)_0%,_rgba(254,235,240,0.14)_50%,_transparent_75%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(215,85,105,0.24)_0%,_rgba(140,40,60,0.06)_50%,_transparent_75%)] ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};
