import React from 'react';
import { CalendarHeart, Clock3, UserRound } from 'lucide-react';
import { NavigationTab } from '../types';

interface BottomTabBarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const tabs = [
    {
      id: 'today' as NavigationTab,
      label: 'Сегодня',
      icon: CalendarHeart,
    },
    {
      id: 'history' as NavigationTab,
      label: 'История',
      icon: Clock3,
    },
    {
      id: 'profile' as NavigationTab,
      label: 'Профиль',
      icon: UserRound,
    },
  ];

  return (
    <nav
      className="sticky bottom-0 z-40 bg-[#FFF9FA]/92 backdrop-blur-xl border-t border-[#000000]/6 px-4 pt-1.5 pb-2 transition-colors"
      aria-label="Нижняя навигация"
    >
      <div className="max-w-md mx-auto grid grid-cols-3 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="min-h-[48px] py-1 px-2 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ease-out cursor-pointer active:scale-95 select-none"
            >
              <Icon
                size={22}
                strokeWidth={isActive ? 2.3 : 1.75}
                className={`transition-colors duration-200 ease-out ${
                  isActive ? 'text-[#E98787]' : 'text-[#8A8488]'
                }`}
              />
              <span
                className={`text-[11px] tracking-tight leading-none transition-colors duration-200 ease-out ${
                  isActive ? 'font-semibold text-[#E98787]' : 'font-medium text-[#8A8488]'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
