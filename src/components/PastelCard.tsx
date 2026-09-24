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
    white: 'bg-white border border-[#EBE3E5] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    'warm-neutral': 'bg-white border border-[#E8DFE1] main-moment-card-shadow',
    blue: 'bg-[#EDF4FB] border border-[#D5E3F0] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    pink: 'bg-[#FAF0F2] border border-[#EED7DC] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    peach: 'bg-[#FAF2EE] border border-[#EEDBD2] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    cream: 'bg-[#FAF6EC] border border-[#EBE3CD] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
    lilac: 'bg-[#F6F0F7] border border-[#E7DCE8] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_6px_20px_-4px_rgba(52,48,51,0.03)]',
  };

  return (
    <div
      onClick={onClick}
      className={`rounded-[24px] p-5 md:p-6 transition-all duration-150 ${bgColors[color]} ${
        onClick ? 'cursor-pointer active:scale-[0.99] active:opacity-95' : ''
      } ${className}`}
    >
      {children}
    </div>
  );
};
