import React from 'react';
import { useTheme } from '../services/theme/ThemeContext';
import { ThemeMode } from '../types';
import { triggerHaptic, playSoftChime } from '../services/feedback';
import { Sun, Moon, Settings, type LucideIcon } from 'lucide-react';

interface ThemeSelectorProps {
  className?: string;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
}

interface ThemeOption {
  id: ThemeMode;
  label: string;
  icon: LucideIcon;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: 'light', label: 'Светлая', icon: Sun },
  { id: 'dark', label: 'Тёмная', icon: Moon },
  { id: 'system', label: 'Системная', icon: Settings },
];

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({
  className = '',
  soundEnabled = true,
  hapticEnabled = true,
}) => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const handleSelect = (mode: ThemeMode) => {
    if (mode === theme) return;
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);
    setTheme(mode);
  };

  return (
    <div className={`w-full space-y-1.5 ${className}`}>
      {/* Compact Segmented Control */}
      <div
        role="radiogroup"
        aria-label="Выбор темы оформления"
        className="w-full bg-[#FAF5F7] dark:bg-[#181618] p-1 rounded-[18px] border border-[#EBE3E5] dark:border-[#242024] grid grid-cols-3 gap-1 shadow-2xs"
      >
        {THEME_OPTIONS.map((opt) => {
          const isSelected = theme === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => handleSelect(opt.id)}
              className={`min-h-[44px] py-2 px-1 sm:px-2 rounded-[14px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all duration-200 ease-out cursor-pointer select-none active:scale-[0.97] ${
                isSelected
                  ? 'bg-white dark:bg-[#252225] text-[#343033] dark:text-white shadow-[0_2px_6px_rgba(52,48,51,0.06)] dark:shadow-[0_2px_6px_rgba(0,0,0,0.5)] border border-[#EBE3E5]/70 dark:border-[#383338]'
                  : 'text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white hover:bg-white/40 dark:hover:bg-[#201D20]'
              }`}
            >
              <Icon
                size={15}
                strokeWidth={isSelected ? 2.1 : 1.8}
                className={`shrink-0 transition-colors duration-200 ${
                  isSelected
                    ? 'text-[#E98787] dark:text-[#F0B9C6]'
                    : 'text-[#777277] dark:text-[#B8B2B5]'
                }`}
                aria-hidden="true"
              />
              <span className="truncate leading-none">{opt.label}</span>
            </button>
          );
        })}
      </div>

      {/* Helpful subtle indicator when in system mode */}
      <div className="flex items-center justify-between px-1 text-[11px] text-[#777277] dark:text-[#B8B2B5]">
        <span>
          {theme === 'system'
            ? `По настройкам телефона (${resolvedTheme === 'dark' ? 'тёмная' : 'светлая'})`
            : theme === 'dark'
            ? 'Тёмная тема зафиксирована'
            : 'Светлая тема зафиксирована'}
        </span>
        <span className="text-[10px] font-medium text-[#E98787]">
          {theme === 'system' ? 'Авто' : 'Вручную'}
        </span>
      </div>
    </div>
  );
};
