import React from 'react';

export interface OursLogoProps {
  size?: number;
  className?: string;
  variant?: 'coral' | 'dark' | 'white' | 'duo';
  animate?: boolean;
}

/**
 * Authentic OURS Brand Logo:
 * Two soft overlapping spheres (Pink & Blue) representing the couple,
 * with enhanced +30% saturation while keeping soft pastel elegance.
 */
export const OursLogo: React.FC<OursLogoProps> = ({
  size = 22,
  className = '',
}) => {
  const sphereSize = size;
  const overlap = Math.max(2, Math.round(sphereSize * 0.36));

  return (
    <div
      className={`inline-flex items-center shrink-0 select-none ${className}`}
      style={{ height: sphereSize }}
      aria-label="OURS logo"
    >
      {/* Left Pink/Coral Sphere (+30% saturated) */}
      <span
        style={{
          width: sphereSize,
          height: sphereSize,
          background:
            'radial-gradient(circle at 35% 32%, #FFA4B4 0%, #F5869A 55%, #E66C82 100%)',
          boxShadow: '0 2px 8px -1px rgba(230, 108, 130, 0.38)',
        }}
        className="rounded-full shrink-0 border border-white/85 dark:border-[#242024]/80 z-0 ours-logo-left-sphere"
      />
      {/* Right Blue Sphere (+30% saturated) */}
      <span
        style={{
          width: sphereSize,
          height: sphereSize,
          marginLeft: -overlap,
          background:
            'radial-gradient(circle at 35% 32%, #CDE3FD 0%, #9BC4F5 55%, #7BAEE8 100%)',
          boxShadow: '0 2px 8px -1px rgba(123, 174, 232, 0.38)',
        }}
        className="rounded-full shrink-0 border border-white/85 dark:border-[#242024]/80 ours-logo-right-sphere z-10"
      />
    </div>
  );
};
