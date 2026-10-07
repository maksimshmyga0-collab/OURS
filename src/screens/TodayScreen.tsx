import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Moment, CoupleState, ReactionEmoji, HistoryDay } from '../types';
import { PastelCard, PastelCardColor } from '../components/PastelCard';
import { PhotoSlot } from '../components/PhotoSlot';
import { ReactionPicker } from '../components/ReactionPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressDots } from '../components/ProgressDots';
import { MatchAnimation } from '../components/MatchAnimation';
import { PhotoPickerModal } from '../components/PhotoPickerModal';
import { FullscreenPhotoViewer } from '../components/FullscreenPhotoViewer';
import { OurSkyPreview } from '../components/OurSkyPreview';
import { MatchButton } from '../components/MatchButton';
import { TouchReadyButton } from '../components/TouchReadyButton';
import { AtmosphericGlow } from '../components/AtmosphericGlow';
import { WaitingCloudGlow } from '../components/WaitingCloudGlow';
import { playSoftChime, triggerHaptic } from '../services/feedback';
import { Check, Sparkles, Clock, Heart } from 'lucide-react';
import { CoupleStreakInfo, MomentPhoto } from '../types';
import {
  calculateMomentAvailability,
  formatRemainingTime,
  getSynchronizedNow,
  isMomentMatchCompleted,
  resolveAuthoritativeActiveMomentId,
} from '../services/moments/momentTiming';


