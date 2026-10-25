import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Moment, CoupleState, ReactionEmoji, HistoryDay, OurDayPhoto } from '../types';
import { PastelCard, PastelCardColor } from '../components/PastelCard';
import { PhotoSlot } from '../components/PhotoSlot';
import { ReactionPicker } from '../components/ReactionPicker';
import { PrimaryButton } from '../components/PrimaryButton';
import { ProgressDots } from '../components/ProgressDots';
import { MatchAnimation } from '../components/MatchAnimation';
import { PhotoPickerModal } from '../components/PhotoPickerModal';
import { FullscreenPhotoViewer } from '../components/FullscreenPhotoViewer';
import { OurDayScreen } from './OurDayScreen';
import { MatchButton } from '../components/MatchButton';
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
  ourDayPhotos?: OurDayPhoto[];
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
  onAddOurDayPhotos?: (imageUrls: string[]) => Promise<void>;
  onDeleteOurDayPhoto?: (photoId: string) => Promise<void>;
  onClearAllOurDayPhotos?: () => Promise<void> | void;
}

export const TodayScreen: React.FC<TodayScreenProps> = ({
  couple,
  moments,
  history = [],
  ourDayPhotos = [],
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
  onAddOurDayPhotos,
  onDeleteOurDayPhoto,
  onClearAllOurDayPhotos,
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
    <div className="flex-1 h-full w-full flex flex-col space-y-3.5 sm:space-y-4 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-1">
      {/* Day Status Header Bar */}
      <div className="flex items-center justify-between px-1.5 pt-0.5 pb-1">
        <div className="flex flex-col">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#343033] dark:text-white tracking-tight">
            Сегодня
          </h1>
          <p className="text-[11px] sm:text-xs font-medium text-[#777277] dark:text-[#B8B2B5] mt-0.5">
            {availability.completedCount} из 3 касаний
          </p>
        </div>
        <ProgressDots
          total={3}
          completed={availability.completedCount}
          activeOrder={activeMoment.order}
        />
      </div>

      {/* Main Single Active Daily Moment Stage Card */}
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
          className="p-3.5 sm:p-4.5 rounded-[28px] sm:rounded-[32px] relative overflow-hidden transition-all duration-300 ease-out animate-card-enter shadow-sm border border-[#E8DFE1] dark:border-[#242024]"
        >
          {/* 1. Header Row: Title & Status Badge */}
          <div className="flex items-center justify-between gap-2 px-0.5 mb-1.5 min-h-[32px] relative z-20">
            <h2 className="font-display text-2xl xs:text-[26px] sm:text-[28px] font-bold text-[#343033] dark:text-white leading-none tracking-tight">
              Касание
            </h2>

            {/* Dynamic Status Badge */}
            {activeMoment.status === 'COMPLETED' || Boolean(activeMoment.userReaction) ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[#2B7348] dark:text-[#52B778] text-[11px] font-semibold tracking-wide animate-in fade-in duration-200">
                <Check size={13} />
                <span>Сохранено</span>
              </span>
            ) : isCurrentMomentWaiting ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-[#E2765A] dark:text-[#F2967F] text-[11px] font-semibold tracking-wide animate-in fade-in duration-200">
                <Clock size={12} />
                <span>Пауза</span>
              </span>
            ) : activeMoment.status === 'BOTH_UPLOADED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[#E98787] dark:text-[#F0B9C6] text-[11px] font-semibold tracking-wide animate-in fade-in duration-200">
                <Sparkles size={13} />
                <span>Оба готовы</span>
              </span>
            ) : activeMoment.status === 'USER_UPLOADED' ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[#E98787] dark:text-[#F0B9C6] text-[11px] font-semibold tracking-wide animate-in fade-in duration-200">
                <Check size={13} />
                <span>Кадр отправлен</span>
              </span>
            ) : isPartnerUploadedOnly ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[#E98787] dark:text-[#F0B9C6] text-[11px] font-semibold tracking-wide animate-in fade-in duration-200">
                <Sparkles size={13} />
                <span>Ваш черёд</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF0F2] dark:bg-[#201518] border border-[#EED7DC] dark:border-[#382329] text-[#E98787] dark:text-[#F0B9C6] text-[11px] font-semibold tracking-wide">
                <Heart size={12} fill="currentColor" />
                <span>Момент дня</span>
              </span>
            )}
          </div>

          {/* 2. Contextual Status Subtitle */}
          <div className="px-0.5 mb-3 min-h-[22px] flex items-center relative z-20">
            <p className="text-xs text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
              {isCurrentMomentWaiting ? (
                <span className="font-semibold text-[#E2765A] dark:text-[#F2967F]">
                  Следующее касание откроется через {formatRemainingTime(availability.remainingCooldownMs)}
                </span>
              ) : activeMoment.status === 'COMPLETED' || Boolean(activeMoment.userReaction) ? (
                `Сохранено сегодня в ${activeMoment.completedAt || '12:00'} · Нажмите на фото, чтобы развернуть`
              ) : activeMoment.status === 'BOTH_UPLOADED' ? (
                'Оба кадра на месте! Нажмите «Открыть касание», чтобы узнать секрет ✨'
              ) : activeMoment.status === 'USER_UPLOADED' ? (
                `Фото отправлено · Ждём кадр от ${couple.partner.name}...`
              ) : isPartnerUploadedOnly ? (
                `${couple.partner.name} уже отправил(а) фото · Добавьте своё, чтобы произошёл MATCH ✨`
              ) : (
                'Отправьте фото друг другу и откройте их одновременно'
              )}
            </p>
          </div>

          {/* 3. Photo Diptych Area */}
          <div className="relative w-full my-2 overflow-visible select-none z-10">
            {/* Atmospheric Backlight */}
            <AtmosphericGlow />

            {/* Central Seam Medallion — Strictly vertically and horizontally centered over the photo grid */}
            {isMomentRevealed && activeMoment.userPhoto && activeMoment.partnerPhoto && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center justify-center animate-in zoom-in-75 fade-in duration-300">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/95 dark:bg-[#1E1C1E]/95 backdrop-blur-md border border-[#F2DEE3] dark:border-[#382730] shadow-[0_4px_16px_rgba(215,85,105,0.32)] flex items-center justify-center text-[#E17282] dark:text-[#F2967F]">
                  <Heart size={14} fill="currentColor" />
                </div>
              </div>
            )}

            {activeMoment.status === 'BOTH_UPLOADED' && !isMomentRevealed && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none flex items-center justify-center animate-in zoom-in-75 fade-in duration-300">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-rose-100 to-amber-100 dark:from-rose-900/80 dark:to-amber-900/80 backdrop-blur-md border border-rose-200/90 dark:border-rose-700/60 shadow-[0_4px_16px_rgba(215,85,105,0.38)] flex items-center justify-center text-[#E17282] dark:text-[#F2967F] animate-pulse">
                  <Sparkles size={14} />
                </div>
              </div>
            )}

            {activeMoment.userPhoto && !activeMoment.partnerPhoto && (
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex items-center justify-center">
                <div className="w-6.5 h-6.5 rounded-full bg-rose-200/50 dark:bg-rose-900/40 blur-xs flex items-center justify-center animate-pulse">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#E17282] dark:bg-[#F2967F]" />
                </div>
              </div>
            )}

            {/* Grid Stage */}
            <div className="relative grid grid-cols-2 gap-2 sm:gap-2.5 items-stretch w-full">
              {isCurrentMomentWaiting ? (
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
                  {/* User Photo Slot */}
                  <div className="w-full animate-diptych-left transition-transform duration-300 ease-out">
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

                  {/* Partner Photo Slot */}
                  <div className="w-full animate-diptych-right transition-transform duration-300 ease-out">
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

          {/* 4. Action & Control Area */}
          <div className="pt-2 sm:pt-2.5 relative z-20">
            {/* Connecting Animation State */}
            {isMatching && (
              <div className="rounded-[20px] bg-white/80 dark:bg-[#141214]/80 border border-[#F0B9C6]/60 dark:border-[#382329] p-3.5 text-center space-y-1 shadow-2xs animate-in fade-in duration-200">
                <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6]">
                  <Sparkles size={14} className="animate-spin" />
                  <span>Соединяем ваши кадры...</span>
                </div>
              </div>
            )}

            {/* User uploaded, waiting for partner response */}
            {activeMoment.status === 'USER_UPLOADED' && !isMatching && (
              <div className="p-3.5 rounded-[22px] bg-[#FAF0F2]/80 dark:bg-[#1C1417]/80 border border-[#EED7DC] dark:border-[#352126] text-center space-y-1 animate-in fade-in duration-300">
                <p className="text-xs font-semibold text-[#E98787] dark:text-[#F0B9C6] flex items-center justify-center gap-1.5">
                  <Clock size={14} />
                  <span>Ждём ответный кадр от {couple.partner.name}</span>
                </p>
                <p className="text-[11px] text-[#777277] dark:text-[#B8B2B5] leading-normal">
                  Как только {couple.partner.name} загрузит фото, вам станет доступна кнопка раскрытия.
                </p>
              </div>
            )}

            {/* Match Ready CTA Button */}
            {(activeMoment.status === 'BOTH_UPLOADED' ||
              (activeMoment.userPhoto && activeMoment.partnerPhoto && !isMomentRevealed && !activeMoment.userReaction)) &&
              !isMatching &&
              activeMoment.status !== 'COMPLETED' &&
              activeMoment.status !== 'REVEALED' &&
              activeMoment.status !== 'REACTED' &&
              !activeMoment.userReaction && (
                <div className="pt-1 animate-in fade-in zoom-in-[0.97] duration-400 ease-out">
                  <MatchButton
                    onClick={handleOpenMoment}
                    soundEnabled={soundEnabled}
                    hapticEnabled={hapticEnabled}
                  />
                </div>
              )}

            {/* Revealed State: Emoji Reaction Picker */}
            {(activeMoment.status === 'REVEALED' || (activeMoment.status === 'REACTED' && !activeMoment.userReaction)) &&
              !isMatching &&
              !activeMoment.userReaction && (
                <div className="space-y-3 pt-1 animate-in fade-in duration-300 ease-out">
                  <div className="text-center">
                    <p className="text-xs font-semibold text-[#343033] dark:text-white mb-1">
                      Оставьте реакцию на момент
                    </p>
                  </div>
                  <ReactionPicker
                    selectedReaction={activeMoment.userReaction}
                    onSelectReaction={handleSelectReaction}
                  />
                </div>
              )}

            {/* Completed State */}
            {(activeMoment.status === 'COMPLETED' || Boolean(activeMoment.userReaction)) && !isMatching && (
              <div className="pt-1 animate-in fade-in duration-300 ease-out">
                {availability.isAllCompleted ? (
                  <div className="p-4.5 rounded-[22px] bg-white/90 dark:bg-[#141214]/90 border border-[#EBE3E5] dark:border-[#242024] text-center space-y-1.5 shadow-2xs">
                    <div className="w-10 h-10 rounded-full bg-[#FAF0ED] dark:bg-[#201518] text-[#E98787] dark:text-[#F0B9C6] mx-auto flex items-center justify-center">
                      <Heart size={20} className="fill-[#E98787] dark:fill-[#F0B9C6]" />
                    </div>
                    <p className="font-display text-sm font-bold text-[#343033] dark:text-white">
                      На сегодня всё 💗
                    </p>
                    <p className="text-xs text-[#777277] dark:text-[#B8B2B5]">
                      Все касания сохранены в вашей общей истории.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-[#777277] dark:text-[#B8B2B5] px-1">
                      <span className="font-medium text-[#2B7348] dark:text-[#52B778] flex items-center gap-1">
                        <Check size={13} /> Касание сохранено в историю
                      </span>
                    </div>

                    {availability.isWaitingForNext && (
                      <div className="rounded-[18px] bg-white/90 dark:bg-[#141214]/90 border border-[#EBE3E5] dark:border-[#242024] p-3 text-center shadow-2xs">
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

      {/* 2. Интерфейс «Наш день» — расположен непосредственно под блоком «Касание» */}
      <div className="relative z-10 w-full">
        <OurDayScreen
          isEmbedded={true}
          photos={ourDayPhotos}
          couple={couple}
          onAddPhotos={onAddOurDayPhotos || (async () => {})}
          onDeletePhoto={onDeleteOurDayPhoto}
          onClearAllPhotos={onClearAllOurDayPhotos}
          soundEnabled={soundEnabled}
          hapticEnabled={hapticEnabled}
        />
      </div>


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
