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
    const defaultInsets = insetClassName || '-inset-2.5 sm:-inset-3.5';
    const defaultRounded = roundedClassName || 'rounded-[28px]';
    return (
      <div
        className={`absolute ${defaultInsets} pointer-events-none -z-10 overflow-visible select-none opacity-85 dark:opacity-80 ${className}`}
        style={style}
        aria-hidden="true"
      >
        {/* Layer 1: Wide ambient soft halo */}
        <div
          className={`absolute -inset-3 ${defaultRounded} blur-2xl animate-diptych-halo bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.45)_0%,_rgba(253,225,232,0.24)_45%,_rgba(253,225,232,0.08)_65%,_transparent_80%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(215,68,98,0.34)_0%,_rgba(168,38,68,0.16)_45%,_rgba(128,28,52,0.05)_65%,_transparent_80%)]`}
        />

        {/* Layer 2: Organic fluid rounded wave */}
        <div
          className={`absolute -inset-2 ${defaultRounded} blur-xl animate-fluid-blob-1 bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.48)_0%,_rgba(253,225,232,0.22)_45%,_transparent_75%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(215,68,98,0.35)_0%,_rgba(168,38,68,0.16)_45%,_transparent_75%)]`}
        />

        {/* Layer 3: Vibrant luminous warm core */}
        <div
          className="absolute inset-x-3 inset-y-1 rounded-full blur-lg animate-fluid-pulse bg-[radial-gradient(circle,_rgba(253,225,232,0.58)_0%,_rgba(235,168,184,0.30)_45%,_transparent_75%)] dark:bg-[radial-gradient(circle,_rgba(215,68,98,0.40)_0%,_rgba(168,38,68,0.18)_45%,_transparent_75%)]"
        />
      </div>
    );
  }

  if (variant === 'prominent') {
    const defaultInsets = insetClassName || '-inset-3 xs:-inset-3.5 sm:-inset-4';
    const defaultRounded = roundedClassName || 'rounded-[26px] xs:rounded-[28px] sm:rounded-[30px]';
    return (
      <div
        className={`absolute ${defaultInsets} ${defaultRounded} pointer-events-none select-none overflow-visible will-change-[transform,opacity] opacity-80 dark:opacity-75 ${className}`}
        style={{ zIndex: 0, ...style }}
        aria-hidden="true"
      >
        {/* Layer 1: Wide ambient soft halo slightly peeking around all envelope edges */}
        <div
          className="absolute -inset-1.5 rounded-[28px] xs:rounded-[30px] sm:rounded-[32px] blur-2xl opacity-90 dark:opacity-85 animate-diptych-halo bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.48)_0%,_rgba(253,225,232,0.26)_55%,_rgba(253,225,232,0.10)_75%,_transparent_95%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(215,68,98,0.35)_0%,_rgba(168,38,68,0.18)_55%,_rgba(128,28,52,0.06)_75%,_transparent_95%)]"
        />

        {/* Layer 2: Delicate contour halo gently illuminating envelope rim */}
        <div
          className="absolute inset-0 rounded-[26px] xs:rounded-[28px] sm:rounded-[30px] blur-xl opacity-90 dark:opacity-85 animate-fluid-blob-1 bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.50)_0%,_rgba(253,225,232,0.24)_50%,_rgba(235,168,184,0.10)_75%,_transparent_95%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(215,68,98,0.32)_0%,_rgba(168,38,68,0.15)_50%,_rgba(128,28,52,0.05)_75%,_transparent_95%)]"
        />
      </div>
    );
  }

  const defaultInsets = insetClassName || '-inset-3 sm:-inset-4';
  const defaultBlur = blurClassName || 'blur-2xl';

  return (
    <div
      className={`absolute ${defaultInsets} ${roundedClassName} pointer-events-none -z-10 transition-all duration-700 ${defaultBlur} animate-diptych-halo bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.56)_0%,_rgba(253,225,232,0.28)_50%,_transparent_80%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(215,68,98,0.42)_0%,_rgba(168,38,68,0.18)_50%,_transparent_80%)] ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
});