interface TodayScreenProps {
  couple: CoupleState;
  moments: Moment[];
  history?: HistoryDay[];
  pairSeed?: string;
  activeMomentId: string;
  onSelectActiveMoment: (momentId: string) => void;
  onUpdateMoment: (updated: Moment) => void;
  soundEnabled: boolean;
  hapticEnabled: boolean;
  streakInfo?: CoupleStreakInfo;
  onOpenStreak?: () => void;
  onOpenSky?: () => void;
  isActive?: boolean;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  couple,
  moments,
  history = [],
  pairSeed,
  activeMomentId,
  onSelectActiveMoment,
  onUpdateMoment,
  soundEnabled,
  hapticEnabled,
  streakInfo,
  onOpenStreak,
  onOpenSky,
  isActive = true,
}) => {
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [matchRevealedEarly, setMatchRevealedEarly] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; title: string } | null>(null);
  const [momentTransition, setMomentTransition] = useState<'idle' | 'exiting' | 'entering'>('idle');

  // Live timer for live countdown calculation with server time synchronization
  const [now, setNow] = useState<number>(() => getSynchronizedNow());

  useEffect(() => {
    // Suspend timer when TodayScreen is not the active tab
    if (!isActive) return;

    // Immediately sync to fresh time on tab activation
    setNow(getSynchronizedNow());

    const updateTimer = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        setNow(getSynchronizedNow());
      }
    };

    const timer = setInterval(updateTimer, 1000);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setNow(getSynchronizedNow());
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isActive]);

  // Calculate moment availability & interval constraints from authoritative timestamps
  const availability = useMemo(() => {
    return calculateMomentAvailability(moments, now);
  }, [moments, now]);

  // Determine active moment authoritatively: automatically advances when cooldown ends
  const authoritativeActiveId = useMemo(() => {
    return resolveAuthoritativeActiveMomentId(moments, now, activeMomentId);
  }, [moments, now, activeMomentId]);

  const activeMoment = useMemo(() => {
    const target = moments.find((m) => m.id === authoritativeActiveId);
    if (target) return target;
    const fallback = moments.find((m) => m.id === activeMomentId);
    if (fallback) return fallback;
    return moments[0];
  }, [moments, authoritativeActiveId, activeMomentId]);

  // Synchronize state with App.tsx and localStorage whenever authoritative active moment advances
  useEffect(() => {
    if (activeMoment && activeMoment.id && activeMoment.id !== activeMomentId) {
      onSelectActiveMoment(activeMoment.id);
    }
  }, [activeMoment?.id, activeMomentId, onSelectActiveMoment]);

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

  // Track moments that have played Match animation
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

  // Unified moment reveal state (starts at Phase 4/5 of Match animation or if already revealed/reacted/completed)
  const isMomentRevealed =
    matchRevealedEarly ||
    activeMoment.status === 'REVEALED' ||
    activeMoment.status === 'REACTED' ||
    activeMoment.status === 'COMPLETED' ||
    Boolean(activeMoment.userReaction);

  // Handle photo selection for the current user
  const handlePhotoSelected = (photoUrl: string) => {
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);

    const nowIso = new Date().toISOString();
    const partnerPhotoItem: MomentPhoto[] = activeMoment.partnerPhoto
      ? [
          {
            userId: couple.partner.id || '',
            imageUrl: activeMoment.partnerPhoto,
            createdAt: nowIso,
          },
        ]
      : [];
    const userPhotoItem: MomentPhoto = {
      userId: couple.user.id || '',
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

  const handleTouchReadyPhotoSelected = (photoUrl: string, targetMomentId?: string) => {
    triggerHaptic(hapticEnabled);
    playSoftChime('tap', soundEnabled);

    const target = (targetMomentId ? moments.find((m) => m.id === targetMomentId) : null) || activeMoment;
    const nowIso = new Date().toISOString();
    const partnerPhotoItem: MomentPhoto[] = target.partnerPhoto
      ? [
          {
            userId: couple.partner.id || '',
            imageUrl: target.partnerPhoto,
            createdAt: nowIso,
          },
        ]
      : [];
    const userPhotoItem: MomentPhoto = {
      userId: couple.user.id || '',
      imageUrl: photoUrl,
      createdAt: nowIso,
    };

    const newPhotos = [userPhotoItem, ...partnerPhotoItem];
    const newStatus = target.partnerPhoto ? 'BOTH_UPLOADED' : 'USER_UPLOADED';

    onUpdateMoment({
      ...target,
      userPhoto: photoUrl,
      photos: newPhotos,
      status: newStatus,
    });
  };

  // Keep activeMoment in a ref to always have latest state for async callbacks
  const activeMomentRef = useRef(activeMoment);
  activeMomentRef.current = activeMoment;

  // Trigger Match animation when THIS user explicitly taps the Match CTA
  const handleOpenMoment = () => {
    if (isMatching || isMomentRevealed) return;
    handledMatchMomentsRef.current.add(activeMoment.id);
    setIsMatching(true);
  };

  // Phase 4 trigger: when connecting elements meet in the center, initiate smooth reveal
  const handleMatchConnection = useCallback(() => {
    setMatchRevealedEarly(true);
  }, []);

  // When match animation completes (2950ms) -> commit REVEALED status for THIS user safely
  const handleMatchComplete = useCallback(() => {
    setIsMatching(false);
    setMatchRevealedEarly(false);
    onUpdateMoment({
      ...activeMomentRef.current,
      status: 'REVEALED',
    });
  }, [onUpdateMoment]);

  // Handle independent per-user reaction selection: automatically completes and saves moment to history
  const handleSelectReaction = (emoji: ReactionEmoji) => {
    triggerHaptic(hapticEnabled);
    playSoftChime('react', soundEnabled);
    setIsMatching(false);
    setMatchRevealedEarly(false);

    const matchTs = activeMoment.completedTimestamp || getSynchronizedNow();
    const updated: Moment = {
      ...activeMoment,
      userReaction: emoji,
      partnerReaction: activeMoment.partnerReaction || null,
      status: 'COMPLETED',
      completedTimestamp: matchTs,
      completedAt: new Date(matchTs).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    onUpdateMoment(updated);
  };

  const getThemeCardColor = (_moment: Moment): PastelCardColor => {
    return 'warm-neutral';
  };

  return (
    <div className="flex-1 flex flex-col space-y-6 pb-8 min-h-full">
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
          className="p-3.5 sm:p-5.5 pb-5 sm:pb-6 relative overflow-visible transition-all duration-300 ease-out animate-card-enter"
        >
        {/* Card Header info */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold tracking-wider text-[#777277] dark:text-[#B8B2B5] uppercase transition-colors duration-200">
            {isCurrentMomentWaiting
              ? `${activeMoment.label} · ПАУЗА`
              : activeMoment.label}
          </span>

          {activeMoment.status === 'COMPLETED' || Boolean(activeMoment.userReaction) ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2B7348] dark:text-[#52B778] animate-in fade-in duration-200">
              <Check size={14} />
              Сохранено
            </span>
          ) : isCurrentMomentWaiting ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/90 dark:bg-[#1E1C1E] border border-[#EED7DC] dark:border-[#2D2024] text-[11px] font-semibold text-[#E2765A] dark:text-[#F2967F] animate-in fade-in duration-200">
              <Clock size={12} />
              Следующее скоро
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
        <div className="mb-4 sm:mb-5 transition-all duration-200">
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
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-1 leading-relaxed">
                {activeMoment.status === 'COMPLETED' || Boolean(activeMoment.userReaction)
                  ? `Сохранено сегодня в ${activeMoment.completedAt || '12:00'}`
                  : isPartnerUploadedOnly
                  ? `${couple.partner.name} уже отправил(а) фото · Добавьте своё, чтобы произошёл MATCH ✨`
                  : activeMoment.subtext}
              </p>
            </div>
          )}
        </div>

        {/* Photo Slots Section - Living Diptych Composition */}
        <div className="relative mb-5 px-0.5 sm:px-1 overflow-visible">
          {/* 1. Atmospheric Ambient Backlight Aura embracing both photos as a unified diptych */}
          <AtmosphericGlow />

          {/* 2. Diptych Central Seam Medallion (Physical & Emotional Connection Bridge) */}
          {/* State A: Revealed and Matched — The Sacred Union Seal */}
          {isMomentRevealed && activeMoment.userPhoto && activeMoment.partnerPhoto && (
            <div className="absolute left-1/2 top-[38%] sm:top-[39%] -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center justify-center animate-in zoom-in-75 fade-in duration-400">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 dark:bg-[#1E1C1E]/95 backdrop-blur-md border border-[#F2DEE3] dark:border-[#382730] shadow-[0_4px_16px_rgba(215,85,105,0.32)] flex items-center justify-center text-[#E17282] dark:text-[#F2967F]">
                <Heart size={13} fill="currentColor" />
              </div>
            </div>
          )}

          {/* State B: Both uploaded, waiting to open / Match pending */}
          {activeMoment.status === 'BOTH_UPLOADED' && !isMomentRevealed && (
            <div className="absolute left-1/2 top-[38%] sm:top-[39%] -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center justify-center animate-in zoom-in-75 fade-in duration-300">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-rose-100 to-amber-100 dark:from-rose-900/80 dark:to-amber-900/80 backdrop-blur-md border border-rose-200/90 dark:border-rose-700/60 shadow-[0_4px_16px_rgba(215,85,105,0.38)] flex items-center justify-center text-[#E17282] dark:text-[#F2967F] animate-pulse">
                <Sparkles size={13} />
              </div>
            </div>
          )}

          {/* State C: User uploaded, waiting for partner — Gentle whispered connecting light bridge */}
          {activeMoment.userPhoto && !activeMoment.partnerPhoto && (
            <div className="absolute left-1/2 top-[38%] sm:top-[39%] -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center">
              <div className="w-6 h-6 rounded-full bg-rose-200/50 dark:bg-rose-900/40 blur-xs flex items-center justify-center animate-pulse">
                <div className="w-2 h-2 rounded-full bg-[#E17282] dark:bg-[#F2967F]" />
              </div>
            </div>
          )}

          <div className="relative grid grid-cols-2 items-start gap-2.5 sm:gap-3.5">
            {isCurrentMomentWaiting ? (
              // Calm waiting placeholders during cooldown with living cherry-burgundy cloud glow
              <div className="col-span-2 w-full relative overflow-visible my-1">
                <WaitingCloudGlow />
                <div className="relative z-10 w-full py-6 px-4 rounded-[24px] bg-white/85 dark:bg-[#161418]/85 backdrop-blur-xl border border-[#EBE3E5] dark:border-[#282529] text-center space-y-2 shadow-2xs animate-in fade-in duration-300">
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
              </div>
            ) : (
              <>
                {/* User Photo Slot with subtle left tilt and organic float */}
                <div className="w-full animate-diptych-left transition-transform duration-300 ease-out hover:rotate-0 hover:translate-y-0">
                  <PhotoSlot
                    type="user"
                    title={couple.user.name}
                    photoUrl={activeMoment.userPhoto}
                    isRevealed={isMomentRevealed}
                    isPartnerUploaded={Boolean(activeMoment.partnerPhoto)}
                    onAddPhoto={() => setIsPhotoPickerOpen(true)}
                    onPhotoSelected={handlePhotoSelected}
                    onOpenFullscreen={(url, title) => setFullscreenPhoto({ url, title: title || 'Твоё фото' })}
                    reaction={activeMoment.partnerReaction}
                  />
                </div>

                {/* Partner Photo Slot with subtle right tilt and counter-phase organic float */}
                <div className="w-full animate-diptych-right transition-transform duration-300 ease-out hover:rotate-0 hover:translate-y-0">
                  <PhotoSlot
                    type="partner"
                    title={couple.partner.name}
                    photoUrl={activeMoment.partnerPhoto}
                    isRevealed={isMomentRevealed}
                    isPartnerUploaded={Boolean(activeMoment.partnerPhoto)}
                    isUserUploaded={Boolean(activeMoment.userPhoto)}
                    onOpenFullscreen={(url, title) => setFullscreenPhoto({ url, title: title || couple.partner.name })}
                    reaction={activeMoment.userReaction}
                  />
                </div>
              </>
            )}
          </div>
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

          {/* State 1: Main CTA «Касание готово» (EMPTY or waiting for user's photo) */}
          {!activeMoment.userPhoto &&
            !isMatching &&
            activeMoment.status !== 'COMPLETED' &&
            activeMoment.status !== 'REVEALED' &&
            activeMoment.status !== 'REACTED' &&
            !isCurrentMomentWaiting && (
              <div className="pt-1.5 animate-in fade-in duration-300 ease-out">
                <TouchReadyButton
                  onClick={() => setIsPhotoPickerOpen(true)}
                  onPhotoSelected={handlePhotoSelected}
                  text="Касание готово"
                  subtext={
                    isPartnerUploadedOnly
                      ? `${couple.partner.name} уже отправил(а) фото · Ваш черёд ♡`
                      : undefined
                  }
                  soundEnabled={soundEnabled}
                  hapticEnabled={hapticEnabled}
                />
              </div>
            )}



          {/* State 3: The Signature Match CTA Button [ КОСНУТЬСЯ ] */}
          {(activeMoment.status === 'BOTH_UPLOADED' ||
            (activeMoment.userPhoto && activeMoment.partnerPhoto && !isMomentRevealed && !activeMoment.userReaction)) &&
            !isMatching &&
            activeMoment.status !== 'COMPLETED' &&
            activeMoment.status !== 'REVEALED' &&
            activeMoment.status !== 'REACTED' &&
            !activeMoment.userReaction && (
              <div className="pt-1.5 animate-in fade-in zoom-in-[0.97] duration-400 ease-out">
                <MatchButton
                  onClick={handleOpenMoment}
                  soundEnabled={soundEnabled}
                  hapticEnabled={hapticEnabled}
                />
              </div>
            )}

          {/* State 4: REVEALED (Active Reaction Picker for THIS user) */}
          {(activeMoment.status === 'REVEALED' || (activeMoment.status === 'REACTED' && !activeMoment.userReaction)) &&
            !isMatching &&
            !activeMoment.userReaction && (
              <div className="space-y-4 pt-1 animate-in fade-in duration-300 ease-out">
                <ReactionPicker
                  selectedReaction={activeMoment.userReaction}
                  onSelectReaction={handleSelectReaction}
                />
              </div>
            )}

          {/* State 6: COMPLETED (Post-Match Waiting State for THIS user) */}
          {(activeMoment.status === 'COMPLETED' || Boolean(activeMoment.userReaction)) && !isMatching && (
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

                  {availability.isWaitingForNext && (
                    <div className="rounded-[18px] bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] p-3 text-center shadow-2xs">
                      <p className="text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6]">
                        Следующее касание через {formatRemainingTime(availability.remainingCooldownMs)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </PastelCard>
      </div>

      {/* «Наше небо» — Живое интерактивное окно в общее небо пары */}
      {(onOpenStreak || onOpenSky) && (
        <OurSkyPreview
          couple={couple}
          todayMoments={moments}
          history={history}
          pairSeed={pairSeed}
          streakInfo={streakInfo}
          soundEnabled={soundEnabled}
          hapticEnabled={hapticEnabled}
          onOpenSky={onOpenStreak || onOpenSky || (() => {})}
        />
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
