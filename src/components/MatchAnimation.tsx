import React, { useEffect, useState } from 'react';
import { OursLogo } from './OursLogo';

interface MatchAnimationProps {
  onComplete: () => void;
}

export const MatchAnimation: React.FC<MatchAnimationProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'converge' | 'matched' | 'closing'>('converge');

  useEffect(() => {
    // Step 1 -> 2: Shapes converge softly into Match (750ms)
    const t1 = setTimeout(() => {
      setStep('matched');
    }, 750);

    // Step 2 -> 3: Soft fade out begins (1900ms)
    const t2 = setTimeout(() => {
      setStep('closing');
    }, 1900);

    // Step 3 -> complete: hand over smoothly to revealed photos (2300ms)
    const t3 = setTimeout(() => {
      onComplete();
    }, 2300);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-6 bg-[#343033]/60 backdrop-blur-md transition-opacity duration-400 ease-out ${
        step === 'closing'
          ? 'opacity-0 pointer-events-none'
          : 'opacity-100 animate-in fade-in duration-300'
      }`}
      aria-live="polite"
    >
      {/* Soft pastel ambient background aura */}
      <div className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-[#F6DCE1]/45 via-[#F7D8D0]/40 to-[#DDEAF7]/45 blur-3xl pointer-events-none transition-all duration-700 ease-out" />

      {/* Center animation container */}
      <div className="relative flex flex-col items-center text-center z-10">
        <div className="relative mb-6 flex items-center justify-center min-h-[90px]">
          {/* Converging two circles that smoothly meet */}
          <div
            className={`transition-all duration-500 ease-out flex items-center justify-center ${
              step === 'converge' ? 'opacity-100 scale-100' : 'opacity-0 scale-90 absolute'
            }`}
          >
            <div className="flex items-center -space-x-2">
              <div className="w-12 h-12 rounded-full bg-[#EFC1CB] border-2 border-white shadow-md transform transition-transform duration-700 ease-out" />
              <div className="w-12 h-12 rounded-full bg-[#DDEAF7] border-2 border-white shadow-md transform transition-transform duration-700 ease-out" />
            </div>
          </div>

          {/* Emerged Match Logo with soft scale */}
          <div
            className={`transition-all duration-500 ease-out ${
              step !== 'converge' ? 'opacity-100 scale-100' : 'opacity-0 scale-75 pointer-events-none'
            }`}
          >
            <div className="relative p-5 rounded-full bg-white/95 shadow-lg match-glow-shadow">
              <OursLogo size={52} variant="coral" />
            </div>
          </div>
        </div>

        {/* Text presentation with gentle fade/slide */}
        <div className="space-y-1.5 transition-all duration-400 ease-out">
          {step === 'converge' ? (
            <p className="text-sm font-medium text-[#FFF9FA]/80 animate-in fade-in duration-300">
              Соединяем ваши моменты...
            </p>
          ) : (
            <div className="animate-in fade-in zoom-in-95 duration-350 ease-out space-y-1">
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
