import React from 'react';

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  bgColor?: string;
  imageUrl?: string | null;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  bgColor = '#F6DCE1',
  imageUrl,
  className = '',
}) => {
  const [hasError, setHasError] = React.useState(false);
  const initial = name ? name.trim().charAt(0).toUpperCase() : '?';

  // Reset error if imageUrl changes
  React.useEffect(() => {
    setHasError(false);
  }, [imageUrl]);

  const sizeClasses = {
    sm: 'w-7 h-7 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
    xl: 'w-16 h-16 text-xl font-bold',
  }[size];

  return (
    <div
      className={`rounded-full flex items-center justify-center font-medium text-[#343033] shrink-0 border border-white/80 shadow-xs select-none overflow-hidden relative ${sizeClasses} ${className}`}
      style={{ backgroundColor: bgColor }}
      aria-label={name}
    >
      {imageUrl && !hasError ? (
        <img
          src={imageUrl}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
};
