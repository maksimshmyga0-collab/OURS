import React, { useState } from 'react';
import { CoupleState, CoupleStreakInfo, AppSettings } from '../types';
import { PastelCard } from '../components/PastelCard';
import { Avatar } from '../components/Avatar';
import { ThemeSelector } from '../components/ThemeSelector';
import {
  Bell,
  Volume2,
  Smartphone,
  Shield,
  Palette,
  Heart,
  ChevronRight,
  User,
  Sparkles,
  Camera,
  LogOut,
  UserMinus,
} from 'lucide-react';
import { getCoupleLevel, pluralizeWord } from '../services/gamification';
import { triggerHaptic } from '../services/feedback';

export interface ProfileScreenProps {
  couple: CoupleState;
  streakInfo: CoupleStreakInfo;
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onResetApp?: () => void;
  onOpenEditProfile?: () => void;
  onOpenLovely?: () => void;
  onOpenPremium?: () => void;
  onOpenSky?: () => void;
  onOpenFingerprint?: () => void;
  onOpenThread?: () => void;
  onLeavePair?: () => Promise<void> | void;
  onSignOut?: () => Promise<void> | void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  couple,
  streakInfo,
  settings,
  onUpdateSettings,
  onResetApp,
  onOpenEditProfile,
  onOpenLovely,
  onOpenPremium,
  onOpenSky,
  onOpenFingerprint,
  onOpenThread,
  onLeavePair,
  onSignOut,
}) => {
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const handleOpenLovely = onOpenLovely || onOpenPremium;
  const handleOpenSky = onOpenSky || onOpenFingerprint || onOpenThread;

  const toggleNotification = () => {
    const nextState = !settings.notifications;
    const updated = { ...settings, notifications: nextState };
    onUpdateSettings(updated);
    triggerHaptic(nextState);
  };

  const toggleSounds = () => {
    const nextState = !settings.sounds;
    const updated = { ...settings, sounds: nextState };
    onUpdateSettings(updated);
    triggerHaptic(nextState);
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
            className="relative cursor-pointer group active:scale-[0.96] transition-transform duration-180 ease-out"
            title="Нажмите, чтобы настроить профиль"
          >
            <Avatar
              name={couple.user.name}
              size="xl"
              bgColor={couple.user.avatarColor}
              imageUrl={couple.user.avatarUrl}
              variant="user"
              className="ring-4 ring-white dark:ring-[#111111] shadow-sm"
            />
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#E98787] text-white flex items-center justify-center border-2 border-white dark:border-[#111111] shadow-xs">
              <Camera size={11} />
            </div>
          </div>

          {/* Partner Avatar */}
          <Avatar
            name={couple.partner.name}
            size="xl"
            bgColor={couple.partner.avatarColor}
            imageUrl={couple.partner.avatarUrl}
            variant="partner"
            className="ring-4 ring-white dark:ring-[#111111] shadow-sm"
          />
        </div>

        <div>
          <h2 className="font-display text-xl font-bold text-[#343033] dark:text-white">
            {couple.user.name} + {couple.partner.name}
          </h2>
          <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
            Пара с {couple.startDate}
          </p>

          {/* Quick Profile Edit Button */}
          {onOpenEditProfile && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onOpenEditProfile}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#1E1417] text-[#E98787] dark:text-[#F0B9C6] border border-[#EED7DC] dark:border-[#352126] text-xs font-semibold hover:bg-[#F6E2E6] dark:hover:bg-[#2A181E] transition-all cursor-pointer active:scale-95 shadow-2xs"
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
          <div className="rounded-[18px] bg-[#FAF0F2] dark:bg-[#1E1417] border border-[#EED7DC] dark:border-[#242024] p-3 text-center">
            <span className="font-display text-base font-bold text-[#343033] dark:text-white">
              {streakInfo.totalMoments}
            </span>
            <p className="text-[10px] font-medium text-[#777277] dark:text-[#B8B2B5] mt-0.5 leading-tight">
              {pluralizeWord(streakInfo.totalMoments, 'момент', 'момента', 'моментов')}
            </p>
          </div>

          {/* 2. Days streak */}
          <div className="rounded-[18px] bg-[#FAF2E8] dark:bg-[#1F1714] border border-[#F2DECF] dark:border-[#242024] p-3 text-center">
            <span className="font-display text-base font-bold text-[#343033] dark:text-white">
              {streakInfo.currentStreak}
            </span>
            <p className="text-[10px] font-medium text-[#777277] dark:text-[#B8B2B5] mt-0.5 leading-tight">
              {pluralizeWord(streakInfo.currentStreak, 'день подряд', 'дня подряд', 'дней подряд')}
            </p>
          </div>

          {/* 3. Days together */}
          <div className="rounded-[18px] bg-[#F4E8C9]/70 dark:bg-[#1C1A14] border border-[#E9DBB4]/80 dark:border-[#242024] p-3 text-center">
            <span className="font-display text-base font-bold text-[#343033] dark:text-white">
              {couple.daysTogether}
            </span>
            <p className="text-[10px] font-medium text-[#777277] dark:text-[#B8B2B5] mt-0.5 leading-tight">
              {pluralizeWord(couple.daysTogether, 'день вместе', 'дня вместе', 'дней вместе')}
            </p>
          </div>
        </div>

        {/* «Уровень нашей истории» Card */}
        <div className="w-full rounded-[18px] bg-[#FFF9FA] dark:bg-[#121212] border border-[#EBE3E5] dark:border-[#242024] p-3 text-left space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#FAF0F2] dark:bg-[#201518] text-[#E98787] dark:text-[#F0B9C6] border border-[#EED7DC]/80 dark:border-[#382329] shrink-0"
                aria-hidden="true"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-3.5 h-3.5"
                >
                  <path
                    d="M10 2.5C10 6.64 6.64 10 2.5 10C6.64 10 10 13.36 10 17.5C10 13.36 13.36 10 17.5 10C13.36 10 10 6.64 10 2.5Z"
                    opacity={coupleLevel.progressPercent > 0 ? 0.95 : 0.8}
                  />
                  <circle cx="10" cy="10" r="1.2" fill="#FFFFFF" opacity="0.9" />
                </svg>
              </span>
              <span className="font-display text-xs font-bold text-[#343033] dark:text-white">
                {coupleLevel.levelTitle}
              </span>
            </div>
            <span className="text-[11px] font-bold text-[#777277] dark:text-[#B8B2B5]">
              {coupleLevel.progressText}
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-[#EFE8EA] dark:bg-[#242024] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#E98787] transition-all duration-500 ease-out"
              style={{ width: `${coupleLevel.progressPercent}%` }}
            />
          </div>

          <p className="text-[10px] text-[#777277] dark:text-[#B8B2B5]">
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

      {/* «Наше небо» Entry Point */}
      {handleOpenSky && (
        <div
          onClick={handleOpenSky}
          className="rounded-[20px] p-4.5 bg-[#FAF5F7] dark:bg-[#161416] border border-[#EEDCE2] dark:border-[#242024] shadow-2xs flex items-center justify-between gap-4 cursor-pointer hover:bg-[#F6ECF0] dark:hover:bg-[#1E1B1E] transition-all duration-200 ease-out active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#201518] border border-[#EEDCE2] dark:border-[#382329] flex items-center justify-center text-[#E98787] shrink-0 shadow-2xs">
              <Sparkles size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[#343033] dark:text-white">
                  Наше небо
                </h3>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-[#251A1E] text-[#E98787] border border-[#EEDCE2] dark:border-[#382329]">
                  Созвездие месяца
                </span>
              </div>
              <p className="text-[11px] text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                Уникальный рисунок из звёзд вашей пары
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[#A89CA1] dark:text-[#7A7176] shrink-0" />
        </div>
      )}

      {/* LOVELY Status Card: Brand Heart Icon without duplicate emoji */}
      {handleOpenLovely && (
        <div
          onClick={handleOpenLovely}
          className={`rounded-[20px] p-4.5 shadow-2xs flex items-center justify-between gap-4 cursor-pointer transition-all duration-200 ease-out active:scale-[0.99] ${
            couple.isLovely || couple.subscription === 'premium'
              ? 'bg-[#FAF0F2] dark:bg-[#1A1416] border border-[#F2D1D8] dark:border-[#382229] hover:bg-[#F6E6EB] dark:hover:bg-[#22171A]'
              : 'bg-[#FFF3F5] dark:bg-[#171315] border border-[#F2D6DC] dark:border-[#332026] hover:bg-[#FCE8ED] dark:hover:bg-[#1F171A]'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#25151B] border border-[#F2D1D8] dark:border-[#42222B] flex items-center justify-center text-[#E98787] shrink-0 shadow-2xs">
              <Heart
                size={18}
                className={couple.isLovely || couple.subscription === 'premium' ? 'fill-[#E98787]' : ''}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-[#343033] dark:text-white">
                  {couple.isLovely || couple.subscription === 'premium'
                    ? 'LOVELY'
                    : 'Стать LOVELY'}
                </h3>
                {couple.isLovely || couple.subscription === 'premium' ? (
                  <span className="text-[10px] font-semibold text-[#649A6E] px-2 py-0.5 rounded-full bg-white dark:bg-[#152419] border border-[#D3EED8] dark:border-[#22452B]">
                    Активно
                  </span>
                ) : null}
              </div>
              <p className="text-[11px] text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                Одна покупка — для вас двоих
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-[#A89CA1] dark:text-[#7A7176] shrink-0" />
        </div>
      )}

      {/* Settings Section - iOS Grouped List */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold tracking-wider text-[#777277] dark:text-[#B8B2B5] uppercase px-1">
          Настройки
        </h3>

        <div className="rounded-[20px] bg-white dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] divide-y divide-[#F2ECEE] dark:divide-[#242024] overflow-hidden shadow-2xs">
          {/* Theme Mode Selector */}
          <div className="p-4 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF5F7] dark:bg-[#181618] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5]">
                <Palette size={16} />
              </div>
              <span className="text-xs font-medium text-[#343033] dark:text-white">
                Тема
              </span>
            </div>
            <ThemeSelector
              soundEnabled={settings.sounds}
              hapticEnabled={settings.haptic}
            />
          </div>

          {/* Notifications Toggle */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF5F7] dark:bg-[#181618] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5]">
                <Bell size={16} />
              </div>
              <span className="text-xs font-medium text-[#343033] dark:text-white">
                Уведомления
              </span>
            </div>
            <button
              type="button"
              onClick={toggleNotification}
              className={`w-12 h-7 rounded-full transition-colors duration-300 ease-in-out relative cursor-pointer active:scale-[0.97] ${
                settings.notifications ? 'bg-[#E98787]' : 'bg-[#E5DFE1] dark:bg-[#2A262A]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.14)] transition-transform duration-300 cubic-bezier(0.25,1,0.5,1) ${
                  settings.notifications ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sound Toggle */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF5F7] dark:bg-[#181618] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5]">
                <Volume2 size={16} />
              </div>
              <span className="text-xs font-medium text-[#343033] dark:text-white">
                Звуки
              </span>
            </div>
            <button
              type="button"
              onClick={toggleSounds}
              className={`w-12 h-7 rounded-full transition-colors duration-300 ease-in-out relative cursor-pointer active:scale-[0.97] ${
                settings.sounds ? 'bg-[#E98787]' : 'bg-[#E5DFE1] dark:bg-[#2A262A]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.14)] transition-transform duration-300 cubic-bezier(0.25,1,0.5,1) ${
                  settings.sounds ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Haptic Toggle */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF5F7] dark:bg-[#181618] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5]">
                <Smartphone size={16} />
              </div>
              <span className="text-xs font-medium text-[#343033] dark:text-white">
                Тактильный отклик (Haptic)
              </span>
            </div>
            <button
              type="button"
              onClick={toggleHaptic}
              className={`w-12 h-7 rounded-full transition-colors duration-300 ease-in-out relative cursor-pointer active:scale-[0.97] ${
                settings.haptic ? 'bg-[#E98787]' : 'bg-[#E5DFE1] dark:bg-[#2A262A]'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-[0_2px_4px_rgba(0,0,0,0.14)] transition-transform duration-300 cubic-bezier(0.25,1,0.5,1) ${
                  settings.haptic ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Privacy */}
          <div className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#FAF5F7] dark:bg-[#181618] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5]">
                <Shield size={16} />
              </div>
              <div>
                <span className="text-xs font-medium text-[#343033] dark:text-white block">
                  Приватность
                </span>
                <span className="text-[10px] text-[#777277] dark:text-[#B8B2B5]">
                  Доступно только вам двоим
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold text-[#4A6B82] dark:text-[#88ADC8]">
              Защищено
            </span>
          </div>

          {/* Leave Pair Action */}
          {onLeavePair && (couple.connected || couple.id) && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(true);
                setIsLeaveModalOpen(true);
              }}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-[#FAF5F7] dark:hover:bg-[#181618] transition-colors cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#FAF0F2] dark:bg-[#201518] flex items-center justify-center text-[#E98787] dark:text-[#F0B9C6]">
                  <UserMinus size={16} />
                </div>
                <div>
                  <span className="text-xs font-medium text-[#343033] dark:text-white block">
                    Покинуть пару
                  </span>
                  <span className="text-[10px] text-[#777277] dark:text-[#B8B2B5]">
                    Перестать быть участником этой пары
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#A89CA1] dark:text-[#7A7176] shrink-0" />
            </button>
          )}

          {/* Sign Out Action */}
          {onSignOut && (
            <button
              type="button"
              onClick={() => {
                triggerHaptic(true);
                setIsSignOutModalOpen(true);
              }}
              className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-[#FAF5F7] dark:hover:bg-[#181618] transition-colors cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#FAF5F7] dark:bg-[#181618] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5]">
                  <LogOut size={16} />
                </div>
                <div>
                  <span className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] block">
                    Выйти
                  </span>
                  <span className="text-[10px] text-[#A89CA1] dark:text-[#7A7176]">
                    Завершить сессию на этом устройстве
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-[#A89CA1] dark:text-[#7A7176] shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal: Покинуть пару */}
      {isLeaveModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#000000]/60 backdrop-blur-[6px] animate-in fade-in duration-200 ease-out"
          onClick={() => !isProcessing && setIsLeaveModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 shadow-[0_-4px_32px_rgba(0,0,0,0.14)] animate-in slide-in-from-bottom-4 sm:zoom-in-[0.98] duration-250 ease-out transition-colors space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#FAF0F2] dark:bg-[#26151A] border border-[#F2D1D8] dark:border-[#42222B] flex items-center justify-center text-[#E98787] shrink-0">
                <UserMinus size={22} />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-[#343033] dark:text-white">
                  Покинуть пару?
                </h3>
                <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5 leading-snug">
                  После этого ты перестанешь быть участником этой пары.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={async () => {
                  if (isProcessing) return;
                  setIsProcessing(true);
                  try {
                    if (onLeavePair) {
                      await onLeavePair();
                    }
                  } finally {
                    setIsProcessing(false);
                    setIsLeaveModalOpen(false);
                  }
                }}
                className="w-full py-3.5 px-4 rounded-[20px] font-semibold text-sm text-white bg-[#E98787] hover:bg-[#E2768E] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isProcessing ? 'Выходим из пары...' : 'Покинуть пару'}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setIsLeaveModalOpen(false)}
                className="w-full py-3 text-center text-xs font-semibold text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Выйти */}
      {isSignOutModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#000000]/60 backdrop-blur-[6px] animate-in fade-in duration-200 ease-out"
          onClick={() => !isProcessing && setIsSignOutModalOpen(false)}
        >
          <div
            className="w-full max-w-md bg-white dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 shadow-[0_-4px_32px_rgba(0,0,0,0.14)] animate-in slide-in-from-bottom-4 sm:zoom-in-[0.98] duration-250 ease-out transition-colors space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-[#FAF5F7] dark:bg-[#181618] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] shrink-0">
                <LogOut size={22} />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-[#343033] dark:text-white">
                  Выйти из аккаунта?
                </h3>
                <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5 leading-snug">
                  Сессия на этом устройстве будет завершена.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={async () => {
                  if (isProcessing) return;
                  setIsProcessing(true);
                  try {
                    if (onSignOut) {
                      await onSignOut();
                    }
                  } finally {
                    setIsProcessing(false);
                    setIsSignOutModalOpen(false);
                  }
                }}
                className="w-full py-3.5 px-4 rounded-[20px] font-semibold text-sm text-[#343033] dark:text-white bg-[#FAF5F7] dark:bg-[#1E1B1E] border border-[#EBE3E5] dark:border-[#2A262A] hover:bg-[#F2ECEE] dark:hover:bg-[#252225] active:scale-[0.99] transition-all flex items-center justify-center cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isProcessing ? 'Выполняется выход...' : 'Выйти'}
              </button>
              <button
                type="button"
                disabled={isProcessing}
                onClick={() => setIsSignOutModalOpen(false)}
                className="w-full py-3 text-center text-xs font-semibold text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-colors cursor-pointer"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
