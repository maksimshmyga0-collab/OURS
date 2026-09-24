import React, { useEffect, useState } from 'react';
import { OursLogo } from './OursLogo';

interface MatchAnimationProps {
  onComplete: () => void;
}

export const MatchAnimation: React.FC<MatchAnimationProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'converge' | 'matched' | 'reveal'>('converge');

  useEffect(() => {
    // Step 1: Shapes converge (0ms - 800ms)
    const t1 = setTimeout(() => {
      setStep('matched');
    }, 900);

    // Step 2: "MATCH" title emerges with subtle soft particle glow (900ms - 2200ms)
    const t2 = setTimeout(() => {
      setStep('reveal');
    }, 2200);

    // Step 3: Complete and transition to revealed photos
    const t3 = setTimeout(() => {
      onComplete();
    }, 2800);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#343033]/65 backdrop-blur-md transition-opacity duration-500 animate-in fade-in"
      aria-live="polite"
    >
      {/* Soft pastel ambient background aura */}
      <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-[#F6DCE1]/40 via-[#F7D8D0]/40 to-[#DDEAF7]/40 blur-3xl pointer-events-none" />

      {/* Minimalist soft floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <span className="absolute top-[25%] left-[20%] w-2.5 h-2.5 rounded-full bg-[#F6DCE1] opacity-75 animate-ping duration-1000" />
        <span className="absolute top-[30%] right-[22%] w-2 h-2 rounded-full bg-[#F7D8D0] opacity-80 animate-pulse duration-700" />
        <span className="absolute bottom-[30%] left-[28%] w-3 h-3 rounded-full bg-[#FFF9FA] opacity-60 animate-bounce duration-1000" />
        <span className="absolute bottom-[28%] right-[25%] w-2 h-2 rounded-full bg-[#EFC1CB] opacity-75 animate-ping duration-1000" />
      </div>

      {/* Center animation container */}
      <div className="relative flex flex-col items-center text-center z-10">
        <div className="relative mb-6">
          {step === 'converge' && (
            <div className="flex items-center gap-6 animate-pulse">
              {/* Left element moving right */}
              <div className="w-12 h-12 rounded-full bg-[#EFC1CB] border-2 border-white shadow-md transform -translate-x-3 transition-transform duration-700 ease-out" />
              {/* Right element moving left */}
              <div className="w-12 h-12 rounded-full bg-[#DDEAF7] border-2 border-white shadow-md transform translate-x-3 transition-transform duration-700 ease-out" />
            </div>
          )}

          {step !== 'converge' && (
            <div className="relative p-5 rounded-full bg-white/95 shadow-xl match-glow-shadow scale-110 transition-all duration-500">
              <OursLogo size={56} variant="coral" />
            </div>
          )}
        </div>

        {/* Text presentation */}
        {step !== 'converge' ? (
          <div className="space-y-1.5 transition-all duration-300 animate-in zoom-in-95">
            <h2 className="font-display font-bold tracking-widest text-2xl text-white drop-shadow-xs">
              MATCH
            </h2>
            <p className="text-sm font-medium text-[#FFF9FA]/90">
              Момент открывается...
            </p>
          </div>
        ) : (
          <p className="text-sm font-medium text-[#FFF9FA]/80">
            Соединяем ваши моменты...
          </p>
        )}
      </div>
    </div>
  );
};
