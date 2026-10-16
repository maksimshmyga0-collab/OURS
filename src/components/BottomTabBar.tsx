import React from 'react';
import { Clock3, HeartHandshake, Mail, UserRound, Images } from 'lucide-react';
import { NavigationTab } from '../types';

interface BottomTabBarProps {
  activeTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  hasDateNotification?: boolean;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = React.memo(({
  activeTab,
  onTabChange,
  hasDateNotification = false,
}) => {
  const tabs = [
    {
      id: 'date' as NavigationTab,
      label: 'Свидание',
      icon: Mail,
    },
    {
      id: 'today' as NavigationTab,
      label: 'Касание',
      icon: HeartHandshake,
    },
    {
      id: 'our_day' as NavigationTab,
      label: 'Наш день',
      icon: Images,
    },
    {
      id: 'history' as NavigationTab,
      label: 'История',
      icon: Clock3,
    },
  ];

  return (
    <nav
      className="shrink-0 z-40 relative bg-[#FFF9FA] dark:bg-[#000000] border-t border-[#000000]/6 dark:border-[#242024] border-b-0 outline-none px-2 sm:px-4 pt-1.5 transition-colors after:content-[''] after:absolute after:top-full after:left-0 after:right-0 after:h-24 after:bg-[#FFF9FA] dark:after:bg-[#000000] after:pointer-events-none"
      style={{
        paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom, 0px))',
      }}
      aria-label="Нижняя навигация"
    >
      <div className="max-w-md mx-auto grid grid-cols-4 gap-1 sm:gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className="min-h-[48px] py-1 px-1 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-100 ease-out cursor-pointer active:scale-95 select-none"
            >
              <div className="relative">
                <Icon
                  size={21}
                  strokeWidth={isActive ? 2.3 : 1.75}
                  className={`transition-colors duration-200 ease-out ${
                    isActive ? 'text-[#E98787]' : 'text-[#8A8488] dark:text-[#B8B2B5]'
                  }`}
                />
                {tab.id === 'date' && hasDateNotification && (
                  <span
                    className="absolute -top-0.5 -right-1 w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-[#F0B9C6] to-[#E98787] ring-2 ring-[#FFF9FA] dark:ring-black animate-pulse shadow-xs"
                    aria-label="Новое приглашение"
                  />
                )}
              </div>
              <span
                className={`text-[10px] sm:text-[11px] tracking-tight leading-none whitespace-nowrap transition-colors duration-200 ease-out ${
                  isActive ? 'font-semibold text-[#E98787]' : 'font-medium text-[#8A8488] dark:text-[#B8B2B5]'
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
});
