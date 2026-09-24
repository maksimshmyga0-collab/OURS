import React, { useState, useRef } from 'react';
import { UserProfile, CoupleStreakInfo } from '../types';
import { Avatar } from './Avatar';
import { PrimaryButton } from './PrimaryButton';
import { ThemeSelector } from './ThemeSelector';
import { X, Camera, RotateCcw, Check, ChevronRight, Sparkles } from 'lucide-react';
import { getCoupleLevel, pluralizeWord } from '../services/gamification';
import { triggerHaptic, playSoftChime } from '../services/feedback';

export interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  onSaveProfile: (updatedUser: Partial<UserProfile>) => void;
  streakInfo: CoupleStreakInfo;
  daysTogether: number;
  handleOpenFingerprint?: () => void;
  onOpenFingerprint?: () => void;
  onOpenSky?: () => void;
  onOpenThread?: () => void;
  soundEnabled?: boolean;
  hapticEnabled?: boolean;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onSaveProfile,
  streakInfo,
  daysTogether,
  handleOpenFingerprint,
  onOpenFingerprint,
  onOpenSky,
  onOpenThread,
  soundEnabled = true,
  hapticEnabled = true,
}) => {
  const openSky = onOpenSky || onOpenFingerprint || handleOpenFingerprint || onOpenThread;
  const [name, setName] = useState(user.name);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user.avatarUrl || null);
  const [isPhotoChanged, setIsPhotoChanged] = useState(false);
  const [isSavedRecently, setIsSavedRecently] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleOpenFilePicker = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (typeof URL !== 'undefined' && URL.createObjectURL) {
        const objectUrl = URL.createObjectURL(file);
        setAvatarPreview(objectUrl);
        setIsPhotoChanged(true);
        triggerHaptic(hapticEnabled);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setAvatarPreview(event.target.result as string);
          setIsPhotoChanged(true);
          triggerHaptic(hapticEnabled);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRevertPhoto = () => {
    setAvatarPreview(user.avatarUrl || null);
    setIsPhotoChanged(false);
    triggerHaptic(hapticEnabled);
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const updated: Partial<UserProfile> = {};

    if (trimmedName && trimmedName !== user.name) {
      updated.name = trimmedName;
    }

    if (isPhotoChanged) {
      updated.avatarUrl = avatarPreview;
    }

    onSaveProfile(updated);
    setIsPhotoChanged(false);
    setIsSavedRecently(true);
    triggerHaptic(hapticEnabled);
    playSoftChime('success', soundEnabled);

    // Keep feedback visible for a moment
    setTimeout(() => {
      setIsSavedRecently(false);
    }, 2000);
  };

  const isFormDirty = name.trim() !== user.name || isPhotoChanged;
  const coupleLevel = getCoupleLevel(streakInfo.totalMoments);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/60 backdrop-blur-[6px] p-0 sm:p-4 overflow-y-auto no-scrollbar animate-in fade-in duration-200 ease-out"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md min-h-screen sm:min-h-0 sm:max-h-[92vh] sm:rounded-[32px] bg-[#FFF9FA] dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] shadow-lg flex flex-col justify-between p-5 sm:p-6 relative overflow-y-auto no-scrollbar animate-in fade-in slide-in-from-bottom-3 sm:zoom-in-[0.98] duration-250 ease-out transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F0E6E8] dark:border-[#242024]">
          <h2 className="font-display font-bold text-lg text-[#343033] dark:text-white">
            Твой профиль
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 py-4 space-y-5">
          {/* SECTION 1: Avatar & Name Editor */}
          <div className="bg-white dark:bg-[#161416] rounded-[24px] p-4.5 border border-[#EBE3E5] dark:border-[#242024] shadow-2xs flex flex-col items-center text-center space-y-4">
            {/* Avatar with Camera Overlay */}
            <div className="relative group">
              <Avatar
                name={name || user.name}
                size="xl"
                bgColor={user.avatarColor}
                imageUrl={avatarPreview}
                variant="user"
                className="w-24 h-24 text-2xl shadow-sm ring-4 ring-[#FAF0F2] dark:ring-[#201518]"
              />

              <button
                type="button"
                onClick={handleOpenFilePicker}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#E98787] text-white flex items-center justify-center shadow-sm border-2 border-white dark:border-[#161416] cursor-pointer active:scale-90 transition-transform"
                title="Выбрать новое фото"
              >
                <Camera size={14} />
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Photo Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleOpenFilePicker}
                className="px-3.5 py-1.5 rounded-full bg-[#FAF0F2] dark:bg-[#25151A] text-[#E98787] dark:text-[#F0B9C6] border border-[#EED7DC] dark:border-[#382229] text-xs font-semibold hover:bg-[#F5E5E9] dark:hover:bg-[#2E181F] transition-colors cursor-pointer active:scale-95"
              >
                Изменить фото
              </button>

              {isPhotoChanged && (
                <button
                  type="button"
                  onClick={handleRevertPhoto}
                  className="px-2.5 py-1.5 rounded-full bg-white dark:bg-[#1E1C1E] text-[#777277] dark:text-[#B8B2B5] border border-[#EBE3E5] dark:border-[#242024] text-xs font-medium hover:text-[#343033] dark:hover:text-white flex items-center gap-1 transition-colors cursor-pointer active:scale-95"
                  title="Отменить выбранное фото"
                >
                  <RotateCcw size={12} />
                  <span>Отменить</span>
                </button>
              )}
            </div>

            {/* Editable Name Field */}
            <div className="w-full text-left pt-1 space-y-2">
              <div>
                <label
                  htmlFor="user-profile-name"
                  className="block text-[11px] font-semibold text-[#777277] dark:text-[#B8B2B5] uppercase tracking-wider mb-1.5 px-1"
                >
                  Имя
                </label>
                <input
                  id="user-profile-name"
                  type="text"
                  maxLength={24}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Твоё имя"
                  className="w-full min-w-0 px-3.5 py-2.5 rounded-[16px] bg-[#FFF9FA] dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] text-sm font-semibold text-[#343033] dark:text-white focus:outline-none focus:border-[#E98787] focus:ring-1 focus:ring-[#E98787]/30 transition-all placeholder:text-[#A8A1A4] dark:placeholder:text-[#6E686B]"
                />
              </div>
              <button
                type="button"
                disabled={!isFormDirty && !isSavedRecently}
                onClick={handleSave}
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-[16px] text-xs font-bold transition-all duration-200 ease-out cursor-pointer flex items-center justify-center gap-1.5 select-none ${
                  isSavedRecently
                    ? 'bg-[#E5F3EC] dark:bg-[#152419] text-[#2B7348] dark:text-[#649A6E] border border-[#CDE5D8] dark:border-[#22452B]'
                    : isFormDirty
                    ? 'bg-[#E98787] text-white hover:bg-[#DE7777] active:scale-[0.98] shadow-xs'
                    : 'bg-[#F2ECEE] dark:bg-[#1F1C1F] text-[#A8A1A4] dark:text-[#6E686B] cursor-not-allowed'
                }`}
              >
                {isSavedRecently ? (
                  <>
                    <Check size={14} />
                    <span>Сохранено</span>
                  </>
                ) : (
                  <span>Сохранить</span>
                )}
              </button>
            </div>
          </div>

          {/* SECTION: «Тема» — Compact Segmented Control */}
          <div className="bg-white dark:bg-[#161416] rounded-[24px] p-4.5 border border-[#EBE3E5] dark:border-[#242024] shadow-2xs space-y-2.5">
            <h3 className="font-display text-sm font-bold text-[#343033] dark:text-white">
              Тема
            </h3>
            <ThemeSelector
              soundEnabled={soundEnabled}
              hapticEnabled={hapticEnabled}
            />
          </div>

          {/* SECTION 2: «Наша история» — Dynamic Real Metrics */}
          <div className="bg-white dark:bg-[#161416] rounded-[24px] p-4.5 border border-[#EBE3E5] dark:border-[#242024] shadow-2xs space-y-3">
            <h3 className="font-display text-sm font-bold text-[#343033] dark:text-white flex items-center gap-1.5">
              <span>Наша история</span>
            </h3>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {/* Stat 1: Total Moments */}
              <div className="rounded-[18px] bg-[#FAF0F2] dark:bg-[#1E1417] border border-[#EED7DC] dark:border-[#242024] p-3 text-center flex flex-col justify-between">
                <span className="text-xl">📸</span>
                <div className="mt-1">
                  <div className="font-display text-base font-bold text-[#343033] dark:text-white leading-none">
                    {streakInfo.totalMoments}
                  </div>
                  <div className="text-[10px] font-medium text-[#777277] dark:text-[#B8B2B5] mt-1 leading-tight">
                    {pluralizeWord(streakInfo.totalMoments, 'момент', 'момента', 'моментов')}
                  </div>
                </div>
              </div>

              {/* Stat 2: Consecutive Days Streak */}
              <div className="rounded-[18px] bg-[#FAF2E8] dark:bg-[#1F1714] border border-[#F2DECF] dark:border-[#242024] p-3 text-center flex flex-col justify-between">
                <span className="text-xl">🔥</span>
                <div className="mt-1">
                  <div className="font-display text-base font-bold text-[#343033] dark:text-white leading-none">
                    {streakInfo.currentStreak}
                  </div>
                  <div className="text-[10px] font-medium text-[#777277] dark:text-[#B8B2B5] mt-1 leading-tight">
                    {pluralizeWord(streakInfo.currentStreak, 'день подряд', 'дня подряд', 'дней подряд')}
                  </div>
                </div>
              </div>

              {/* Stat 3: Days Together */}
              <div className="rounded-[18px] bg-[#F4E8C9]/70 dark:bg-[#1C1A14] border border-[#E9DBB4]/80 dark:border-[#242024] p-3 text-center flex flex-col justify-between">
                <span className="text-xl">💗</span>
                <div className="mt-1">
                  <div className="font-display text-base font-bold text-[#343033] dark:text-white leading-none">
                    {daysTogether}
                  </div>
                  <div className="text-[10px] font-medium text-[#777277] dark:text-[#B8B2B5] mt-1 leading-tight">
                    {pluralizeWord(daysTogether, 'день вместе', 'дня вместе', 'дней вместе')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* «Наше небо» Entry Point */}
          {openSky && (
            <div
              onClick={() => {
                triggerHaptic(hapticEnabled);
                playSoftChime('tap', soundEnabled);
                openSky();
              }}
              className="rounded-[22px] p-4 bg-[#FAF5F7] dark:bg-[#161416] border border-[#EEDCE2] dark:border-[#242024] shadow-2xs flex items-center justify-between gap-3 cursor-pointer hover:bg-[#F6ECF0] dark:hover:bg-[#1E1B1E] transition-all duration-200 ease-out active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#201518] border border-[#EEDCE2] dark:border-[#382329] flex items-center justify-center text-[#E98787] shrink-0 shadow-2xs">
                  <Sparkles size={19} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-[#343033] dark:text-white">
                      Наше небо
                    </h4>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white dark:bg-[#251A1E] text-[#E98787] border border-[#EEDCE2] dark:border-[#382329] shrink-0">
                      Созвездие месяца
                    </span>
                  </div>
                  <p className="text-[11px] text-[#777277] dark:text-[#B8B2B5] mt-0.5 truncate">
                    Уникальный рисунок из звёзд вашей пары
                  </p>
                </div>
              </div>
              <ChevronRight size={18} className="text-[#A89CA1] dark:text-[#7A7176] shrink-0" />
            </div>
          )}

          {/* SECTION 3: «Уровень нашей истории» — Emotional Gamification */}
          <div className="bg-white dark:bg-[#161416] rounded-[24px] p-4.5 border border-[#EBE3E5] dark:border-[#242024] shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-[#777277] dark:text-[#B8B2B5] uppercase tracking-wider block">
                  Уровень нашей истории
                </span>
                <h4 className="font-display text-base font-bold text-[#343033] dark:text-white flex items-center gap-1.5 mt-0.5">
                  <span>{coupleLevel.levelIcon}</span>
                  <span>{coupleLevel.levelTitle}</span>
                </h4>
              </div>

              <span className="text-xs font-bold text-[#343033] dark:text-white px-2.5 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#1E1417] border border-[#EED7DC] dark:border-[#352126]">
                {coupleLevel.progressText}
              </span>
            </div>

            {/* Smooth Progress Bar */}
            <div className="w-full h-2.5 rounded-full bg-[#F2ECEE] dark:bg-[#242024] overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-[#E98787] transition-all duration-500 ease-out"
                style={{ width: `${coupleLevel.progressPercent}%` }}
              />
            </div>

            <p className="text-[11px] text-[#777277] dark:text-[#B8B2B5]">
              {coupleLevel.nextLevelThreshold
                ? `Ещё ${coupleLevel.remainingToNext} ${pluralizeWord(
                    coupleLevel.remainingToNext,
                    'момент',
                    'момента',
                    'моментов'
                  )} до следующего уровня`
                : 'Вы достигли максимального уровня совместной истории! ✨'}
            </p>
          </div>
        </div>

        {/* Footer Action */}
        <div className="pt-2">
          <PrimaryButton
            variant="coral"
            onClick={() => {
              if (isFormDirty) {
                handleSave();
              }
              onClose();
            }}
          >
            Готово
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
};
