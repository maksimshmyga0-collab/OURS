import React, { useEffect, useRef } from 'react';

interface MatchAnimationProps {
  onConnection?: () => void;
  onComplete: () => void;
}

/**
 * OURS Match Animation:
 * Total duration: ~1100ms
 * 
 * Scenario:
 * Phase 1 (0-200ms): Both partner photos settle with calm, subtle breath scale (1 -> 1.018).
 * Phase 2 (200-360ms): Two delicate luminous pastel dots appear near each photo.
 * Phase 3 (360-720ms): Both elements smoothly glide on an arc towards each other.
 * Phase 4 (720-840ms): Elements meet at center seam with a tender soft connection pulse; reveal initiates.
 * Phase 5 (740-1100ms): Partner blur dissolves to crisp clarity, photos scale 1 -> 1.025 -> 1, soft edge highlight frames the moment.
 */
export const MatchAnimation: React.FC<MatchAnimationProps> = ({
  onConnection,
  onComplete,
}) => {
  const onConnectionRef = useRef(onConnection);
  onConnectionRef.current = onConnection;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const hasConnectedRef = useRef(false);
  const hasCompletedRef = useRef(false);

  useEffect(() => {
    // Phase 4: Connection pulse at 720ms - initiates blur dissolving & opening
    const connectionTimer = setTimeout(() => {
      if (!hasConnectedRef.current) {
        hasConnectedRef.current = true;
        onConnectionRef.current?.();
      }
    }, 720);

    // Phase 5: Complete animation & commit REVEALED state at 1100ms
    const completeTimer = setTimeout(() => {
      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true;
        onCompleteRef.current?.();
      }
    }, 1100);

    return () => {
      clearTimeout(connectionTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none z-30 select-none overflow-visible"
      aria-hidden="true"
    >
      {/* Container aligned with the two square photo cards (aspect ratio 2:1) */}
      <div className="relative w-full aspect-[2/1] overflow-visible">
        {/* Phase 2 & 3: Left Photo Connecting Element (OURS soft yogurt-pink dot) */}
        <div
          className="absolute top-1/2 w-4 h-4 rounded-full pointer-events-none animate-match-dot-left"
          style={{
            background:
              'radial-gradient(circle, #FFFFFF 25%, #F7D2DB 65%, #F0B9C6 100%)',
            boxShadow:
              '0 0 10px 2.5px rgba(240, 185, 198, 0.75), 0 0 18px 5px rgba(240, 185, 198, 0.4)',
          }}
        />

        {/* Phase 2 & 3: Right Photo Connecting Element (OURS soft blush dot) */}
        <div
          className="absolute top-1/2 w-4 h-4 rounded-full pointer-events-none animate-match-dot-right"
          style={{
            background:
              'radial-gradient(circle, #FFFFFF 25%, #F7D4DD 65%, #EFC1CB 100%)',
            boxShadow:
              '0 0 10px 2.5px rgba(239, 193, 203, 0.75), 0 0 18px 5px rgba(239, 193, 203, 0.4)',
          }}
        />

        {/* Phase 4: Gentle connection ring impulse at center */}
        <div
          className="absolute top-1/2 left-1/2 w-4 h-4 rounded-full pointer-events-none animate-match-connection-pulse"
          style={{
            border: '1.5px solid rgba(240, 185, 198, 0.9)',
            boxShadow:
              '0 0 14px 3px rgba(240, 185, 198, 0.65), inset 0 0 8px 1px rgba(255, 255, 255, 0.7)',
            filter: 'blur(0.5px)',
          }}
        />

        {/* Phase 4: Gentle central luminous point merging the two dots */}
        <div
          className="absolute top-1/2 left-1/2 w-3.5 h-3.5 rounded-full pointer-events-none animate-match-connection-glow"
          style={{
            background:
              'radial-gradient(circle, #FFFFFF 35%, #F5CDD6 75%, #F0B9C6 100%)',
            boxShadow: '0 0 14px 4px rgba(240, 185, 198, 0.8)',
          }}
        />

        {/* Phase 5: Delicate edge highlight sheen over both photo cards */}
        <div className="absolute inset-0 grid grid-cols-2 gap-3 sm:gap-4 pointer-events-none">
          <div
            className="w-full aspect-square rounded-[22px] pointer-events-none animate-match-card-highlight"
            style={{
              border: '1.5px solid rgba(240, 185, 198, 0.65)',
              boxShadow: '0 0 14px 2px rgba(240, 185, 198, 0.35)',
            }}
          />
          <div
            className="w-full aspect-square rounded-[22px] pointer-events-none animate-match-card-highlight"
            style={{
              border: '1.5px solid rgba(240, 185, 198, 0.65)',
              boxShadow: '0 0 14px 2px rgba(240, 185, 198, 0.35)',
            }}
          />
        </div>
      </div>
    </div>
  );
};
