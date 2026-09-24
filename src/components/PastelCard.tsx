import React from 'react';

export type PastelCardColor = 'white' | 'warm-neutral' | 'blue' | 'pink' | 'peach' | 'cream' | 'lilac';

interface PastelCardProps {
  children: React.ReactNode;
  color?: PastelCardColor;
  className?: string;
  onClick?: () => void;
}

export const PastelCard: React.FC<PastelCardProps> = ({
  children,
  color = 'white',
  className = '',
  onClick,
}) => {
  const bgColors: Record<PastelCardColor, string> = {
    white:
      'bg-white dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    'warm-neutral':
      'bg-white dark:bg-[#111111] border border-[#E8DFE1] dark:border-[#242024] main-moment-card-shadow',
    blue:
      'bg-[#EDF4FB] dark:bg-[#141A22] border border-[#D5E3F0] dark:border-[#212E3C] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    pink:
      'bg-[#FAF0F2] dark:bg-[#1E1417] border border-[#EED7DC] dark:border-[#352126] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    peach:
      'bg-[#FAF2EE] dark:bg-[#1F1714] border border-[#EEDBD2] dark:border-[#382822] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    cream:
      'bg-[#FAF6EC] dark:bg-[#1C1A14] border border-[#EBE3CD] dark:border-[#342F21] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    lilac:
      'bg-[#F6F0F7] dark:bg-[#1A151E] border border-[#E7DCE8] dark:border-[#312338] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-[24px] p-5 md:p-6 transition-all duration-200 ease-out ${bgColors[color]} ${
        onClick ? 'cursor-pointer active:scale-[0.99] active:opacity-95' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
