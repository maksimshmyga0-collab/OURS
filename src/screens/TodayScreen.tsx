import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Moment, CoupleState, ReactionEmoji } from '../types';
import { PastelCard, PastelCardColor } from '../components/PastelCard';
import { PhotoSlot } from '../components/PhotoSlot';
import { ReactionPicker } from '../components/ReactionPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressDots } from '../components/ProgressDots';
import { MatchAnimation } from '../components/MatchAnimation';
import { PhotoPickerModal } from '../components/PhotoPickerModal';
import { FullscreenPhotoViewer } from '../components/FullscreenPhotoViewer';
import { playSoftChime, triggerHaptic } from '../services/feedback';
import { Check, Sparkles, Clock, Heart, Bell } from 'lucide-react';
import { CoupleStreakInfo, MomentPhoto } from '../types';
import {
  calculateMomentAvailability,
  formatRemainingTime,
  getSynchronizedNow,
  isMomentMatchCompleted,
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
  const [matchRevealedEarly, setMatchRevealedEarly] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; title: string } | null>(null);
  const [momentTransition, setMomentTransition] = useState<'idle' | 'exiting' | 'entering'>('idle');
  const [isReminderSent, setIsReminderSent] = useState(false);
  // Temporary state for testing MatchAnimation without modifying database or moments
  const [isTestMatchRunning, setIsTestMatchRunning] = useState(false);

  // Live timer for live countdown calculation with server time synchronization
  const [now, setNow] = useState<number>(() => getSynchronizedNow());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(getSynchronizedNow());
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
    !activeMoment.partnerPhoto &&
    availability.isWaitingForNext;

  const isCurrentMomentReady =
    activeMoment.order === availability.nextOrder &&
    activeMoment.status === 'EMPTY' &&
    availability.isNextMomentReady;

  const isPartnerUploadedOnly = Boolean(
    activeMoment.partnerPhoto && !activeMoment.userPhoto
  );

  // Set of moment IDs that have already played or completed Match animation on this device
  const handledMatchMomentsRef = useRef<Set<string>>(new Set());

  // On mount / initial load: seed all moments that are already opened so we NEVER replay on app restart
  useEffect(() => {
    moments.forEach((m) => {
      if (
        m.status === 'REVEALED' ||
        m.status === 'REACTED' ||
        m.status === 'COMPLETED'
      ) {
        handledMatchMomentsRef.current.add(m.id);
      }
    });
  }, []);

  // Automatic bidirectional Match trigger:
  // Fires when both photos are present and the moment hasn't played Match on this device yet during this session
  useEffect(() => {
    const hasBoth = Boolean(activeMoment.userPhoto && activeMoment.partnerPhoto);

    // If already marked as handled on this device, do nothing
    if (handledMatchMomentsRef.current.has(activeMoment.id)) {
      return;
    }

    // When both photos are available: trigger Match animation automatically!
    if (hasBoth && !isMatching) {
      handledMatchMomentsRef.current.add(activeMoment.id);
      setIsMatching(true);
    }
  }, [
    activeMoment.id,
    activeMoment.userPhoto,
    activeMoment.partnerPhoto,
    activeMoment.status,
    isMatching,
  ]);

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

  // Keep activeMoment in a ref to always have latest state for async callbacks
  const activeMomentRef = useRef(activeMoment);
  activeMomentRef.current = activeMoment;

  // Manual fallback trigger for Match animation when both uploaded
  const handleOpenMoment = () => {
    if (activeMoment.status !== 'BOTH_UPLOADED' || isMatching) return;
    if (handledMatchMomentsRef.current.has(activeMoment.id)) return;
    handledMatchMomentsRef.current.add(activeMoment.id);
    setIsMatching(true);
  };

  // Phase 4 trigger: when connecting elements meet in the center (720ms), initiate smooth reveal
  const handleMatchConnection = useCallback(() => {
    setMatchRevealedEarly(true);
  }, []);

  // When match animation completes (1100ms) -> commit REVEALED status safely
  const handleMatchComplete = useCallback(() => {
    setIsMatching(false);
    setMatchRevealedEarly(false);
    onUpdateMoment({
      ...activeMomentRef.current,
      status: 'REVEALED',
    });
  }, [onUpdateMoment]);

  // Unified moment reveal state (starts at Phase 4/5 of Match animation or if already revealed/reacted/completed)
  const isMomentRevealed =
    matchRevealedEarly ||
    activeMoment.status === 'REVEALED' ||
    activeMoment.status === 'REACTED' ||
    activeMoment.status === 'COMPLETED';


  // Friendly partner reminder with micro-interaction feedback
  const handleSendReminder = () => {
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);
    setIsReminderSent(true);
    setTimeout(() => {
      setIsReminderSent(false);
    }, 3000);
  };

  // Handle reaction on partner photo with the requested 4-step motion choreography:
  // Step 1: Button press animation (ReactionPicker)
  // Step 2: Selected reaction becomes active (~260ms)
  // Step 3: Current match-moment softly exits (320ms: opacity 1 -> 0, scale 1 -> 0.98, translateY 0 -> -5px)
  // Step 4: Next moment softly enters (380ms: opacity 0 -> 1, scale 0.98 -> 1, translateY 6px -> 0)
  const handleSelectReaction = (emoji: ReactionEmoji) => {
    triggerHaptic(hapticEnabled);
    playSoftChime('react', soundEnabled);

    // Step 2: Mark reaction immediately so button highlights
    const matchTs = activeMoment.completedTimestamp || getSynchronizedNow();
    const updated: Moment = {
      ...activeMoment,
      userReaction: emoji,
      partnerReaction: activeMoment.partnerReaction || '❤️',
      status: 'REACTED',
      completedTimestamp: matchTs,
      completedAt: new Date(matchTs).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    onUpdateMoment(updated);

    // After 280ms of reaction confirmation, smoothly transition moment out
    setTimeout(() => {
      setMomentTransition('exiting');

      setTimeout(() => {
        // Step 3 -> 4: Complete the moment and smoothly reveal the next moment
        onUpdateMoment({
          ...updated,
          status: 'COMPLETED',
        });

        const nextMoment = moments.find((m) => m.order === activeMoment.order + 1);
        if (nextMoment) {
          onSelectActiveMoment(nextMoment.id);
        }

        setMomentTransition('entering');
        setTimeout(() => {
          setMomentTransition('idle');
        }, 380);
      }, 320);
    }, 280);
  };

  // Complete moment & advance timestamp preserving shared server match timestamp
  const handleSaveAndComplete = () => {
    triggerHaptic(hapticEnabled);
    playSoftChime('success', soundEnabled);

    setMomentTransition('exiting');
    setTimeout(() => {
      const matchTs = activeMoment.completedTimestamp || getSynchronizedNow();
      const updated: Moment = {
        ...activeMoment,
        status: 'COMPLETED',
        completedTimestamp: matchTs,
        completedAt: new Date(matchTs).toLocaleTimeString('ru-RU', {
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

      setMomentTransition('entering');
      setTimeout(() => {
        setMomentTransition('idle');
      }, 380);
    }, 320);
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
            <h1 className="font-display text-2xl font-bold text-[#343033] dark:text-white">
              Сегодня
            </h1>
            {/* Temporary dev trigger to test MatchAnimation visually without modifying database/moments */}
            <button
              type="button"
              onClick={() => {
                setIsTestMatchRunning(true);
              }}
              className="text-[10px] font-semibold tracking-wide uppercase px-2.5 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#1E1417] text-[#E98787] dark:text-[#F0B9C6] border border-[#F0B9C6]/60 dark:border-[#F0B9C6]/40 hover:bg-[#FCE7EC] dark:hover:bg-[#2A1B20] active:scale-95 transition-all cursor-pointer select-none"
              title="Тестирование Match-анимации"
            >
              Test Match
            </button>
          </div>
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

      {/* Main Single Active Daily Moment Card with soft exit and enter transitions */}
      <div
        className={
          momentTransition === 'exiting'
            ? 'animate-moment-exit'
            : momentTransition === 'entering'
            ? 'animate-moment-enter'
            : ''
        }
      >
        <PastelCard
          key={activeMoment.id}
          color={getThemeCardColor(activeMoment)}
          className="relative overflow-hidden transition-all duration-300 ease-out animate-card-enter"
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
            <span className="text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6] flex items-center gap-1 animate-in fade-in duration-200">
              <Check size={13} />
              Фото отправлено · Ждём {couple.partner.name}
            </span>
          ) : isPartnerUploadedOnly ? (
            <span className="text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6] flex items-center gap-1 animate-in fade-in duration-200">
              <Check size={13} />
              {couple.partner.name} загрузил(а) фото · Ваш черёд
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
                <p className="font-display text-sm sm:text-[15px] font-bold text-[#343033] dark:text-white pt-1 tracking-tight animate-in fade-in duration-200">
                  Новое касание готово
                </p>
              )}
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-1 leading-relaxed">
                {activeMoment.status === 'COMPLETED'
                  ? `Сохранено сегодня в ${activeMoment.completedAt || '12:00'}`
                  : isPartnerUploadedOnly
                  ? `${couple.partner.name} уже отправил(а) фото · Добавьте своё, чтобы произошёл MATCH ✨`
                  : activeMoment.subtext}
              </p>
            </div>
          )}
        </div>

        {/* Photo Slots Section - Moment Duo (Max 2 photos per moment) */}
        <div className="relative grid grid-cols-2 items-start gap-3 sm:gap-4 mb-5">

          {isCurrentMomentWaiting ? (
            // Calm waiting placeholders during cooldown
            <div className="col-span-2 w-full py-6 px-4 rounded-[22px] bg-white/70 dark:bg-[#141214]/80 border border-[#EBE3E5] dark:border-[#242024] text-center space-y-2 shadow-2xs animate-in fade-in duration-300">
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
                isRevealed={isMomentRevealed}
                onPhotoSelected={handlePhotoSelected}
                onOpenFullscreen={(url, title) => setFullscreenPhoto({ url, title: title || 'Твоё фото' })}
                reaction={activeMoment.partnerReaction}
              />

              {/* Partner Photo Slot - STRICTLY NON-INTERACTIVE WHEN HIDDEN */}
              <PhotoSlot
                type="partner"
                title={couple.partner.name}
                photoUrl={activeMoment.partnerPhoto}
                isRevealed={isMomentRevealed}
                isPartnerUploaded={Boolean(activeMoment.partnerPhoto)}
                onOpenFullscreen={(url, title) => setFullscreenPhoto({ url, title: title || couple.partner.name })}
                reaction={activeMoment.userReaction}
              />
            </>
          )}
        </div>

        {/* State Machine Action Areas */}
        <div className="pt-2">
          {/* While matching animation is in progress */}
          {isMatching && (
            <div className="rounded-[20px] bg-white/80 dark:bg-[#141214]/80 border border-[#F0B9C6]/60 dark:border-[#382329] p-3.5 text-center space-y-1 shadow-2xs animate-in fade-in duration-200">
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6]">
                <Sparkles size={14} className="animate-spin" />
                <span>Соединяем ваши кадры...</span>
              </div>
            </div>
          )}

          {/* State 1: EMPTY or waiting for user's photo (and not in cooldown or matching) */}
          {!activeMoment.userPhoto &&
            !isMatching &&
            activeMoment.status !== 'COMPLETED' &&
            activeMoment.status !== 'REVEALED' &&
            activeMoment.status !== 'REACTED' &&
            !isCurrentMomentWaiting && (
              <div className="space-y-1.5 animate-in fade-in duration-250 ease-out">
                <PrimaryButton
                  variant="coral"
                  onClick={() => setIsPhotoPickerOpen(true)}
                >
                  <span className="font-display font-bold text-[15px] sm:text-base tracking-tight text-[#FFFFFF]">
                    {isPartnerUploadedOnly
                      ? 'Ответить своим кадром'
                      : isCurrentMomentReady
                      ? 'Новое касание готово'
                      : 'Добавить фото'}
                  </span>
                </PrimaryButton>
                {isPartnerUploadedOnly && (
                  <p className="text-[11px] text-center text-[#E98787] dark:text-[#F0B9C6] pt-0.5 animate-in fade-in duration-200">
                    {couple.partner.name} уже загрузил(а) фото · как только вы добавите своё, момент сразу откроется
                  </p>
                )}
              </div>
            )}

          {/* State 2: USER_UPLOADED (waiting for partner, not matching) */}
          {activeMoment.status === 'USER_UPLOADED' && !isMatching && (
            <div className="rounded-[20px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] p-4 text-center space-y-3 shadow-2xs animate-card-enter">
              <div className="space-y-1.5">
                <div className="w-9 h-9 rounded-full bg-[#FAF0F2] dark:bg-[#201518] text-[#E98787] dark:text-[#F0B9C6] mx-auto flex items-center justify-center border border-[#EED7DC] dark:border-[#382329]">
                  <Clock size={16} />
                </div>
                <p className="text-xs font-semibold text-[#343033] dark:text-white">
                  Фото отправлено ✨
                </p>
                <p className="text-[11px] text-[#777277] dark:text-[#B8B2B5]">
                  Ждём {couple.partner.name} · когда оба снимка будут готовы, момент откроется
                </p>
              </div>

              {/* Friendly Reminder Button with 180ms micro-scale and confirmation */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={handleSendReminder}
                  disabled={isReminderSent}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-180 ease-out cursor-pointer flex items-center justify-center gap-1.5 mx-auto select-none active:scale-[0.97] ${
                    isReminderSent
                      ? 'bg-[#FAF0F2] dark:bg-[#201518] text-[#E98787] dark:text-[#F0B9C6] border border-[#EED7DC] dark:border-[#382329]'
                      : 'bg-[#FAF5F7] dark:bg-[#1C1A1C] hover:bg-[#F5EFF1] dark:hover:bg-[#242124] text-[#343033] dark:text-white border border-[#EBE3E5] dark:border-[#282428] shadow-2xs'
                  }`}
                >
                  <Bell size={13} className={isReminderSent ? 'text-[#E98787] dark:text-[#F0B9C6]' : 'text-[#777277] dark:text-[#B8B2B5]'} />
                  <span>{isReminderSent ? 'Напоминание отправлено ✨' : `Напомнить ${couple.partner.name}`}</span>
                </button>
              </div>
            </div>
          )}

          {/* State 3: BOTH_UPLOADED fallback button (if animation hasn't fired yet) */}
          {activeMoment.status === 'BOTH_UPLOADED' && !isMatching && (
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
          {(activeMoment.status === 'COMPLETED' || (isMomentMatchCompleted(activeMoment) && activeMoment.status !== 'REVEALED' && activeMoment.status !== 'REACTED')) && (
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
                      variant="coral"
                      onClick={() => {
                        const next = moments.find((m) => m.order === availability.nextOrder);
                        if (next) onSelectActiveMoment(next.id);
                      }}
                    >
                      <span className="font-display font-bold text-[15px] sm:text-base tracking-tight text-[#FFFFFF]">
                        Новое касание готово
                      </span>
                    </PrimaryButton>
                  ) : null}
                </div>
              )}
            </div>
          )}
        </div>
      </PastelCard>
      </div>

      {/* Тонкая широкая кнопка «Наше небо» под блоком касания */}
      {onOpenStreak && (
        <button
          type="button"
          onClick={() => {
            triggerHaptic(hapticEnabled);
            playSoftChime('tap', soundEnabled);
            onOpenStreak();
          }}
          className="w-full min-h-[48px] py-3.5 px-6 rounded-[20px] bg-[#97B2EB] dark:bg-[#97B2EB] hover:bg-[#88A6E7] dark:hover:bg-[#88A6E7] active:bg-[#7A99E1] dark:active:bg-[#7A99E1] active:scale-[0.98] border border-[#86A4E6]/30 dark:border-[#86A4E6]/30 text-center transition-all duration-150 cursor-pointer shadow-2xs flex items-center justify-center gap-2"
          title="Открыть Наше небо"
        >
          <Sparkles size={14} className="text-[#FFFFFF] shrink-0 opacity-90" />
          <span className="font-sans font-semibold text-[13px] tracking-wide text-[#FFFFFF]">
            Наше небо
          </span>
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

      {/* Standalone Fullscreen Match Presentation Scene (Production Match) */}
      {isMatching && (
        <MatchAnimation
          onConnection={handleMatchConnection}
          onComplete={handleMatchComplete}
        />
      )}

      {/* Temporary Isolated Test Match Trigger (Visual Testing Only) */}
      {isTestMatchRunning && (
        <MatchAnimation
          onComplete={() => setIsTestMatchRunning(false)}
        />
      )}

      {/* Fullscreen Photo Viewer */}
      <FullscreenPhotoViewer
        isOpen={Boolean(fullscreenPhoto)}
        onClose={() => setFullscreenPhoto(null)}
        photoUrl={fullscreenPhoto?.url || null}
        title={fullscreenPhoto?.title}
      />
    </div>
  );
};
