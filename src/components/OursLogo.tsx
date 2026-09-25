import React from 'react';

/**
 * Official single source of truth for the OURS Logo asset URL.
 */
export const OURS_LOGO_URL = 'https://files.catbox.moe/zbcwso.png';

export interface OursLogoProps {
  size?: number;
  className?: string;
  variant?: 'default' | 'glow' | 'coral' | 'duo' | 'dark' | 'white';
  animate?: boolean;
}

/**
 * Official OURS Brand Logo:
 * Single source of truth. Directly renders the exact original PNG asset
 * from the URL without any redraw, shape modification, filter, stroke, shadow, or gradient.
 */
export const OursLogo: React.FC<OursLogoProps> = ({
  size = 78,
  className = '',
  animate = false,
}) => {
  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 select-none relative ${
        animate ? 'animate-gentle-float' : ''
      } ${className}`}
      style={{ width: size, height: size, maxWidth: '100%', maxHeight: '100%' }}
      aria-label="OURS logo"
    >
      <img
        src={OURS_LOGO_URL}
        alt="OURS Logo"
        width={size}
        height={size}
        loading="eager"
        decoding="async"
        crossOrigin="anonymous"
        className="w-full h-full object-contain pointer-events-none select-none"
      />
    </div>
  );
};
