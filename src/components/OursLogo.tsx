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
 * exactly matching the onboarding visual identity.
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
      {/* Left Pink Sphere */}
      <span
        style={{
          width: sphereSize,
          height: sphereSize,
          background:
            'radial-gradient(circle at 35% 32%, #FFC1CC 0%, #F6DCE1 55%, #EFC1CB 100%)',
          boxShadow: '0 2px 6px -1px rgba(233, 135, 135, 0.25)',
        }}
        className="rounded-full shrink-0 border border-white/90 z-0"
      />
      {/* Right Blue Sphere */}
      <span
        style={{
          width: sphereSize,
          height: sphereSize,
          marginLeft: -overlap,
          background:
            'radial-gradient(circle at 35% 32%, #E8F2FD 0%, #DDEAF7 55%, #BCD6EE 100%)',
          boxShadow: '0 2px 6px -1px rgba(188, 214, 238, 0.3)',
        }}
        className="rounded-full shrink-0 border border-white/90 mix-blend-multiply opacity-90 z-10"
      />
    </div>
  );
};
