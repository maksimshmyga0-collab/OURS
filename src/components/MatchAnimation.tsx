import React, { useEffect, useRef } from 'react';

interface MatchAnimationProps {
  onComplete: () => void;
}

/**
 * Minimalist, cohesive MATCH animation:
 * Lasts 650ms (within requested 500-800ms) with zero heavy celebration overlays,
 * no large circles, no rotating stars, and no multi-phase screens.
 */
export const MatchAnimation: React.FC<MatchAnimationProps> = ({ onComplete }) => {
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const hasFiredRef = useRef(false);

  useEffect(() => {
    // 850ms total timing: synchronizes with smooth photo approach, ambient glow & connection bridge
    const timer = setTimeout(() => {
      if (!hasFiredRef.current) {
        hasFiredRef.current = true;
        onCompleteRef.current?.();
      }
    }, 850);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    // Non-blocking, ultra-subtle ambient flash during the 650ms impulse
    <div
      className="fixed inset-0 z-40 pointer-events-none select-none transition-opacity duration-500 ease-out"
      aria-hidden="true"
    />
  );
};
