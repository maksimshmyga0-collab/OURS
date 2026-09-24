import React from 'react';

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: 'coral' | 'peach' | 'soft';
  fullWidth?: boolean;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  children,
  variant = 'coral',
  fullWidth = true,
  className = '',
  disabled,
  ...props
}) => {
  const variantStyles = {
    coral: 'bg-[#E98787] text-white hover:bg-[#E37979] active:bg-[#DB6E6E] shadow-[0_2px_8px_-2px_rgba(233,135,135,0.35)]',
    peach: 'bg-[#F7D8D0] text-[#343033] hover:bg-[#F2CDC3] active:bg-[#EBBFA8] shadow-[0_1px_3px_rgba(52,48,51,0.04)]',
    soft: 'bg-[#F6DCE1] text-[#343033] hover:bg-[#EFCAD3] active:bg-[#E8BDC7] shadow-[0_1px_3px_rgba(52,48,51,0.04)]',
  }[variant];

  return (
    <button
      {...props}
      disabled={disabled}
      className={`min-h-[50px] px-6 py-3 rounded-[18px] font-semibold text-sm tracking-tight transition-all duration-200 ease-out cursor-pointer flex items-center justify-center gap-2 select-none active:scale-[0.98] active:opacity-95 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 ${
        fullWidth ? 'w-full' : ''
      } ${variantStyles} ${className}`}
    >
      {children}
    </button>
  );
};
