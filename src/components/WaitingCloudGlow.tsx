import React from 'react';

interface WaitingCloudGlowProps {
  className?: string;
}

/**
 * Atmospheric amorphous cherry-burgundy living cloud glow.
 * Restores 100% original approved OURS visual atmosphere with organic fluid animation.
 */
export const WaitingCloudGlow: React.FC<WaitingCloudGlowProps> = React.memo(({ className = '' }) => {
  return (
    <div
      className={`ours-glow-layer waiting-cloud-glow absolute -inset-x-8 -inset-y-5 rounded-full pointer-events-none -z-10 select-none ${className}`}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#C63A56]/35 via-[#801C34]/22 to-[#EB104A]/12 dark:from-[#6A162B]/55 dark:via-[#420D1A]/35 to-transparent blur-2xl animate-fluid-blob-1 animate-fluid-pulse transform-gpu" />
      <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-[#E98787]/20 via-[#C63A56]/12 to-transparent dark:from-[#4D1D2B]/30 dark:via-[#351C24]/15 blur-2xl animate-fluid-blob-2 transform-gpu" />
    </div>
  );
});

WaitingCloudGlow.displayName = 'WaitingCloudGlow';
