import React, { useEffect, useState, useRef } from 'react';
import { OursLogo } from './OursLogo';

interface MatchAnimationProps {
  onComplete: () => void;
}

export const MatchAnimation: React.FC<MatchAnimationProps> = ({ onComplete }) => {
  // Phase 1: 'enter' (0-120ms), Phase 2: 'converge' (120-550ms), Phase 3: 'matched' (550-1450ms), Phase 4: 'closing' (1450-1800ms)
  const [phase, setPhase] = useState<'enter' | 'converge' | 'matched' | 'closing'>('enter');

  // Keep latest onComplete in a ref to avoid timer cancellations on parent re-renders
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const hasFiredRef = useRef(false);

  useEffect(() => {
    // 0-120ms: Soft backdrop stabilization
    const t0 = setTimeout(() => {
      setPhase('converge');
    }, 120);

    // 120-550ms: Spheres meet smoothly -> Logo & MATCH emerge
    const t1 = setTimeout(() => {
      setPhase('matched');
    }, 550);

    // 550-1450ms: Presentation -> Closing fade-out begins
    const t2 = setTimeout(() => {
      setPhase('closing');
    }, 1450);

    // 1450-1800ms: Smooth handover to unblurred photos
    const t3 = setTimeout(() => {
      if (!hasFiredRef.current) {
        hasFiredRef.current = true;
        onCompleteRef.current?.();
      }
    }, 1800);

    // Fallback safety
    const tFallback = setTimeout(() => {
      if (!hasFiredRef.current) {
        hasFiredRef.current = true;
        onCompleteRef.current?.();
      }
    }, 2400);

    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(tFallback);
    };
  }, []);

  const isClosing = phase === 'closing';
  const isMatched = phase === 'matched';
  const isEntering = phase === 'enter';

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#343033]/65 backdrop-blur-md transition-opacity duration-350 ease-out select-none ${
        isClosing
          ? 'opacity-0 pointer-events-none'
          : isEntering
          ? 'opacity-0'
          : 'opacity-100'
      }`}
      style={{
        transitionProperty: 'opacity',
        transitionDuration: isEntering ? '200ms' : isClosing ? '350ms' : '250ms',
      }}
      aria-live="polite"
      role="dialog"
      aria-modal="true"
    >
      {/* Soft pastel ambient background aura */}
      <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-[#F6DCE1]/45 via-[#F7D8D0]/40 to-[#DDEAF7]/45 blur-3xl pointer-events-none transition-all duration-700 ease-out" />

      {/* Center animation container */}
      <div className="relative flex flex-col items-center text-center z-10 max-w-xs">
        <div className="relative mb-6 flex items-center justify-center min-h-[96px]">
          {/* Converging two circles that smoothly glide together */}
          <div
            className={`transition-all duration-450 ease-out flex items-center justify-center ${
              !isMatched
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-90 pointer-events-none absolute'
            }`}
          >
            <div className="flex items-center -space-x-2.5">
              <div
                className={`w-12 h-12 rounded-full bg-[#EFC1CB] border-2 border-white shadow-md transform transition-transform duration-500 ease-out ${
                  isEntering ? '-translate-x-3 opacity-80' : 'translate-x-0 opacity-100'
                }`}
              />
              <div
                className={`w-12 h-12 rounded-full bg-[#DDEAF7] border-2 border-white shadow-md transform transition-transform duration-500 ease-out ${
                  isEntering ? 'translate-x-3 opacity-80' : 'translate-x-0 opacity-100'
                }`}
              />
            </div>
          </div>

          {/* Emerged Match Logo with soft scale */}
          <div
            className={`transition-all duration-400 ease-out ${
              isMatched
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-85 pointer-events-none absolute'
            }`}
          >
            <div className="relative p-5 rounded-full bg-white/95 shadow-lg border border-white/60">
              <OursLogo size={52} variant="coral" />
            </div>
          </div>
        </div>

        {/* Text presentation with gentle fade */}
        <div className="min-h-[50px] flex flex-col items-center justify-center transition-all duration-300 ease-out">
          {!isMatched ? (
            <p className="text-sm font-medium text-[#FFF9FA]/85 animate-in fade-in duration-200">
              Соединяем ваши моменты...
            </p>
          ) : (
            <div className="animate-in fade-in zoom-in-95 duration-300 ease-out space-y-1">
              <h2 className="font-display font-bold tracking-widest text-2xl text-white drop-shadow-xs">
                MATCH
              </h2>
              <p className="text-sm font-medium text-[#FFF9FA]/90">
                Момент открывается...
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
