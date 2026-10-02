import React from 'react';

interface WaitingCloudGlowProps {
  className?: string;
}

/**
 * Atmospheric amorphous cherry-burgundy living cloud glow.
 * Placed behind the waiting / cooldown frosted glass card.
 * Uses OURS signature cherry-burgundy palette:
 * - Dark: rgba(198, 58, 86, ...) / rgba(128, 28, 52, ...)
 * - Light: rgba(235, 168, 184, ...) / rgba(253, 225, 232, ...)
 * 3 overlapping asymmetric cloud layers with slow breathing organic fluid motion.
 */
export const WaitingCloudGlow: React.FC<WaitingCloudGlowProps> = React.memo(({ className = '' }) => {
  return (
    <div
      className={`absolute inset-0 pointer-events-none -z-10 select-none overflow-visible flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      {/* Layer 1: Wide horizontal asymmetric soft cherry cloud mist */}
      <div
        className="absolute -inset-x-8 -inset-y-5 rounded-full blur-3xl opacity-75 dark:opacity-70 animate-fluid-blob-1 bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.45)_0%,_rgba(253,225,232,0.20)_45%,_rgba(253,225,232,0.05)_65%,_transparent_75%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(198,58,86,0.34)_0%,_rgba(128,28,52,0.16)_45%,_rgba(128,28,52,0.04)_65%,_transparent_75%)]"
      />

      {/* Layer 2: Organic deep burgundy shifting fluid mist */}
      <div
        className="absolute -inset-x-5 -inset-y-3 rounded-full blur-2xl opacity-80 dark:opacity-75 animate-fluid-blob-2 bg-[radial-gradient(ellipse_at_center,_rgba(235,168,184,0.48)_0%,_rgba(253,225,232,0.22)_45%,_transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,_rgba(198,58,86,0.38)_0%,_rgba(128,28,52,0.18)_45%,_transparent_70%)]"
      />

      {/* Layer 3: Warm luminous heart of light */}
      <div
        className="absolute inset-x-2 inset-y-0 rounded-full blur-xl opacity-85 dark:opacity-80 animate-fluid-pulse bg-[radial-gradient(circle,_rgba(253,225,232,0.58)_0%,_rgba(235,168,184,0.28)_45%,_transparent_70%)] dark:bg-[radial-gradient(circle,_rgba(198,58,86,0.42)_0%,_rgba(128,28,52,0.18)_45%,_transparent_70%)]"
      />
    </div>
  );
});
