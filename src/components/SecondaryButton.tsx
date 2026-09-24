import React from 'react';

interface SecondaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  fullWidth?: boolean;
}

export const SecondaryButton: React.FC<SecondaryButtonProps> = ({
  children,
  fullWidth = true,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`min-h-[48px] px-5 py-2.5 rounded-[18px] font-semibold text-sm text-[#343033] bg-white border border-[#EBE3E5] hover:bg-[#FAF7F8] transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 select-none active:scale-[0.98] active:bg-[#F5EFF1] disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 ${
        fullWidth ? 'w-full' : ''
      } ${className}`}
    >
      {children}
    </button>
  );
};
