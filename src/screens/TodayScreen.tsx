import React, { useState } from 'react';
import { Moment, CoupleState, ReactionEmoji } from '../types';
import { PastelCard, PastelCardColor } from '../components/PastelCard';
import { PhotoSlot } from '../components/PhotoSlot';
import { ReactionPicker } from '../components/ReactionPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressDots } from '../components/ProgressDots';
import { MatchAnimation } from '../components/MatchAnimation';
import { PhotoPickerModal } from '../components/PhotoPickerModal';
import { playSoftChime, triggerHaptic } from '../services/feedback';
import { PARTNER_SAMPLE_PHOTOS } from '../services/samplePhotos';
import { Check, Sparkles, ChevronRight, Lock, Flame } from 'lucide-react';
import { CoupleStreakInfo, MomentPhoto } from '../types';

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


  // Active moment & sequential progression logic
  const completedCount = moments.filter((m) => m.status === 'COMPLETED').length;
  // Sequential unlock logic:
  // 0 completed -> show Moment 1 only
  // 1 completed -> show Moment 1, Moment 2
  // 2 completed -> show Moment 1, Moment 2, Moment 3
  // 3 completed -> all 3 moments completed, no more slots
  const maxVisibleOrder = Math.min(3, Math.max(1, completedCount + 1));
  const visibleMoments = moments
    .filter((m) => m.order <= maxVisibleOrder)
    .sort((a, b) => a.order - b.order);

  // Active moment: ensure active moment is within visible moments
  const activeMoment =
    visibleMoments.find((m) => m.id === activeMomentId) ||
    visibleMoments[visibleMoments.length - 1] ||
    moments[0];
  const isAllCompleted = completedCount === 3;

  if (!activeMoment) {
    return null;
  }


  // Handle photo selection for user or partner
  const handlePhotoSelected = (photoUrl: string) => {
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);

    const isPartner = photoPickerTarget === 'partner';
    const nowIso = new Date().toISOString();

    if (isPartner) {
      // Partner photo uploaded
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
      // User photo uploaded
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
      // If partner doesn't have reaction yet, give a realistic partner reaction
      partnerReaction: activeMoment.partnerReaction || '❤️',
      status: 'REACTED',
    });
  };

  // Complete moment & advance
  const handleSaveAndComplete = () => {
    triggerHaptic(hapticEnabled);
    playSoftChime('success', soundEnabled);

    const updated: Moment = {
      ...activeMoment,
      status: 'COMPLETED',
      completedAt: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    onUpdateMoment(updated);

    // If next moment exists and not completed, automatically advance
    const nextMoment = moments.find((m) => m.order === activeMoment.order + 1);
    if (nextMoment) {
      onSelectActiveMoment(nextMoment.id);
    }
  };

  const getThemeCardColor = (_moment: Moment): PastelCardColor => {
    // The main card uses a warm neutral, milky-sand physical photo card aesthetic
    // free of cool blue tones, letting the couple photos be the primary focus
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
                className="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-white/85 border border-[#EBE3E5] text-xs font-semibold text-[#343033] hover:bg-white transition-all cursor-pointer shadow-2xs"
                title="Ваша серия и нить"
              >
                <Flame size={13} className="text-[#E2765A] fill-[#E2765A]/25" />
                <span>
                  {streakInfo.currentStreak > 0
                    ? `${streakInfo.currentStreak} ${streakInfo.currentStreak === 1 ? 'день' : streakInfo.currentStreak < 5 ? 'дня' : 'дней'}`
                    : 'Серия'}
                </span>
              </button>
            )}
          </div>
          <p className="text-xs text-[#777277] mt-0.5">
            {completedCount} из 3 моментов
          </p>
        </div>
        <ProgressDots
          total={3}
          completed={completedCount}
          activeOrder={activeMoment.order}
        />
      </div>

      {/* Main Active Daily Moment Card */}
      <PastelCard color={getThemeCardColor(activeMoment)} className="relative overflow-hidden">
        {/* Card Header info */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold tracking-wider text-[#777277] uppercase">
            {activeMoment.label}
          </span>
          {activeMoment.status === 'COMPLETED' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E98787]">
              <Check size={14} />
              Сохранён
            </span>
          ) : activeMoment.status === 'BOTH_UPLOADED' ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#E98787] animate-pulse">
              <Sparkles size={14} />
              Оба готовы
            </span>
          ) : activeMoment.status === 'USER_UPLOADED' ? (
            <span className="text-xs font-medium text-[#777277]">
              Ждём второй взгляд
            </span>
          ) : null}
        </div>

        {/* Prompt */}
        <div className="mb-5">
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#343033] leading-snug">
            {activeMoment.prompt}
          </h2>
          <p className="text-xs text-[#777277] mt-1.5 leading-relaxed">
            {activeMoment.status === 'COMPLETED'
              ? `Открыто сегодня в ${activeMoment.completedAt || '12:00'}`
              : activeMoment.subtext}
          </p>
        </div>

        {/* Photo Slots Section - Moment Duo (Max 2 photos per moment) */}
        <div className="flex items-center justify-center gap-3 sm:gap-4 mb-5">
          {/* User Photo Slot */}
          <PhotoSlot
            type="user"
            title={couple.user.name}
            photoUrl={activeMoment.userPhoto}
            isRevealed={activeMoment.status === 'REVEALED' || activeMoment.status === 'REACTED' || activeMoment.status === 'COMPLETED'}
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
            isRevealed={activeMoment.status === 'REVEALED' || activeMoment.status === 'REACTED' || activeMoment.status === 'COMPLETED'}
            isPartnerUploaded={Boolean(activeMoment.partnerPhoto)}
            onAddPhoto={
              !activeMoment.partnerPhoto
                ? () => setPhotoPickerTarget('partner')
                : undefined
            }
            reaction={activeMoment.userReaction}
          />
        </div>

        {/* State Machine Action Areas */}
        <div className="pt-2">
          {/* State 1: EMPTY */}
          {activeMoment.status === 'EMPTY' && (
            <PrimaryButton
              variant="coral"
              onClick={() => setPhotoPickerTarget('user')}
            >
              <span>Добавить фото</span>
            </PrimaryButton>
          )}

          {/* State 2: USER_UPLOADED (waiting for partner or add partner view) */}
          {activeMoment.status === 'USER_UPLOADED' && (
            <div className="rounded-[20px] bg-white border border-[#EBE3E5] p-4 text-center space-y-3 shadow-2xs">
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
            <div className="space-y-2">
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
            <div className="space-y-4 pt-1">
              <ReactionPicker
                selectedReaction={activeMoment.userReaction}
                onSelectReaction={handleSelectReaction}
              />

              {activeMoment.userReaction && (
                <PrimaryButton variant="coral" onClick={handleSaveAndComplete}>
                  <span>Сохранить в историю</span>
                </PrimaryButton>
              )}
            </div>
          )}

          {/* State 6: COMPLETED */}
          {activeMoment.status === 'COMPLETED' && (
            <div className="pt-1">
              {isAllCompleted ? (
                <div className="p-4 rounded-[20px] bg-white border border-[#EBE3E5] text-center space-y-1 shadow-2xs">
                  <p className="font-display text-sm font-bold text-[#343033]">
                    Сегодня всё.
                  </p>
                  <p className="text-xs text-[#E98787]">
                    До завтра 💗
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-[#777277] px-1">
                    <span>Момент сохранён</span>
                    <span>{activeMoment.order} / 3</span>
                  </div>
                  {activeMoment.order < 3 && (
                    <PrimaryButton
                      variant="peach"
                      onClick={() => {
                        const next = moments.find((m) => m.order === activeMoment.order + 1);
                        if (next) onSelectActiveMoment(next.id);
                      }}
                    >
                      <span>Следующий момент</span>
                    </PrimaryButton>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </PastelCard>

      {/* Moments of Today (Sequential unlock: 0 done -> 1, 1 done -> 1+2, 2 done -> 1+2+3) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-bold tracking-wider text-[#777277] uppercase">
            Моменты сегодняшнего дня
          </h3>
          <span className="text-[11px] text-[#777277]">
            {visibleMoments.length} из 3 доступно
          </span>
        </div>

        <div className="space-y-2">
          {visibleMoments.map((m) => {
            const isCurrent = m.id === activeMoment.id;
            const isDone = m.status === 'COMPLETED';

            return (
              <div
                key={m.id}
                onClick={() => onSelectActiveMoment(m.id)}
                className={`p-3.5 sm:p-4 rounded-[20px] transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99] ${
                  isCurrent
                    ? 'bg-white border border-[#E98787] shadow-[0_1px_3px_rgba(52,48,51,0.02),0_4px_16px_-4px_rgba(233,135,135,0.18)]'
                    : 'bg-white/85 border border-[#EBE3E5] hover:bg-white text-[#777277] shadow-2xs'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                      isDone
                        ? 'bg-[#FAF0ED] text-[#E98787]'
                        : isCurrent
                        ? 'bg-[#FAF0F2] text-[#343033]'
                        : 'bg-[#F2ECEE] text-[#777277]'
                    }`}
                  >
                    {isDone ? <Check size={14} /> : m.order}
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
                        : m.status === 'BOTH_UPLOADED'
                        ? 'Оба готовы к открытию'
                        : m.status === 'USER_UPLOADED'
                        ? 'Ожидание партнёра'
                        : isCurrent
                        ? 'Текущий момент'
                        : 'Ещё не начат'}
                    </span>
                  </div>
                </div>

                <ChevronRight
                  size={16}
                  className={isCurrent ? 'text-[#E98787]' : 'text-[#CEC5C8]'}
                />
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
