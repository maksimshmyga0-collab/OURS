import React from 'react';
import { CoupleState, AppSettings, CoupleStreakInfo } from '../types';
import { Avatar } from '../components/Avatar';
import { PastelCard } from '../components/PastelCard';
import { Bell, Volume2, Smartphone, Shield, Sparkles, RefreshCw, ChevronRight, User, Camera } from 'lucide-react';
import { playSoftChime, triggerHaptic } from '../services/feedback';
import { getCoupleLevel, pluralizeWord } from '../services/gamification';

interface ProfileScreenProps {
  couple: CoupleState;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onOpenPremium: () => void;
  onResetApp: () => void;
  streakInfo?: CoupleStreakInfo;
  onOpenEditProfile?: () => void;
  onOpenThread?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  couple,
  settings,
  onUpdateSettings,
  onOpenPremium,
  onResetApp,
  streakInfo = {
    currentStreak: 0,
    totalActiveDays: 0,
    totalMoments: 0,
    duoMomentsCount: 0,
    singleMomentsCount: 0,
    daysWithOneMoment: 0,
    daysWithTwoMoments: 0,
    daysWithThreeMoments: 0,
    isTodayActive: false,
    activeDates: [],
    activeWeekDays: [],
  },
  onOpenEditProfile,
  onOpenThread,
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

  const coupleLevel = getCoupleLevel(streakInfo.totalMoments);

  return (
    <div className="space-y-6 pb-8">
      {/* Profile Header Card */}
      <PastelCard color="white" className="flex flex-col items-center text-center p-6 space-y-4">
        {/* Paired avatars */}
        <div className="flex items-center -space-x-3 pt-2">
          {/* User Avatar with interactive edit click */}
          <div
            onClick={onOpenEditProfile}
            className="relative cursor-pointer group active:scale-95 transition-transform"
            title="Нажмите, чтобы настроить профиль"
          >
            <Avatar
              name={couple.user.name}
              size="xl"
              bgColor={couple.user.avatarColor}
              imageUrl={couple.user.avatarUrl}
              className="ring-4 ring-white shadow-sm"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#E98787] text-white flex items-center justify-center border-2 border-white shadow-xs">
              <Camera size={11} />
            </div>
          </div>

          {/* Partner Avatar */}
          <Avatar
            name={couple.partner.name}
            size="xl"
            bgColor={couple.partner.avatarColor}
            imageUrl={couple.partner.avatarUrl}
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

          {/* Quick Profile Edit Button */}
          {onOpenEditProfile && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenEditProfile}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0F2] text-[#E98787] border border-[#EED7DC] text-xs font-semibold hover:bg-[#F6E2E6] transition-all cursor-pointer active:scale-95 shadow-2xs"
              >
                <User size={13} />
                <span>Твой профиль: {couple.user.name}</span>
              </button>
            </div>
          )}
        </div>

        {/* Dynamic «Наша история» statistics: 3 real metrics */}
        <div className="w-full grid grid-cols-3 gap-2 pt-2">
          {/* 1. Moments count */}
          <div className="rounded-[18px] bg-[#FAF0F2] border border-[#EED7DC] p-3 text-center">
            <span className="font-display text-base font-bold text-[#343033]">
              {streakInfo.totalMoments}
            </span>
            <p className="text-[10px] font-medium text-[#777277] mt-0.5 leading-tight">
              {pluralizeWord(streakInfo.totalMoments, 'момент', 'момента', 'моментов')}
            </p>
          </div>

          {/* 2. Days streak */}
          <div className="rounded-[18px] bg-[#FAF2E8] border border-[#F2DECF] p-3 text-center">
            <span className="font-display text-base font-bold text-[#343033]">
              {streakInfo.currentStreak}
            </span>
            <p className="text-[10px] font-medium text-[#777277] mt-0.5 leading-tight">
              {pluralizeWord(streakInfo.currentStreak, 'день подряд', 'дня подряд', 'дней подряд')}
            </p>
          </div>

          {/* 3. Days together */}
          <div className="rounded-[18px] bg-[#F4E8C9]/70 border border-[#E9DBB4]/80 p-3 text-center">
            <span className="font-display text-base font-bold text-[#343033]">
              {couple.daysTogether}
            </span>
            <p className="text-[10px] font-medium text-[#777277] mt-0.5 leading-tight">
              {pluralizeWord(couple.daysTogether, 'день вместе', 'дня вместе', 'дней вместе')}
            </p>
          </div>
        </div>

        {/* «Уровень нашей истории» Card */}
        <div className="w-full rounded-[18px] bg-[#FFF9FA] border border-[#EBE3E5] p-3 text-left space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{coupleLevel.levelIcon}</span>
              <span className="font-display text-xs font-bold text-[#343033]">
                {coupleLevel.levelTitle}
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#777277]">
              {coupleLevel.progressText}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-[#EFE8EA] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#E98787] transition-all duration-500 ease-out"
              style={{ width: `${coupleLevel.progressPercent}%` }}
            />
          </div>

          <p className="text-[10px] text-[#777277]">
            {coupleLevel.nextLevelThreshold
              ? `До следующего уровня: ${coupleLevel.remainingToNext} ${pluralizeWord(
                  coupleLevel.remainingToNext,
                  'момент',
                  'момента',
                  'моментов'
                )}`
              : 'Максимальный уровень пары! ✨'}
          </p>
        </div>
      </PastelCard>

      {/* «Наша нить» Entry Point */}
      {onOpenThread && (
        <div
          onClick={onOpenThread}
          className="rounded-[20px] p-4.5 bg-[#FAF5F7] border border-[#EEDCE2] shadow-2xs flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F6ECF0] transition-all duration-200 ease-out active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-[#EEDCE2] flex items-center justify-center text-[#E98787] shrink-0 shadow-2xs">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[#343033]">
                  Наша нить
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white text-[#E98787] border border-[#EEDCE2]">
                  {streakInfo.totalActiveDays} {pluralizeWord(streakInfo.totalActiveDays, 'день', 'дня', 'дней')}
                </span>
              </div>
              <p className="text-[11px] text-[#777277] mt-0.5">
                Уникальный узор вашей связи, который никогда не исчезает
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[#A89CA1] shrink-0" />
        </div>
      )}

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
              className={`w-12 h-7 rounded-full transition-colors duration-200 ease-out relative cursor-pointer active:scale-95 ${
                settings.notifications ? 'bg-[#E98787]' : 'bg-[#E5DFE1]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.14)] transition-transform duration-200 ease-out ${
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
              className={`w-12 h-7 rounded-full transition-colors duration-200 ease-out relative cursor-pointer active:scale-95 ${
                settings.sounds ? 'bg-[#E98787]' : 'bg-[#E5DFE1]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.14)] transition-transform duration-200 ease-out ${
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
              className={`w-12 h-7 rounded-full transition-colors duration-200 ease-out relative cursor-pointer active:scale-95 ${
                settings.haptic ? 'bg-[#E98787]' : 'bg-[#E5DFE1]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.14)] transition-transform duration-200 ease-out ${
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
