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
    coral:
      'bg-gradient-to-r from-[#F0B9C6] via-[#E98787] to-[#E27A7A] text-white shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.45),0_8px_24px_-6px_rgba(233,135,135,0.32)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_8px_24px_-6px_rgba(0,0,0,0.5)] dark:from-[#C95B6F] dark:via-[#B84E5F] dark:to-[#A3404D] border border-white/35 dark:border-white/20',
    peach:
      'bg-gradient-to-r from-[#F0B9C6] via-[#E98787] to-[#E27A7A] text-white shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.45),0_8px_24px_-6px_rgba(233,135,135,0.32)] dark:shadow-[inset_0_1px_1.5px_rgba(255,255,255,0.2),0_8px_24px_-6px_rgba(0,0,0,0.5)] dark:from-[#C95B6F] dark:via-[#B84E5B] dark:to-[#A3404D] border border-white/35 dark:border-white/20',
    soft:
      'bg-[#F6DCE1] text-[#343033] hover:bg-[#EFCAD3] active:bg-[#E8BDC7] shadow-[0_1px_3px_rgba(52,48,51,0.04)] dark:bg-[#301D24] dark:text-[#FFFFFF] dark:hover:bg-[#3D262F] border border-[#ECD3DA] dark:border-[#422632]',
  }[variant];

  return (
    <button
      {...props}
      disabled={disabled}
      className={`h-[52px] xs:h-[54px] px-6 py-3 rounded-full font-display font-semibold text-[15px] sm:text-[15.5px] tracking-tight transition-all duration-200 ease-out cursor-pointer flex items-center justify-center gap-2 select-none hover:opacity-95 active:scale-[0.985] active:opacity-90 disabled:opacity-40 disabled:pointer-events-none disabled:active:scale-100 ${
        fullWidth ? 'w-full' : ''
      } ${variantStyles} ${className}`}
    >
      {children}
    </button>
  );
};
