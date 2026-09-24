import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Moment, CoupleState, ReactionEmoji } from '../types';
import { PastelCard, PastelCardColor } from '../components/PastelCard';
import { PhotoSlot } from '../components/PhotoSlot';
import { ReactionPicker } from '../components/ReactionPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressDots } from '../components/ProgressDots';
import { MatchAnimation } from '../components/MatchAnimation';
import { PhotoPickerModal } from '../components/PhotoPickerModal';
import { playSoftChime, triggerHaptic } from '../services/feedback';
import { Check, Sparkles, Clock, Heart } from 'lucide-react';
import { CoupleStreakInfo, MomentPhoto } from '../types';
import {
  calculateMomentAvailability,
  formatRemainingTime,
} from '../services/moments/momentTiming';

interface TodayScreenProps {
  couple: CoupleState;
  moments: Moment[];
  activeMomentId: string;
  onSelectActiveMoment: (momentId: string) => void;
  onUpdateMoment: (updated: Moment) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  streakInfo?: CoupleStreakInfo;
  onOpenStreak?: () => void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  couple,
  moments,
  activeMomentId,
  onSelectActiveMoment,
  onUpdateMoment,
  soundEnabled,
  hapticEnabled,
  streakInfo,
  onOpenStreak,
}) => {
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [isMatching, setIsMatching] = useState(false);

  // Live timer for live countdown calculation
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Calculate moment availability & interval constraints from authoritative timestamps
  const availability = useMemo(() => {
    return calculateMomentAvailability(moments, now);
  }, [moments, now]);

  // Determine active moment - ALWAYS only one single current touch
  const activeMoment = useMemo(() => {
    // If user has a selected moment
    const current = moments.find((m) => m.id === activeMomentId);
    if (current) return current;

    // Otherwise pick the current unlocked moment
    if (availability.nextOrder) {
      const nextM = moments.find((m) => m.order === availability.nextOrder);
      if (nextM) return nextM;
    }

    return moments[0];
  }, [moments, activeMomentId, availability.nextOrder]);

  if (!activeMoment) {
    return null;
  }

  // Active moment specific status flags
  const isCurrentMomentWaiting =
    activeMoment.order === availability.nextOrder &&
    activeMoment.status === 'EMPTY' &&
    availability.isWaitingForNext;

  const isCurrentMomentReady =
    activeMoment.order === availability.nextOrder &&
    activeMoment.status === 'EMPTY' &&
    availability.isNextMomentReady;

  // Handle photo selection for the current user
  const handlePhotoSelected = (photoUrl: string) => {
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);

    const nowIso = new Date().toISOString();
    const partnerPhotoItem: MomentPhoto[] = activeMoment.partnerPhoto
      ? [
          {
            userId: couple.partner.id || 'user-b-default',
            imageUrl: activeMoment.partnerPhoto,
            createdAt: nowIso,
          },
        ]
      : [];
    const userPhotoItem: MomentPhoto = {
      userId: couple.user.id || 'user-a-default',
      imageUrl: photoUrl,
      createdAt: nowIso,
    };

    const newPhotos = [userPhotoItem, ...partnerPhotoItem];
    const newStatus = activeMoment.partnerPhoto ? 'BOTH_UPLOADED' : 'USER_UPLOADED';

    onUpdateMoment({
      ...activeMoment,
      userPhoto: photoUrl,
      photos: newPhotos,
      status: newStatus,
    });

    setIsPhotoPickerOpen(false);
  };

  // Trigger Match animation when both uploaded (idempotent, single-trigger)
  const handleOpenMoment = () => {
    if (activeMoment.status !== 'BOTH_UPLOADED' || isMatching) return;
    triggerHaptic(hapticEnabled);
    playSoftChime('match', soundEnabled);
    setIsMatching(true);
  };

  // When match animation completes -> REVEALED (guaranteed safe transition)
  const handleMatchComplete = useCallback(() => {
    setIsMatching(false);
    onUpdateMoment({
      ...activeMoment,
      status: 'REVEALED',
    });
  }, [activeMoment, onUpdateMoment]);

  // Handle reaction on partner photo
  const handleSelectReaction = (emoji: ReactionEmoji) => {
    triggerHaptic(hapticEnabled);
    playSoftChime('react', soundEnabled);

    onUpdateMoment({
      ...activeMoment,
      userReaction: emoji,
      partnerReaction: activeMoment.partnerReaction || '❤️',
      status: 'REACTED',
    });
  };

  // Complete moment & advance timestamp
  const handleSaveAndComplete = () => {
    triggerHaptic(hapticEnabled);
    playSoftChime('success', soundEnabled);

    const nowTs = Date.now();
    const updated: Moment = {
      ...activeMoment,
      status: 'COMPLETED',
      completedTimestamp: nowTs,
      completedAt: new Date(nowTs).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    onUpdateMoment(updated);

    // If there is a next moment within the 3 allowed moments, select it
    const nextMoment = moments.find((m) => m.order === activeMoment.order + 1);
    if (nextMoment) {
      onSelectActiveMoment(nextMoment.id);
    }
  };

  const getThemeCardColor = (_moment: Moment): PastelCardColor => {
    return 'warm-neutral';
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Day Status Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#343033] dark:text-white">
            Сегодня
          </h1>
          <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
            {availability.completedCount} из 3 касаний
          </p>
        </div>
        <ProgressDots
          total={3}
          completed={availability.completedCount}
          activeOrder={activeMoment.order}
        />
      </div>

      {/* Main Single Active Daily Moment Card */}
      <PastelCard
        color={getThemeCardColor(activeMoment)}
        className="relative overflow-hidden transition-all duration-300 ease-out"
      >
        {/* Card Header info */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold tracking-wider text-[#777277] dark:text-[#B8B2B5] uppercase transition-colors duration-200">
            {isCurrentMomentWaiting
              ? `${activeMoment.label} · ПАУЗА`
              : activeMoment.label}
          </span>

          {activeMoment.status === 'COMPLETED' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2B7348] dark:text-[#52B778] animate-in fade-in duration-200">
              <Check size={14} />
              Сохранено
            </span>
          ) : isCurrentMomentWaiting ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-[#1E1C1E] border border-[#EED7DC] dark:border-[#2D2024] text-[11px] font-semibold text-[#E2765A] dark:text-[#F2967F] animate-in fade-in duration-200">
              <Clock size={12} />
              Следующее скоро
            </span>
          ) : isCurrentMomentReady ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6] animate-in fade-in duration-200">
              <Sparkles size={13} />
              Готово
            </span>
          ) : activeMoment.status === 'BOTH_UPLOADED' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6] animate-in fade-in duration-200">
              <Sparkles size={14} />
              Оба готовы
            </span>
          ) : activeMoment.status === 'USER_UPLOADED' ? (
            <span className="text-xs font-medium text-[#777277] dark:text-[#B8B2B5] animate-in fade-in duration-200">
              Ждём {couple.partner.name}
            </span>
          ) : null}
        </div>

        {/* Prompt Header */}
        <div className="mb-5 transition-all duration-200">
          {isCurrentMomentWaiting ? (
            <div className="space-y-1 animate-in fade-in duration-250 ease-out">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#343033] dark:text-white leading-snug">
                {activeMoment.prompt}
              </h2>
              <p className="text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6] pt-0.5">
                Следующее касание через {formatRemainingTime(availability.remainingCooldownMs)}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#343033] dark:text-white leading-snug">
                {activeMoment.prompt}
              </h2>
              {isCurrentMomentReady && (
                <p className="text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6] pt-0.5">
                  Новое касание готово 💗
                </p>
              )}
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-1 leading-relaxed">
                {activeMoment.status === 'COMPLETED'
                  ? `Сохранено сегодня в ${activeMoment.completedAt || '12:00'}`
                  : activeMoment.subtext}
              </p>
            </div>
          )}
        </div>

        {/* Photo Slots Section - Moment Duo (Max 2 photos per moment) */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-5">
          {isCurrentMomentWaiting ? (
            // Calm waiting placeholders during cooldown
            <div className="w-full py-6 px-4 rounded-[22px] bg-white/70 dark:bg-[#141214]/80 border border-[#EBE3E5] dark:border-[#242024] text-center space-y-2 shadow-2xs animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF0F2] dark:bg-[#201518] text-[#E98787] dark:text-[#F0B9C6] mx-auto flex items-center justify-center border border-[#EED7DC] dark:border-[#382329]">
                <Clock size={22} className="text-[#E98787] dark:text-[#F0B9C6]" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#343033] dark:text-white">
                  Пауза между касаниями
                </p>
                <p className="text-[11px] font-semibold text-[#E98787] dark:text-[#F0B9C6]">
                  через {formatRemainingTime(availability.remainingCooldownMs)}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* User Photo Slot */}
              <PhotoSlot
                type="user"
                title={couple.user.name}
                photoUrl={activeMoment.userPhoto}
                isRevealed={
                  activeMoment.status === 'REVEALED' ||
                  activeMoment.status === 'REACTED' ||
                  activeMoment.status === 'COMPLETED'
                }
                onAddPhoto={
                  !activeMoment.userPhoto
                    ? () => setIsPhotoPickerOpen(true)
                    : undefined
                }
                reaction={activeMoment.partnerReaction}
              />

              {/* Partner Photo Slot - STRICTLY NON-INTERACTIVE */}
              <PhotoSlot
                type="partner"
                title={couple.partner.name}
                photoUrl={activeMoment.partnerPhoto}
                isRevealed={
                  activeMoment.status === 'REVEALED' ||
                  activeMoment.status === 'REACTED' ||
                  activeMoment.status === 'COMPLETED'
                }
                isPartnerUploaded={Boolean(activeMoment.partnerPhoto)}
                reaction={activeMoment.userReaction}
              />
            </>
          )}
        </div>

        {/* State Machine Action Areas */}
        <div className="pt-2">
          {/* State 1: EMPTY (and not waiting) */}
          {activeMoment.status === 'EMPTY' && !isCurrentMomentWaiting && (
            <div className="animate-in fade-in duration-250 ease-out">
              <PrimaryButton
                variant="coral"
                onClick={() => setIsPhotoPickerOpen(true)}
              >
                <span>{isCurrentMomentReady ? 'Новое касание готово 💗' : 'Добавить фото'}</span>
              </PrimaryButton>
            </div>
          )}

          {/* State 2: USER_UPLOADED (waiting for partner) */}
          {activeMoment.status === 'USER_UPLOADED' && (
            <div className="rounded-[20px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] p-4 text-center space-y-1.5 shadow-2xs animate-in fade-in slide-in-from-bottom-2 duration-250 ease-out">
              <div className="w-9 h-9 rounded-full bg-[#FAF0F2] dark:bg-[#201518] text-[#E98787] dark:text-[#F0B9C6] mx-auto flex items-center justify-center border border-[#EED7DC] dark:border-[#382329]">
                <Clock size={16} />
              </div>
              <p className="text-xs font-semibold text-[#343033] dark:text-white">
                Твой снимок сохранён ✨
              </p>
              <p className="text-[11px] text-[#777277] dark:text-[#B8B2B5]">
                Ждём {couple.partner.name} · когда оба снимка будут готовы, момент откроется
              </p>
            </div>
          )}

          {/* State 3: BOTH_UPLOADED -> Trigger MATCH */}
          {activeMoment.status === 'BOTH_UPLOADED' && (
            <div className="space-y-2 animate-in fade-in zoom-in-[0.98] duration-250 ease-out">
              <PrimaryButton variant="coral" onClick={handleOpenMoment}>
                <Sparkles size={16} />
                <span>Открыть момент</span>
              </PrimaryButton>
              <p className="text-[11px] text-center text-[#777277] dark:text-[#B8B2B5]">
                Оба фото загружены и готовы к MATCH
              </p>
            </div>
          )}

          {/* State 4 & 5: REVEALED or REACTED */}
          {(activeMoment.status === 'REVEALED' || activeMoment.status === 'REACTED') && (
            <div className="space-y-4 pt-1 animate-in fade-in duration-300 ease-out">
              <ReactionPicker
                selectedReaction={activeMoment.userReaction}
                onSelectReaction={handleSelectReaction}
              />

              {activeMoment.userReaction && (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-200 ease-out">
                  <PrimaryButton variant="coral" onClick={handleSaveAndComplete}>
                    <span>Сохранить в историю</span>
                  </PrimaryButton>
                </div>
              )}
            </div>
          )}

          {/* State 6: COMPLETED */}
          {activeMoment.status === 'COMPLETED' && (
            <div className="pt-1 animate-in fade-in duration-300 ease-out">
              {availability.isAllCompleted ? (
                // State after 3rd moment: peaceful completion
                <div className="p-5 rounded-[22px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] text-center space-y-1.5 shadow-2xs">
                  <div className="w-10 h-10 rounded-full bg-[#FAF0ED] dark:bg-[#201518] text-[#E98787] dark:text-[#F0B9C6] mx-auto flex items-center justify-center">
                    <Heart size={20} className="fill-[#E98787] dark:fill-[#F0B9C6]" />
                  </div>
                  <p className="font-display text-sm font-bold text-[#343033] dark:text-white">
                    На сегодня всё 💗
                  </p>
                  <p className="text-xs text-[#777277] dark:text-[#B8B2B5]">
                    Завтра будет новое касание.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#777277] dark:text-[#B8B2B5] px-1">
                    <span className="font-medium text-[#2B7348] dark:text-[#52B778] flex items-center gap-1">
                      <Check size={13} /> Касание сохранено
                    </span>
                    <span>{activeMoment.order} из 3</span>
                  </div>

                  {availability.isWaitingForNext ? (
                    <div className="rounded-[18px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] p-3 text-center shadow-2xs">
                      <p className="text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6]">
                        Следующее касание через {formatRemainingTime(availability.remainingCooldownMs)}
                      </p>
                    </div>
                  ) : availability.isNextMomentReady && availability.nextOrder ? (
                    <PrimaryButton
                      variant="peach"
                      onClick={() => {
                        const next = moments.find((m) => m.order === availability.nextOrder);
                        if (next) onSelectActiveMoment(next.id);
                      }}
                    >
                      <span>Новое касание готово 💗</span>
                    </PrimaryButton>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </PastelCard>

      {/* Тонкая широкая кнопка «Наше небо» под блоком касания */}
      {onOpenStreak && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic(hapticEnabled);
            playSoftChime('tap', soundEnabled);
            onOpenStreak();
          }}
          className="w-full py-3 px-6 rounded-[18px] bg-white/80 dark:bg-[#141214]/80 hover:bg-white dark:hover:bg-[#1C181A] active:scale-[0.99] border border-[#EBE3E5] dark:border-[#242024] text-center text-xs font-medium text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-all duration-150 cursor-pointer shadow-2xs flex items-center justify-center gap-2"
          title="Открыть Наше небо"
        >
          <Sparkles size={14} className="text-[#E98787] dark:text-[#F0B9C6] shrink-0" />
          <span>Наше небо</span>
        </button>
      )}

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        isOpen={isPhotoPickerOpen}
        onClose={() => setIsPhotoPickerOpen(false)}
        onSelectPhoto={handlePhotoSelected}
        title="Добавить фото"
        subtitle="Снимок для вашего общего момента"
      />

      {/* MATCH Animation Overlay */}
      {isMatching && <MatchAnimation onComplete={handleMatchComplete} />}
    </div>
  );
};
