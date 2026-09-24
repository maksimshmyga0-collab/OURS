import React, { useState, useEffect, useMemo } from 'react';
import { Moment, CoupleState, ReactionEmoji } from '../types';
import { PastelCard, PastelCardColor } from '../components/PastelCard';
import { PhotoSlot } from '../components/PhotoSlot';
import { ReactionPicker } from '../components/ReactionPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressDots } from '../components/ProgressDots';
import { MatchAnimation } from '../components/MatchAnimation';
import { PhotoPickerModal } from '../components/PhotoPickerModal';
import { playSoftChime, triggerHaptic } from '../services/feedback';
import { Check, Sparkles, ChevronRight, Lock, Flame, Clock, Heart } from 'lucide-react';
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
  const [photoPickerTarget, setPhotoPickerTarget] = useState<'user' | 'partner' | null>(null);
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

  // Determine active moment
  const activeMoment =
    moments.find((m) => m.id === activeMomentId) ||
    (availability.nextOrder
      ? moments.find((m) => m.order === availability.nextOrder)
      : null) ||
    moments[0];

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

  // Handle photo selection for user or partner
  const handlePhotoSelected = (photoUrl: string) => {
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);

    const isPartner = photoPickerTarget === 'partner';
    const nowIso = new Date().toISOString();

    if (isPartner) {
      const userPhotoItem: MomentPhoto[] = activeMoment.userPhoto
        ? [
            {
              userId: couple.user.id || 'user-a-default',
              imageUrl: activeMoment.userPhoto,
              createdAt: nowIso,
            },
          ]
        : [];
      const partnerPhotoItem: MomentPhoto = {
        userId: couple.partner.id || 'user-b-default',
        imageUrl: photoUrl,
        createdAt: nowIso,
      };

      const newPhotos = [...userPhotoItem, partnerPhotoItem];
      const newStatus = activeMoment.userPhoto ? 'BOTH_UPLOADED' : 'EMPTY';

      onUpdateMoment({
        ...activeMoment,
        partnerPhoto: photoUrl,
        photos: newPhotos,
        status: newStatus,
      });
    } else {
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
    }

    setPhotoPickerTarget(null);
  };

  // Trigger Match animation when both uploaded
  const handleOpenMoment = () => {
    triggerHaptic(hapticEnabled);
    playSoftChime('match', soundEnabled);
    setIsMatching(true);
  };

  // When match animation completes -> REVEALED
  const handleMatchComplete = () => {
    setIsMatching(false);
    onUpdateMoment({
      ...activeMoment,
      status: 'REVEALED',
    });
  };

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
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-[#343033]">
              Сегодня
            </h1>
            {streakInfo && (
              <button
                type="button"
                onClick={onOpenStreak}
                className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-white/85 border border-[#EBE3E5] text-xs font-semibold text-[#343033] hover:bg-white transition-all duration-200 ease-out cursor-pointer shadow-2xs"
                title="Ваша серия и нить"
              >
                <Flame size={13} className="text-[#E2765A] fill-[#E2765A]/25" />
                <span>
                  {streakInfo.currentStreak > 0
                    ? `${streakInfo.currentStreak} ${
                        streakInfo.currentStreak === 1
                          ? 'день'
                          : streakInfo.currentStreak < 5
                          ? 'дня'
                          : 'дней'
                      }`
                    : 'Серия'}
                </span>
              </button>
            )}
          </div>
          <p className="text-xs text-[#777277] mt-0.5">
            {availability.completedCount} из 3 моментов
          </p>
        </div>
        <ProgressDots
          total={3}
          completed={availability.completedCount}
          activeOrder={activeMoment.order}
        />
      </div>

      {/* Main Active Daily Moment Card */}
      <PastelCard
        color={getThemeCardColor(activeMoment)}
        className="relative overflow-hidden transition-all duration-300 ease-out"
      >
        {/* Card Header info */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold tracking-wider text-[#777277] uppercase transition-colors duration-200">
            {isCurrentMomentWaiting
              ? `${activeMoment.label} · ОЖИДАНИЕ`
              : activeMoment.label}
          </span>

          {activeMoment.status === 'COMPLETED' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2B7348] animate-in fade-in duration-200">
              <Check size={14} />
              Сохранён
            </span>
          ) : isCurrentMomentWaiting ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/90 border border-[#EED7DC] text-[11px] font-semibold text-[#E2765A] animate-in fade-in duration-200">
              <Clock size={12} />
              Следующий скоро
            </span>
          ) : isCurrentMomentReady ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E98787] animate-in fade-in duration-200">
              <Sparkles size={13} />
              Готов
            </span>
          ) : activeMoment.status === 'BOTH_UPLOADED' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E98787] animate-in fade-in duration-200">
              <Sparkles size={14} />
              Оба готовы
            </span>
          ) : activeMoment.status === 'USER_UPLOADED' ? (
            <span className="text-xs font-medium text-[#777277] animate-in fade-in duration-200">
              Ждём второй взгляд
            </span>
          ) : null}
        </div>

        {/* Prompt Header */}
        <div className="mb-5 transition-all duration-200">
          {isCurrentMomentWaiting ? (
            <div className="space-y-1 animate-in fade-in duration-250 ease-out">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#343033] leading-snug">
                Следующий момент скоро
              </h2>
              <p className="text-xs font-semibold text-[#E98787] pt-0.5">
                Следующий момент появится через {formatRemainingTime(availability.remainingCooldownMs)}
              </p>
              <p className="text-xs text-[#777277] pt-0.5 leading-relaxed">
                OURS даёт время прожить день вместе offline, не торопясь 🌿
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-[#343033] leading-snug">
                {activeMoment.prompt}
              </h2>
              {isCurrentMomentReady && (
                <p className="text-xs font-semibold text-[#E98787] pt-0.5">
                  Новый момент готов 💗
                </p>
              )}
              <p className="text-xs text-[#777277] mt-1 leading-relaxed">
                {activeMoment.status === 'COMPLETED'
                  ? `Открыто сегодня в ${activeMoment.completedAt || '12:00'}`
                  : activeMoment.subtext}
              </p>
            </div>
          )}
        </div>

        {/* Photo Slots Section - Moment Duo (Max 2 photos per moment) */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-5">
          {isCurrentMomentWaiting ? (
            // Calm waiting placeholders during cooldown
            <div className="w-full py-6 px-4 rounded-[22px] bg-white/70 border border-[#EBE3E5] text-center space-y-2.5 shadow-2xs animate-in fade-in duration-300">
              <div className="w-12 h-12 rounded-2xl bg-[#FAF0F2] text-[#E98787] mx-auto flex items-center justify-center border border-[#EED7DC]">
                <Clock size={22} className="text-[#E98787]" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[#343033]">
                  Пауза между моментами
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0F2] text-[#E98787] text-xs font-bold border border-[#EED7DC]">
                  <Clock size={13} />
                  <span>{formatRemainingTime(availability.remainingCooldownMs)}</span>
                </div>
                <p className="text-[11px] text-[#777277] pt-1">
                  Следующий момент откроется примерно через 4 часа после предыдущего
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
                    ? () => setPhotoPickerTarget('user')
                    : undefined
                }
                reaction={activeMoment.partnerReaction}
              />

              {/* Partner Photo Slot */}
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
                onAddPhoto={
                  !activeMoment.partnerPhoto
                    ? () => setPhotoPickerTarget('partner')
                    : undefined
                }
                reaction={activeMoment.userReaction}
              />
            </>
          )}
        </div>

        {/* State Machine Action Areas */}
        <div className="pt-2">
          {/* State: Waiting Cooldown */}
          {isCurrentMomentWaiting && (
            <div className="rounded-[20px] bg-white border border-[#EBE3E5] p-3 text-center shadow-2xs animate-in fade-in duration-200">
              <p className="text-xs text-[#777277]">
                Следующий момент появится через{' '}
                <span className="font-semibold text-[#E98787]">
                  {formatRemainingTime(availability.remainingCooldownMs)}
                </span>
              </p>
            </div>
          )}

          {/* State 1: EMPTY (and not waiting) */}
          {activeMoment.status === 'EMPTY' && !isCurrentMomentWaiting && (
            <div className="animate-in fade-in duration-250 ease-out">
              <PrimaryButton
                variant="coral"
                onClick={() => setPhotoPickerTarget('user')}
              >
                <span>{isCurrentMomentReady ? 'Новый момент готов 💗' : 'Добавить фото'}</span>
              </PrimaryButton>
            </div>
          )}

          {/* State 2: USER_UPLOADED (waiting for partner) */}
          {activeMoment.status === 'USER_UPLOADED' && (
            <div className="rounded-[20px] bg-white border border-[#EBE3E5] p-4 text-center space-y-3 shadow-2xs animate-in fade-in slide-in-from-bottom-2 duration-250 ease-out">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#343033]">
                  Твой снимок готов ✨
                </p>
                <p className="text-[11px] text-[#777277]">
                  Добавьте взгляд {couple.partner.name}, чтобы открыть этот совместный момент
                </p>
              </div>
              <PrimaryButton
                variant="peach"
                onClick={() => setPhotoPickerTarget('partner')}
              >
                <span>Добавить взгляд {couple.partner.name}</span>
              </PrimaryButton>
            </div>
          )}

          {/* State 3: BOTH_UPLOADED -> Trigger MATCH */}
          {activeMoment.status === 'BOTH_UPLOADED' && (
            <div className="space-y-2 animate-in fade-in zoom-in-[0.98] duration-250 ease-out">
              <PrimaryButton variant="coral" onClick={handleOpenMoment}>
                <Sparkles size={16} />
                <span>Открыть момент</span>
              </PrimaryButton>
              <p className="text-[11px] text-center text-[#777277]">
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
                <div className="p-5 rounded-[22px] bg-white border border-[#EBE3E5] text-center space-y-1.5 shadow-2xs">
                  <div className="w-10 h-10 rounded-full bg-[#FAF0ED] text-[#E98787] mx-auto flex items-center justify-center">
                    <Heart size={20} className="fill-[#E98787]" />
                  </div>
                  <p className="font-display text-sm font-bold text-[#343033]">
                    На сегодня всё 💗
                  </p>
                  <p className="text-xs text-[#777277]">
                    Завтра будет новый момент.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#777277] px-1">
                    <span className="font-medium text-[#2B7348] flex items-center gap-1">
                      <Check size={13} /> Момент сохранён
                    </span>
                    <span>{activeMoment.order} из 3</span>
                  </div>

                  {availability.isWaitingForNext ? (
                    <div className="rounded-[18px] bg-white border border-[#EBE3E5] p-3.5 text-center space-y-1 shadow-2xs">
                      <p className="text-xs font-bold text-[#343033]">
                        Следующий момент скоро
                      </p>
                      <p className="text-xs font-semibold text-[#E98787]">
                        Следующий момент появится через {formatRemainingTime(availability.remainingCooldownMs)}
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
                      <span>Новый момент готов 💗</span>
                    </PrimaryButton>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </PastelCard>

      {/* Moments of Today (3 moments maximum per calendar day) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold tracking-wider text-[#777277] uppercase">
            Моменты сегодняшнего дня
          </h3>
          <span className="text-[11px] text-[#777277]">
            {availability.completedCount} из 3 завершено
          </span>
        </div>

        <div className="space-y-2">
          {moments.slice(0, 3).map((m) => {
            const isCurrent = m.id === activeMoment.id;
            const isDone = m.status === 'COMPLETED';
            const isWaiting =
              m.order === availability.nextOrder &&
              m.status === 'EMPTY' &&
              availability.isWaitingForNext;
            const isReady =
              m.order === availability.nextOrder &&
              m.status === 'EMPTY' &&
              availability.isNextMomentReady;
            const isLocked =
              !isDone &&
              m.order > (availability.nextOrder || 3);

            return (
              <div
                key={m.id}
                onClick={() => {
                  if (!isLocked) {
                    onSelectActiveMoment(m.id);
                  }
                }}
                className={`p-3.5 sm:p-4 rounded-[20px] transition-all duration-200 ease-out flex items-center justify-between gap-3 ${
                  isLocked
                    ? 'opacity-40 cursor-not-allowed bg-white/40 border border-[#EBE3E5]'
                    : 'cursor-pointer active:scale-[0.99]'
                } ${
                  isCurrent
                    ? 'bg-white border border-[#E98787] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_4px_16px_-4px_rgba(233,135,135,0.18)]'
                    : 'bg-white/85 border border-[#EBE3E5] hover:bg-white text-[#777277] shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 transition-colors duration-200 ${
                      isDone
                        ? 'bg-[#FAF0ED] text-[#E98787]'
                        : isCurrent
                        ? 'bg-[#FAF0F2] text-[#343033]'
                        : isWaiting
                        ? 'bg-[#FDF6F0] text-[#E2765A]'
                        : 'bg-[#F2ECEE] text-[#777277]'
                    }`}
                  >
                    {isDone ? (
                      <Check size={14} />
                    ) : isWaiting ? (
                      <Clock size={13} />
                    ) : isLocked ? (
                      <Lock size={12} />
                    ) : (
                      m.order
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={`text-xs font-medium truncate ${
                        isCurrent ? 'text-[#343033] font-semibold' : 'text-[#777277]'
                      }`}
                    >
                      {m.prompt}
                    </p>
                    <span className="text-[10px] text-[#777277]">
                      {isDone
                        ? 'Завершён ✓'
                        : isWaiting
                        ? `Откроется через ${formatRemainingTime(availability.remainingCooldownMs)}`
                        : isReady
                        ? 'Новый момент готов 💗'
                        : m.status === 'BOTH_UPLOADED'
                        ? 'Оба готовы к открытию'
                        : m.status === 'USER_UPLOADED'
                        ? 'Ожидание партнёра'
                        : isCurrent
                        ? 'Текущий момент'
                        : 'Заблокирован'}
                    </span>
                  </div>
                </div>

                <div className="shrink-0">
                  {isLocked ? (
                    <Lock size={14} className="text-[#CEC5C8]" />
                  ) : (
                    <ChevronRight
                      size={16}
                      className={isCurrent ? 'text-[#E98787]' : 'text-[#CEC5C8]'}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Photo Picker Modal */}
      <PhotoPickerModal
        isOpen={Boolean(photoPickerTarget)}
        onClose={() => setPhotoPickerTarget(null)}
        onSelectPhoto={handlePhotoSelected}
        title={photoPickerTarget === 'partner' ? 'Добавь свой взгляд' : 'Добавить фото'}
        subtitle={
          photoPickerTarget === 'partner'
            ? `Второй снимок от ${couple.partner.name}`
            : 'Снимок для вашего общего момента'
        }
      />

      {/* MATCH Animation Overlay */}
      {isMatching && <MatchAnimation onComplete={handleMatchComplete} />}
    </div>
  );
};
