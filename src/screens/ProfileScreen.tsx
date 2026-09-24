import React from 'react';
import { CoupleState, AppSettings } from '../types';
import { Avatar } from '../components/Avatar';
import { PastelCard } from '../components/PastelCard';
import { Bell, Volume2, Smartphone, Shield, Sparkles, RefreshCw, ChevronRight } from 'lucide-react';
import { playSoftChime, triggerHaptic } from '../services/feedback';

interface ProfileScreenProps {
  couple: CoupleState;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onOpenPremium: () => void;
  onResetApp: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  couple,
  settings,
  onUpdateSettings,
  onOpenPremium,
  onResetApp,
}) => {
  const toggleNotification = () => {
    const updated = { ...settings, notifications: !settings.notifications };
    onUpdateSettings(updated);
    triggerHaptic(updated.haptic);
  };

  const toggleSounds = () => {
    const nextState = !settings.sounds;
    const updated = { ...settings, sounds: nextState };
    onUpdateSettings(updated);
    playSoftChime('tap', nextState);
  };

  const toggleHaptic = () => {
    const nextState = !settings.haptic;
    const updated = { ...settings, haptic: nextState };
    onUpdateSettings(updated);
    triggerHaptic(nextState);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Profile Header Card */}
      <PastelCard color="white" className="flex flex-col items-center text-center p-6 space-y-4">
        {/* Paired avatars */}
        <div className="flex items-center -space-x-3 pt-2">
          <Avatar
            name={couple.user.name}
            size="xl"
            bgColor={couple.user.avatarColor}
            className="ring-4 ring-white shadow-sm"
          />
          <Avatar
            name={couple.partner.name}
            size="xl"
            bgColor={couple.partner.avatarColor}
            className="ring-4 ring-white shadow-sm"
          />
        </div>

        <div>
          <h2 className="font-display text-xl font-bold text-[#343033]">
            {couple.user.name} + {couple.partner.name}
          </h2>
          <p className="text-xs text-[#777277] mt-0.5">
            Пара с {couple.startDate}
          </p>
        </div>

        {/* Small statistics highlight card in Cream Yellow #F4E8C9 */}
        <div className="w-full grid grid-cols-2 gap-2.5 pt-2">
          <div className="rounded-[18px] bg-[#F4E8C9]/70 border border-[#E9DBB4]/80 p-3 text-center">
            <span className="font-display text-lg font-bold text-[#343033]">
              {couple.daysTogether}
            </span>
            <p className="text-[11px] font-medium text-[#777277]">
              дней вместе
            </p>
          </div>

          <div className="rounded-[18px] bg-[#F6DCE1]/60 border border-[#EEC9D1]/80 p-3 text-center">
            <span className="font-display text-lg font-bold text-[#343033]">
              42
            </span>
            <p className="text-[11px] font-medium text-[#777277]">
              общих момента
            </p>
          </div>
        </div>
      </PastelCard>

      {/* Subscription Card */}
      <div
        onClick={onOpenPremium}
        className="rounded-[20px] p-4.5 bg-[#EDF4FB] border border-[#D5E3F0] shadow-2xs flex items-center justify-between gap-4 cursor-pointer hover:bg-[#E5F0FA] transition-all active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/80 border border-[#D5E3F0] flex items-center justify-center text-[#E98787] shrink-0">
            <Sparkles size={18} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[#343033]">
              Тариф OURS:{' '}
              {couple.subscription === 'premium'
                ? `Premium (${couple.subscriptionTariff === 'month' ? 'Месяц' : 'Год'})`
                : 'Базовый (7 дней)'}
            </h3>
            <p className="text-[11px] text-[#777277] mt-0.5">
              {couple.subscription === 'premium'
                ? 'Полный бессрочный архив вашей истории'
                : 'Сохранить все фото и воспоминания навсегда'}
            </p>
          </div>
        </div>
        <ChevronRight size={18} className="text-[#4A6B82] shrink-0" />
      </div>

      {/* Settings Section - iOS Grouped List */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold tracking-wider text-[#777277] uppercase px-1">
          Настройки
        </h3>

        <div className="rounded-[20px] bg-white border border-[#EBE3E5] divide-y divide-[#F2ECEE] overflow-hidden shadow-2xs">
          {/* Notifications Toggle */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF5F7] flex items-center justify-center text-[#777277]">
                <Bell size={16} />
              </div>
              <span className="text-xs font-medium text-[#343033]">
                Уведомления
              </span>
            </div>
            <button
              type="button"
              onClick={toggleNotification}
              className={`w-12 h-7 rounded-full transition-colors duration-200 relative cursor-pointer active:scale-95 ${
                settings.notifications ? 'bg-[#E98787]' : 'bg-[#E5DFE1]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.14)] transition-transform duration-200 ${
                  settings.notifications ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sound Toggle */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF5F7] flex items-center justify-center text-[#777277]">
                <Volume2 size={16} />
              </div>
              <span className="text-xs font-medium text-[#343033]">
                Звуки
              </span>
            </div>
            <button
              type="button"
              onClick={toggleSounds}
              className={`w-12 h-7 rounded-full transition-colors duration-200 relative cursor-pointer active:scale-95 ${
                settings.sounds ? 'bg-[#E98787]' : 'bg-[#E5DFE1]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.14)] transition-transform duration-200 ${
                  settings.sounds ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Haptic Toggle */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF5F7] flex items-center justify-center text-[#777277]">
                <Smartphone size={16} />
              </div>
              <span className="text-xs font-medium text-[#343033]">
                Тактильный отклик (Haptic)
              </span>
            </div>
            <button
              type="button"
              onClick={toggleHaptic}
              className={`w-12 h-7 rounded-full transition-colors duration-200 relative cursor-pointer active:scale-95 ${
                settings.haptic ? 'bg-[#E98787]' : 'bg-[#E5DFE1]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.14)] transition-transform duration-200 ${
                  settings.haptic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Privacy */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF5F7] flex items-center justify-center text-[#777277]">
                <Shield size={16} />
              </div>
              <div>
                <span className="text-xs font-medium text-[#343033] block">
                  Приватность
                </span>
                <span className="text-[10px] text-[#777277]">
                  Доступно только вам двоим
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#4A6B82]">
              Защищено
            </span>
          </div>
        </div>
      </div>

      {/* App Reset for Demo Testing */}
      <div className="pt-2 text-center">
        <button
          type="button"
          onClick={onResetApp}
          className="text-xs font-medium text-[#777277] hover:text-[#E98787] transition-colors cursor-pointer inline-flex items-center gap-1.5 py-2 px-3"
        >
          <RefreshCw size={12} />
          <span>Сбросить данные приложения</span>
        </button>
      </div>
    </div>
  );
};
