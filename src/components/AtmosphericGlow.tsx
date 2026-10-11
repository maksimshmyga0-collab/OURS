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
export const AtmosphericGlow: React.FC<AtmosphericGlowProps> = React.memo(({
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
          className={`absolute -inset-2 ${defaultRounded} blur-2xl animate-diptych-halo bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.42)_0%,_rgba(253,225,232,0.22)_45%,_rgba(253,225,232,0.08)_65%,_transparent_75%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(198,58,86,0.28)_0%,_rgba(128,28,52,0.12)_45%,_rgba(128,28,52,0.04)_65%,_transparent_75%)]`}
        />

        {/* Layer 2: Organic fluid rounded wave */}
        <div
          className={`absolute -inset-1 ${defaultRounded} blur-xl animate-fluid-blob-1 bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.45)_0%,_rgba(253,225,232,0.20)_45%,_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(198,58,86,0.30)_0%,_rgba(128,28,52,0.14)_45%,_transparent_70%)]`}
        />

        {/* Layer 3: Vibrant luminous warm core */}
        <div
          className="absolute inset-x-4 inset-y-2 rounded-full blur-lg animate-fluid-pulse bg-[radial-gradient(circle,_rgba(253,225,232,0.50)_0%,_rgba(235,168,184,0.25)_45%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(198,58,86,0.36)_0%,_rgba(128,28,52,0.16)_45%,_transparent_70%)]"
        />
      </div>
    );
  }

  if (variant === 'prominent') {
    const defaultInsets = insetClassName || '-inset-2.5 xs:-inset-3 sm:-inset-3.5';
    const defaultRounded = roundedClassName || 'rounded-[26px] xs:rounded-[28px] sm:rounded-[30px]';
    return (
      <div
        className={`absolute ${defaultInsets} ${defaultRounded} pointer-events-none select-none overflow-visible will-change-[transform,opacity] ${className}`}
        style={{ zIndex: 0, ...style }}
        aria-hidden="true"
      >
        {/* Layer 1: Wide ambient soft halo slightly peeking around all envelope edges */}
        <div
          className="absolute -inset-1 rounded-[28px] xs:rounded-[30px] sm:rounded-[32px] blur-2xl opacity-75 dark:opacity-70 animate-diptych-halo bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.48)_0%,_rgba(253,225,232,0.28)_55%,_rgba(253,225,232,0.10)_75%,_transparent_95%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(198,58,86,0.36)_0%,_rgba(128,28,52,0.18)_55%,_rgba(128,28,52,0.06)_75%,_transparent_95%)]"
        />

        {/* Layer 2: Delicate contour halo gently illuminating envelope rim */}
        <div
          className="absolute inset-0 rounded-[26px] xs:rounded-[28px] sm:rounded-[30px] blur-xl opacity-80 dark:opacity-75 animate-fluid-blob-1 bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.52)_0%,_rgba(253,225,232,0.25)_50%,_rgba(235,168,184,0.10)_75%,_transparent_92%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(198,58,86,0.28)_0%,_rgba(128,28,52,0.15)_50%,_rgba(128,28,52,0.05)_75%,_transparent_92%)]"
        />
      </div>
    );
  }

  const defaultInsets = insetClassName || '-inset-2.5 sm:-inset-3.5';
  const defaultBlur = blurClassName || 'blur-2xl';

  return (
    <div
      className={`absolute ${defaultInsets} ${roundedClassName} pointer-events-none -z-10 transition-all duration-700 ${defaultBlur} animate-diptych-halo bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.36)_0%,_rgba(253,225,232,0.14)_50%,_transparent_75%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(198,58,86,0.24)_0%,_rgba(128,28,52,0.06)_50%,_transparent_75%)] ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
});
