import React, { useState, useMemo, useCallback } from 'react';
import { HistoryDay, Moment, CoupleState, ReactionEmoji, OurDayPhoto } from '../types';
import { Lock, ArrowLeft, Sparkles, Heart, Calendar, Layers, Image as ImageIcon, Mail, Images, Camera } from 'lucide-react';
import { ReactionIcon } from '../components/ReactionIcon';
import { FullscreenPhotoViewer } from '../components/FullscreenPhotoViewer';
import { AtmosphericGlow } from '../components/AtmosphericGlow';
import { triggerHaptic, playSoftChime } from '../services/feedback';
import { formatMatchCardTimestamp, formatRussianDate, getLocalDateKey } from '../services/moments/momentTiming';

interface HistoryScreenProps {
  history: HistoryDay[];
  todayMoments: Moment[];
  ourDayPhotos?: OurDayPhoto[];
  couple: CoupleState;
  onOpenPremium?: () => void;
  onOpenLovely?: () => void;
  onNavigateToToday: () => void;
}

function resolveUserPhoto(m: Moment, currentUserId?: string): string | null {
  if (m.userPhoto) return m.userPhoto;
  if (m.photos && m.photos.length > 0) {
    if (currentUserId) {
      const userP = m.photos.find((p) => p.userId === currentUserId);
      if (userP?.imageUrl) return userP.imageUrl;
    }
    return m.photos[0].imageUrl;
  }
  return m.imageUrl || null;
}

function resolvePartnerPhoto(m: Moment, currentUserId?: string): string | null {
  if (m.partnerPhoto) return m.partnerPhoto;
  if (m.photos && m.photos.length > 1) {
    if (currentUserId) {
      const partnerP = m.photos.find((p) => p.userId !== currentUserId);
      if (partnerP?.imageUrl) return partnerP.imageUrl;
    }
    return m.photos[1].imageUrl;
  }
  if (m.photos && m.photos.length === 1 && currentUserId) {
    const onlyP = m.photos[0];
    if (onlyP.userId !== currentUserId) return onlyP.imageUrl;
  }
  return null;
}

function getPluralMoments(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'момент';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'момента';
  return 'моментов';
}

function getYesterdayDateKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateKey(d);
}

function formatRussianShortDate(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
    });
  } catch {
    return dateKey;
  }
}

function getPluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}

interface HistoryMomentCardProps {
  moment: Moment;
  isDayUnlocked: boolean;
  isUnlockedGlobally: boolean;
  couple: CoupleState;
  onPhotoClick: (url: string | null, authorName: string) => void;
  onOpenLovely: () => void;
}

const HistoryMomentCard = React.memo<HistoryMomentCardProps>(({
  moment: m,
  isDayUnlocked,
  isUnlockedGlobally,
  couple,
  onPhotoClick,
  onOpenLovely,
}) => {
  const isDateM = Boolean(m.isDate || (typeof m.id === 'string' && m.id.startsWith('date-')) || m.label === 'СВИДАНИЕ');
  const isOurDayM = Boolean(m.label === 'НАШ ДЕНЬ' || m.prompt === 'Наш день' || (typeof m.id === 'string' && m.id.startsWith('ourday-')));
  const dPhoto = m.imageUrl || m.userPhoto || m.partnerPhoto || (m.photos && m.photos[0]?.imageUrl);

  const renderCoupleDiptych = () => {
    const userPhoto = resolveUserPhoto(m, couple.user.id);
    const partnerPhoto = resolvePartnerPhoto(m, couple.user.id);
    const hasBoth = Boolean(userPhoto && partnerPhoto);

    if (!isDayUnlocked && !isUnlockedGlobally) {
      return (
        <div className="relative w-full rounded-[22px] overflow-hidden bg-[#FAF0F2] dark:bg-[#1E1418] border border-[#F2D1D8] dark:border-[#382329] p-6 text-center space-y-3 shadow-2xs">
          <div className="w-10 h-10 mx-auto rounded-full bg-white dark:bg-[#2A161E] border border-[#F2D1D8] dark:border-[#42222B] flex items-center justify-center text-[#E98787] shadow-2xs">
            <Lock size={16} />
          </div>
          <div className="space-y-1">
            <p className="font-display text-sm font-bold text-[#343033] dark:text-white">
              Касание бережно сохранено навсегда
            </p>
            <p className="text-xs text-[#777277] dark:text-[#B8B2B5] max-w-xs mx-auto">
              Воспоминания старше 7 дней открываются с LOVELY
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenLovely}
            className="group relative h-[38px] px-4 rounded-full select-none overflow-hidden cursor-pointer transition-all duration-100 ease-out active:scale-[0.985] bg-[#FAF0F2] dark:bg-[#150F13] border border-[#E98787]/20 dark:border-[#E8BFC7]/15 shadow-xs hover:border-[#E98787]/35 text-center flex items-center justify-center shrink-0"
          >
            <span className="font-display font-semibold text-xs tracking-tight text-[#343033] dark:text-white whitespace-nowrap">
              Открыть воспоминания
            </span>
          </button>
        </div>
      );
    }

    const isDateMoment = Boolean(
      m.isDate ||
      (typeof m.id === 'string' && m.id.startsWith('date-')) ||
      m.label === 'СВИДАНИЕ'
    );

    const isOurDayMoment = Boolean(
      m.label === 'НАШ ДЕНЬ' ||
      m.prompt === 'Наш день' ||
      (typeof m.id === 'string' && m.id.startsWith('ourday-'))
    );

    const singlePhoto = userPhoto || partnerPhoto || (m.photos && m.photos[0]?.imageUrl) || m.imageUrl;

    if ((isDateMoment || isOurDayMoment) && (!hasBoth || (m.photos && m.photos.length <= 1))) {
      const authorLabel = isOurDayMoment
        ? (userPhoto ? (couple.user.name || 'Ты') : (couple.partner.name || 'Партнёр'))
        : 'Совместное фото';

      return (
        <div className="space-y-2">
          <div
            onClick={(e) => {
              e.stopPropagation();
              if (singlePhoto) {
                onPhotoClick(
                  singlePhoto,
                  isOurDayMoment ? `Фото от ${authorLabel}` : (m.prompt || 'Свидание')
                );
              }
            }}
            className="relative aspect-[16/10] xs:aspect-[16/9.5] w-full rounded-[18px] sm:rounded-[20px] overflow-hidden bg-[#F7F2F4] dark:bg-[#181316] border border-[#EBE3E5] dark:border-[#2C2329] shadow-xs group cursor-pointer active:scale-[0.985] transition-transform duration-200"
            role="button"
            tabIndex={0}
            aria-label={isOurDayMoment ? `Открыть фото ${authorLabel}` : 'Открыть фото свидания'}
          >
            {singlePhoto ? (
              <>
                <img
                  src={singlePhoto}
                  alt={isOurDayMoment ? `Фото от ${authorLabel}` : 'Фото свидания'}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                />
                <div className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-black/45 backdrop-blur-md text-white text-[10px] font-semibold tracking-tight pointer-events-none shadow-xs">
                  {authorLabel}
                </div>
                <div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-medium tracking-tight pointer-events-none shadow-xs">
                  Смотреть
                </div>
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[#777277] text-xs">
                {isOurDayMoment ? 'Фото Нашего дня' : 'Фото свидания'}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="relative grid grid-cols-2 gap-1.5 sm:gap-2 items-center">
          {/* User Photo Slot */}
          <div className="flex flex-col">
            {userPhoto ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotoClick(userPhoto, couple.user.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onPhotoClick(userPhoto, couple.user.name);
                  }
                }}
                className="relative aspect-[4/5] w-full rounded-[18px] sm:rounded-[20px] overflow-hidden bg-[#F7F2F4] dark:bg-[#181316] border border-[#EBE3E5] dark:border-[#2C2329] shadow-xs group cursor-pointer active:scale-[0.985] transition-transform duration-200"
                role="button"
                tabIndex={0}
                aria-label={`Открыть фото ${couple.user.name}`}
              >
                <img
                  src={userPhoto}
                  alt={couple.user.name}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-md text-white text-[10px] font-semibold tracking-tight pointer-events-none shadow-xs">
                  {couple.user.name}
                </div>
                {m.partnerReaction && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-2 right-2 w-7.5 h-7.5 rounded-full bg-white/95 dark:bg-[#1E1A1E] shadow-sm border border-[#F0E6E8] dark:border-[#38262E] flex items-center justify-center transition-transform hover:scale-110 pointer-events-none"
                    title={`Реакция ${couple.partner.name}`}
                  >
                    <ReactionIcon reaction={m.partnerReaction} size={16} />
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-[4/5] w-full rounded-[18px] sm:rounded-[20px] bg-[#FAF5F7] dark:bg-[#181316] border border-dashed border-[#EED7DC] dark:border-[#382329] flex flex-col items-center justify-center text-center p-3 text-[#777277] dark:text-[#A8A0A6]">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-[#201518] border border-[#F0DADE] dark:border-[#3A222A] flex items-center justify-center text-[#E98787] mb-2">
                  <Heart size={14} className="fill-[#E98787]/20" />
                </div>
                <span className="text-[11px] font-semibold text-[#343033] dark:text-white">
                  {couple.user.name}
                </span>
                <span className="text-[10px] text-[#8A8488] dark:text-[#A8A0A6] mt-0.5 leading-tight">
                  Кадр в сердце
                </span>
              </div>
            )}
          </div>

          {/* Central Connecting Talisman */}
          {hasBoth && (
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/95 dark:bg-[#1E1A1E] shadow-md border border-[#F0E6E8] dark:border-[#3A262E] text-[#E98787] flex items-center justify-center pointer-events-none animate-in zoom-in-75 duration-300">
              <Heart size={13} className="fill-[#E98787] text-[#E98787]" />
            </div>
          )}

          {/* Partner Photo Slot */}
          <div className="flex flex-col">
            {partnerPhoto ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onPhotoClick(partnerPhoto, couple.partner.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onPhotoClick(partnerPhoto, couple.partner.name);
                  }
                }}
                className="relative aspect-[4/5] w-full rounded-[18px] sm:rounded-[20px] overflow-hidden bg-[#F7F2F4] dark:bg-[#181316] border border-[#EBE3E5] dark:border-[#2C2329] shadow-xs group cursor-pointer active:scale-[0.985] transition-transform duration-200"
                role="button"
                tabIndex={0}
                aria-label={`Открыть фото ${couple.partner.name}`}
              >
                <img
                  src={partnerPhoto}
                  alt={couple.partner.name}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                />
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-md text-white text-[10px] font-semibold tracking-tight pointer-events-none shadow-xs">
                  {couple.partner.name}
                </div>
                {m.userReaction && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-2 right-2 w-7.5 h-7.5 rounded-full bg-white/95 dark:bg-[#1E1A1E] shadow-sm border border-[#F0E6E8] dark:border-[#38262E] flex items-center justify-center transition-transform hover:scale-110 pointer-events-none"
                    title={`Реакция ${couple.user.name}`}
                  >
                    <ReactionIcon reaction={m.userReaction} size={16} />
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-[4/5] w-full rounded-[18px] sm:rounded-[20px] bg-[#FAF5F7] dark:bg-[#181316] border border-dashed border-[#EED7DC] dark:border-[#382329] flex flex-col items-center justify-center text-center p-3 text-[#777277] dark:text-[#A8A0A6]">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-[#201518] border border-[#F0DADE] dark:border-[#3A222A] flex items-center justify-center text-[#E98787] mb-2">
                  <Heart size={14} className="fill-[#E98787]/20" />
                </div>
                <span className="text-[11px] font-semibold text-[#343033] dark:text-white">
                  {couple.partner.name}
                </span>
                <span className="text-[10px] text-[#8A8488] dark:text-[#A8A0A6] mt-0.5 leading-tight">
                  Рядом в мыслях
                </span>
              </div>
            )}
          </div>
        </div>

        {(m.userReaction || m.partnerReaction) && (
          <div className="flex items-center justify-center gap-3 pt-1 text-[11px] text-[#777277] dark:text-[#A8A0A6]">
            {m.userReaction && (
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-[#343033] dark:text-white">{couple.user.name}:</span>
                <ReactionIcon reaction={m.userReaction} size={15} />
              </span>
            )}
            {m.userReaction && m.partnerReaction && (
              <span className="text-[#C8C2C5] dark:text-[#4A4047]" aria-hidden="true">·</span>
            )}
            {m.partnerReaction && (
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-[#343033] dark:text-white">{couple.partner.name}:</span>
                <ReactionIcon reaction={m.partnerReaction} size={15} />
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative overflow-visible">
      <AtmosphericGlow variant="card" insetClassName="-inset-2 sm:-inset-2.5" roundedClassName="rounded-[28px]" />
      <div
        onClick={() => {
          if (isDateM && dPhoto) {
            onPhotoClick(dPhoto, m.prompt || 'Свидание');
          }
        }}
        className={`relative rounded-[24px] sm:rounded-[26px] p-2.5 sm:p-3 pb-3 sm:pb-3.5 bg-white dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs space-y-2.5 transition-all ${
          isDateM && dPhoto ? 'cursor-pointer hover:border-[#E98787]/40' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2.5 px-1 pt-0.5">
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#E98787] dark:text-[#F0B9C6] uppercase tracking-wider">
              {m.isDate || (typeof m.id === 'string' && m.id.startsWith('date-')) ? (
                <Mail size={11} className="shrink-0" />
              ) : (
                <Sparkles size={11} className="shrink-0" />
              )}
              <span>
                {m.isDate || (typeof m.id === 'string' && m.id.startsWith('date-'))
                  ? 'СВИДАНИЕ'
                  : isOurDayM
                  ? 'НАШ ДЕНЬ'
                  : 'КАСАНИЕ'}
              </span>
            </div>
            <h3 className="font-display text-[15px] sm:text-base font-bold text-[#343033] dark:text-white leading-snug break-words">
              {m.prompt ? m.prompt.replace(/\s*\d+$/, '') : 'Касание'}
            </h3>
          </div>
          {formatMatchCardTimestamp(m) && (
            <span className="text-xs font-semibold text-[#8C858A] dark:text-[#A8A0A6] shrink-0 pt-0.5 tabular-nums text-right">
              {formatMatchCardTimestamp(m)}
            </span>
          )}
        </div>

        {renderCoupleDiptych()}
      </div>
    </div>
  );
});

interface HistoryDayCardProps {
  day: HistoryDay;
  isUnlockedGlobally: boolean;
  cardBgColor: string;
  couple: CoupleState;
  onSelectDay: (dayId: string) => void;
  onOpenLovely: () => void;
}

const HistoryDayCard = React.memo<HistoryDayCardProps>(({
  day,
  isUnlockedGlobally,
  cardBgColor,
  couple,
  onSelectDay,
  onOpenLovely,
}) => {
  const isDayUnlocked = !day.isLocked || isUnlockedGlobally;

  return (
    <div className="relative overflow-visible">
      <AtmosphericGlow variant="card" insetClassName="-inset-2 sm:-inset-2.5" roundedClassName="rounded-[28px]" />
      <div
        onClick={() => {
          triggerHaptic(true);
          if (isDayUnlocked) {
            onSelectDay(day.id);
          } else {
            onOpenLovely();
          }
        }}
        className={`relative rounded-[24px] p-4 sm:p-5 border border-[#EBE3E5] dark:border-[#242024] shadow-2xs transition-all duration-150 cursor-pointer active:scale-[0.99] hover:border-[#E98787]/50 backdrop-blur-md ${cardBgColor}`}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-base font-bold text-[#343033] dark:text-white">
              {day.title}
            </h3>
            <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
              {day.subtitle} · {day.dateStr}
            </p>
          </div>

          {!isDayUnlocked ? (
            <span className="w-8 h-8 rounded-full bg-white/90 dark:bg-[#1A181A] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] shadow-2xs">
              <Lock size={14} />
            </span>
          ) : (
            <span className="text-xs font-semibold text-[#E98787] flex items-center gap-1">
              <span>Смотреть</span>
              <span>→</span>
            </span>
          )}
        </div>

        {isDayUnlocked ? (
          <div className="grid grid-cols-3 gap-2 pt-1">
            {day.moments.slice(0, 3).map((m, mIdx) => {
              const isDateM = Boolean(
                m.isDate ||
                (typeof m.id === 'string' && m.id.startsWith('date-')) ||
                m.label === 'СВИДАНИЕ'
              );
              const uP = resolveUserPhoto(m, couple.user.id);
              const pP = resolvePartnerPhoto(m, couple.user.id);
              const hasDistinctPair = Boolean(uP && pP && uP !== pP);
              const singlePhoto = uP || pP || m.imageUrl || (m.photos && m.photos[0]?.imageUrl);

              return (
                <div
                  key={m.id || mIdx}
                  className={`aspect-[4/3] rounded-[14px] overflow-hidden bg-white dark:bg-[#141214] relative flex transition-all ${
                    isDateM
                      ? 'border border-[#E98787]/40 dark:border-[#E8BFC7]/30 shadow-[0_2px_8px_-2px_rgba(233,135,135,0.22)]'
                      : 'border border-[#EBE3E5] dark:border-[#242024] shadow-2xs'
                  }`}
                >
                  {hasDistinctPair ? (
                    <div className="grid grid-cols-2 w-full h-full">
                      <img src={uP!} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover border-r border-white/20" />
                      <img src={pP!} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    </div>
                  ) : singlePhoto ? (
                    <img src={singlePhoto} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[#777277]">
                      <ImageIcon size={14} />
                    </div>
                  )}

                  {isDateM && (
                    <div className="absolute bottom-1.5 left-1.5 z-10 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/45 dark:bg-black/60 backdrop-blur-md text-white border border-white/20 shadow-2xs pointer-events-none select-none">
                      <Heart size={8} className="text-[#E98787] dark:text-[#F0B9C6] fill-[#E98787] dark:fill-[#F0B9C6] shrink-0" />
                      <span className="text-[9px] font-semibold tracking-tight text-white/95 leading-none">
                        Свидание
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[18px] bg-white dark:bg-[#141214] p-3.5 border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-between gap-3 mt-1 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <Lock size={15} className="text-[#E98787] shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#343033] dark:text-white">
                  Сохранено в архиве пары
                </p>
                <p className="text-[10px] text-[#777277] dark:text-[#B8B2B5]">
                  Доступно в LOVELY
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-[#E98787] underline whitespace-nowrap">
              Открыть
            </span>
          </div>
        )}
      </div>
    </div>
  );
});

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  history,
  todayMoments,
  ourDayPhotos = [],
  couple,
  onOpenPremium,
  onOpenLovely,
  onNavigateToToday: _onNavigateToToday,
}) => {
  const handleOpenLovely = useCallback(() => {
    const fn = onOpenLovely || onOpenPremium || (() => {});
    fn();
  }, [onOpenLovely, onOpenPremium]);

  const [viewMode, setViewMode] = useState<'days' | 'stream'>('days');
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; title: string } | null>(null);

  const handlePhotoClick = useCallback((url: string | null, authorName: string) => {
    if (!url) return;
    triggerHaptic(true);
    playSoftChime('tap', true);
    setFullscreenPhoto({ url, title: authorName });
  }, []);

  const handleCloseFullscreen = useCallback(() => {
    setFullscreenPhoto(null);
  }, []);

  const handleSelectDay = useCallback((dayId: string) => {
    setSelectedDayId(dayId);
  }, []);

  const handleBackToHistory = useCallback(() => {
    triggerHaptic(true);
    setSelectedDayId(null);
  }, []);

  // Only real couple history
  const cleanHistory = useMemo(() => {
    return (history || []).filter(
      (d) => d && d.id && !d.id.startsWith("day-hist-") && !d.id.startsWith("hist-today-dynamic")
    );
  }, [history]);

  // Completed / matched today moments from local state
  const completedTodayMoments = useMemo(() => {
    return todayMoments.filter(
      (m) =>
        (m.status === "COMPLETED" || m.status === "REVEALED" || m.status === "REACTED") &&
        Boolean(m.userPhoto || m.partnerPhoto)
    );
  }, [todayMoments]);

  // Master Unified Chronological History Generator
  const displayHistory = useMemo((): HistoryDay[] => {
    const todayKey = getLocalDateKey();
    const yesterdayKey = getYesterdayDateKey();

    const dayBuckets = new Map<
      string,
      {
        id: string;
        dateKey: string;
        title: string;
        dateStr: string;
        isLocked: boolean;
        moments: Moment[];
      }
    >();

    const getOrCreateBucket = (dKey: string, initialTitle?: string, initialDateStr?: string, initialLocked?: boolean) => {
      const canonicalKey = (dKey === "today" || dKey === "Сегодня") ? todayKey : dKey;
      let bucket = dayBuckets.get(canonicalKey);
      if (!bucket) {
        let title = initialTitle;
        let dateStr = initialDateStr;

        if (!title || title === "Сегодня") {
          if (canonicalKey === todayKey) {
            title = "Сегодня";
            dateStr = "Сегодня";
          } else if (canonicalKey === yesterdayKey) {
            title = "Вчера";
            dateStr = "Вчера";
          } else {
            title = formatRussianDate(canonicalKey);
            dateStr = formatRussianShortDate(canonicalKey);
          }
        }

        if (!dateStr) {
          dateStr = canonicalKey === todayKey ? "Сегодня" : canonicalKey === yesterdayKey ? "Вчера" : formatRussianShortDate(canonicalKey);
        }

        let isLocked = initialLocked;
        if (isLocked === undefined) {
          try {
            const [y, m, d] = canonicalKey.split("-").map(Number);
            const momentDate = new Date(y, m - 1, d);
            const now = new Date();
            const diffDays = Math.floor((now.getTime() - momentDate.getTime()) / (1000 * 60 * 60 * 24));
            isLocked = diffDays > 7;
          } catch {
            isLocked = false;
          }
        }

        bucket = {
          id: `hist-${canonicalKey}`,
          dateKey: canonicalKey,
          title: title,
          dateStr: dateStr,
          isLocked: isLocked,
          moments: [],
        };
        dayBuckets.set(canonicalKey, bucket);
      }
      return bucket;
    };

    cleanHistory.forEach((day) => {
      if (!day) return;
      const dKey =
        day.dateKey ||
        (typeof day.id === "string" && day.id.startsWith("hist-") ? day.id.replace("hist-", "") : null) ||
        day.moments?.[0]?.dateKey ||
        todayKey;

      const bucket = getOrCreateBucket(dKey, day.title, day.dateStr, day.isLocked);
      if (Array.isArray(day.moments)) {
        day.moments.forEach((m) => {
          if (!m) return;
          if (!bucket.moments.some((existing) => existing.id === m.id)) {
            bucket.moments.push(m);
          }
        });
      }
    });

    completedTodayMoments.forEach((m) => {
      const dKey = m.dateKey || todayKey;
      const bucket = getOrCreateBucket(dKey);
      if (!bucket.moments.some((existing) => existing.id === m.id)) {
        bucket.moments.push(m);
      }
    });

    if (ourDayPhotos && ourDayPhotos.length > 0) {
      const photosByDate = new Map<string, OurDayPhoto[]>();
      ourDayPhotos.forEach((photo) => {
        if (!photo || !photo.imageUrl) return;
        let canonicalKey = todayKey;
        if (photo.createdAt) {
          try {
            const d = new Date(photo.createdAt);
            if (!isNaN(d.getTime())) {
              canonicalKey = getLocalDateKey(d);
            } else {
              const rawKey = photo.createdAt.substring(0, 10);
              if (/^\d{4}-\d{2}-\d{2}$/.test(rawKey)) canonicalKey = rawKey;
            }
          } catch {
            const rawKey = photo.createdAt.substring(0, 10);
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawKey)) canonicalKey = rawKey;
          }
        }
        if (!photosByDate.has(canonicalKey)) {
          photosByDate.set(canonicalKey, []);
        }
        photosByDate.get(canonicalKey)!.push(photo);
      });

      photosByDate.forEach((photos, dKey) => {
        const validPhotos = photos.filter((p) => p && p.imageUrl);
        if (validPhotos.length === 0) return;

        const userP = validPhotos.find(
          (p) => p.authorId === couple.user.id || p.authorName === couple.user.name
        );

        const partnerP = validPhotos.find(
          (p) => p.authorId !== couple.user.id && p.authorName !== couple.user.name
        );

        const finalUserPhoto = userP?.imageUrl || null;
        const finalPartnerPhoto = partnerP?.imageUrl || null;

        if (!finalUserPhoto && !finalPartnerPhoto) return;

        const firstP = validPhotos[0];
        const latestCreatedAt = validPhotos.reduce((latest, p) => {
          return p.createdAt && p.createdAt > latest ? p.createdAt : latest;
        }, firstP.createdAt || new Date().toISOString());

        const ourDayMoment: Moment = {
          id: `ourday-group-${dKey}`,
          pairId: firstP.pairId || couple.id || "pair_default",
          createdBy: firstP.authorId || "",
          createdAt: latestCreatedAt,
          dateKey: dKey,
          imageUrl: finalUserPhoto || finalPartnerPhoto || firstP.imageUrl,
          caption: firstP.caption || null,
          order: 1,
          label: "НАШ ДЕНЬ",
          prompt: "Наш день",
          subtext: "Кадр повседневности",
          status: "COMPLETED",
          themeColor: "pink",
          userPhoto: finalUserPhoto,
          partnerPhoto: finalPartnerPhoto,
          userReaction: null,
          partnerReaction: null,
          completedAt: latestCreatedAt
            ? new Date(latestCreatedAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
            : "12:00",
        };

        const bucket = getOrCreateBucket(dKey);
        const existingIdx = bucket.moments.findIndex(
          (m) => m.id === ourDayMoment.id || m.label === "НАШ ДЕНЬ" || m.prompt === "Наш день"
        );

        if (existingIdx >= 0) {
          bucket.moments[existingIdx] = {
            ...bucket.moments[existingIdx],
            userPhoto: finalUserPhoto || bucket.moments[existingIdx].userPhoto,
            partnerPhoto: finalPartnerPhoto || bucket.moments[existingIdx].partnerPhoto,
            imageUrl: finalUserPhoto || finalPartnerPhoto || bucket.moments[existingIdx].imageUrl,
          };
        } else {
          bucket.moments.push(ourDayMoment);
        }
      });
    }

    const sortedDays = Array.from(dayBuckets.values())
      .filter((bucket) => bucket.moments.length > 0)
      .sort((a, b) => b.dateKey.localeCompare(a.dateKey));

    return sortedDays.map((day) => ({
      ...day,
      subtitle: `${day.moments.length} ${getPluralMoments(day.moments.length)}`,
    }));
  }, [cleanHistory, completedTodayMoments, ourDayPhotos, couple]);

  const totalMomentsCount = useMemo(() => {
    return displayHistory.reduce((acc, day) => acc + day.moments.length, 0);
  }, [displayHistory]);

  const totalDaysCount = displayHistory.length;

  const isUnlockedGlobally = couple.isLovely || couple.subscription === 'premium';
  const selectedDay = useMemo(() => {
    return displayHistory.find((d) => d.id === selectedDayId) || null;
  }, [displayHistory, selectedDayId]);

  // Day Detail View (Drilldown)
  if (selectedDay) {
    const isDayUnlocked = !selectedDay.isLocked || isUnlockedGlobally;

    return (
      <div className="flex-1 h-full w-full flex flex-col space-y-5 pb-12 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-1 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleBackToHistory}
              className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#343033] dark:text-white hover:bg-[#FAF7F8] dark:hover:bg-[#252225] transition-all active:scale-95 cursor-pointer shadow-2xs"
              title="Назад к истории"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="font-display text-xl font-bold text-[#343033] dark:text-white tracking-tight">
                {selectedDay.title}
              </h1>
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5]">
                {selectedDay.dateStr} · {selectedDay.moments.length} {getPluralMoments(selectedDay.moments.length)}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {selectedDay.moments.map((m, idx) => (
            <HistoryMomentCard
              key={m.id || idx}
              moment={m}
              isDayUnlocked={isDayUnlocked}
              isUnlockedGlobally={isUnlockedGlobally}
              couple={couple}
              onPhotoClick={handlePhotoClick}
              onOpenLovely={handleOpenLovely}
            />
          ))}
        </div>

        <FullscreenPhotoViewer
          isOpen={Boolean(fullscreenPhoto)}
          onClose={handleCloseFullscreen}
          photoUrl={fullscreenPhoto?.url || null}
          title={fullscreenPhoto?.title}
        />
      </div>
    );
  }

  return (
    <div className="flex-1 h-full w-full flex flex-col space-y-5 pb-12 overflow-y-auto overscroll-y-contain [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden px-1">
      <div className="space-y-2 pt-1">
        <div className="flex items-end justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#343033] dark:text-white tracking-tight">
              История
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
              <span>{totalMomentsCount} {getPluralMoments(totalMomentsCount)}</span>
              <span aria-hidden="true">·</span>
              <span>{totalDaysCount} {getPluralDays(totalDaysCount)}</span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 p-0.5 rounded-full bg-[#F5EFF1] dark:bg-[#1E1A1D] border border-[#EBE3E5] dark:border-[#282126] shadow-2xs shrink-0">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(true);
                setViewMode('days');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'days'
                  ? 'bg-white dark:bg-[#282025] text-[#343033] dark:text-white shadow-xs'
                  : 'text-[#777277] dark:text-[#A8A0A6] hover:text-[#343033] dark:hover:text-white'
              }`}
              title="По дням"
            >
              <Calendar size={12} className="shrink-0" />
              <span>По дням</span>
            </button>
            <button
              type="button"
              onClick={() => {
                triggerHaptic(true);
                setViewMode('stream');
              }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11.5px] sm:text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                viewMode === 'stream'
                  ? 'bg-white dark:bg-[#282025] text-[#343033] dark:text-white shadow-xs'
                  : 'text-[#777277] dark:text-[#A8A0A6] hover:text-[#343033] dark:hover:text-white'
              }`}
              title="Лента моментов"
            >
              <Layers size={12} className="shrink-0" />
              <span>Лента</span>
            </button>
          </div>
        </div>
      </div>

      {displayHistory.length === 0 ? (
        <div className="relative my-6 overflow-visible">
          <AtmosphericGlow variant="card" insetClassName="-inset-2.5 sm:-inset-3.5" roundedClassName="rounded-[32px]" />
          <div className="relative rounded-[28px] p-8 text-center bg-white/70 dark:bg-[#121212]/90 backdrop-blur-md border border-[#EBE3E5] dark:border-[#242024] shadow-2xs space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FAF0F2] dark:bg-[#201518] border border-[#EED7DC] dark:border-[#382329] flex items-center justify-center text-[#E98787]">
              <Heart size={22} className="fill-[#E98787]/20" />
            </div>
            <div className="space-y-1">
              <h3 className="font-display text-base font-bold text-[#343033] dark:text-white">
                Ваша история начинается сегодня
              </h3>
              <p className="text-xs text-[#777277] dark:text-[#B8B2B5] max-w-xs mx-auto leading-relaxed">
                Здесь будут бережно сохраняться парные кадры, реакция за реакцией, день за днём.
              </p>
            </div>
          </div>
        </div>
      ) : viewMode === 'stream' ? (
        <div className="space-y-7">
          {displayHistory.map((day) => {
            const isDayUnlocked = !day.isLocked || isUnlockedGlobally;

            return (
              <div key={day.id} className="space-y-3.5">
                <div className="flex items-center gap-2.5 pt-1">
                  <div className="w-2 h-2 rounded-full bg-[#E98787]" />
                  <h2 className="font-display text-base font-bold text-[#343033] dark:text-white tracking-tight">
                    {day.title}
                  </h2>
                  <span className="text-xs text-[#777277] dark:text-[#A8A0A6]">
                    · {day.dateStr}
                  </span>
                  <div className="flex-1 h-px bg-[#EBE3E5] dark:bg-[#242024] ml-2" />
                </div>

                <div className="space-y-4">
                  {day.moments.map((m, mIdx) => (
                    <HistoryMomentCard
                      key={m.id || mIdx}
                      moment={m}
                      isDayUnlocked={isDayUnlocked}
                      isUnlockedGlobally={isUnlockedGlobally}
                      couple={couple}
                      onPhotoClick={handlePhotoClick}
                      onOpenLovely={handleOpenLovely}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {!isUnlockedGlobally && (
            <div className="relative overflow-visible mt-4">
              <AtmosphericGlow variant="card" insetClassName="-inset-2 sm:-inset-2.5" roundedClassName="rounded-[28px]" />
              <div className="relative rounded-[24px] p-5 bg-[#FAF0F2]/90 dark:bg-[#1E1417]/90 backdrop-blur-md border border-[#F2D1D8] dark:border-[#382229] shadow-2xs text-center space-y-3 animate-in fade-in duration-200">
                <div className="w-10 h-10 mx-auto rounded-full bg-white dark:bg-[#2A161E] border border-[#F2D1D8] dark:border-[#42222B] flex items-center justify-center text-[#E98787] shadow-2xs">
                  <Sparkles size={18} />
                </div>
                <div className="space-y-1 max-w-xs mx-auto">
                  <h4 className="font-display text-base font-bold text-[#343033] dark:text-white">
                    Здесь начинается ваша более старая история
                  </h4>
                  <p className="text-xs text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                    С LOVELY все воспоминания старше 7 дней остаются с вами навсегда.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenLovely}
                  className="group relative w-full max-w-xs mx-auto h-[50px] xs:h-[52px] sm:h-[54px] px-6 rounded-full select-none overflow-hidden cursor-pointer transition-all duration-100 ease-out active:scale-[0.985] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E8BFC7] bg-[#FAF0F2] dark:bg-[#150F13] border border-[#E98787]/20 dark:border-[#E8BFC7]/15 shadow-[0_4px_20px_-4px_rgba(233,135,135,0.18)] dark:shadow-[0_4px_20px_-4px_rgba(0,0,0,0.4)] hover:border-[#E98787]/35 text-center flex items-center justify-center"
                  aria-label="Открыть LOVELY"
                >
                  <svg
                    viewBox="0 0 360 65"
                    preserveAspectRatio="xMidYMid slice"
                    className="absolute inset-0 w-full h-full pointer-events-none block"
                    aria-hidden="true"
                  >
                    <defs>
                      <radialGradient id="historyLovelyPillGlow" cx="45%" cy="40%" r="65%">
                        <stop offset="0%" stopColor="#E98787" stopOpacity="0.09" />
                        <stop offset="50%" stopColor="#FFDEE7" stopOpacity="0.03" />
                        <stop offset="100%" stopColor="#FAF0F2" stopOpacity="0" />
                      </radialGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#historyLovelyPillGlow)" />

                    <g opacity="0.25">
                      <circle cx="42" cy="42" r="1.1" fill="#E98787" />
                      <circle cx="135" cy="18" r="0.8" fill="#E98787" />
                      <circle cx="235" cy="45" r="0.9" fill="#E98787" />
                      <circle cx="315" cy="20" r="1.0" fill="#E98787" />
                    </g>
                  </svg>

                  <div className="relative z-10 flex items-center justify-center pointer-events-none">
                    <span className="font-display font-semibold text-[14.5px] xs:text-[15px] sm:text-[15.5px] tracking-tight text-[#343033] dark:text-white drop-shadow-xs whitespace-nowrap">
                      Открыть LOVELY
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3.5">
          {displayHistory.map((day, idx) => {
            const cardBgColor =
              idx % 3 === 0
                ? 'bg-[#EDF4FB]/70 dark:bg-[#141A22]'
                : idx % 3 === 1
                ? 'bg-[#FAF0F2]/70 dark:bg-[#1E1417]'
                : 'bg-[#FAF2EE]/70 dark:bg-[#1F1714]';

            return (
              <HistoryDayCard
                key={day.id}
                day={day}
                isUnlockedGlobally={isUnlockedGlobally}
                cardBgColor={cardBgColor}
                couple={couple}
                onSelectDay={handleSelectDay}
                onOpenLovely={handleOpenLovely}
              />
            );
          })}
        </div>
      )}

      <FullscreenPhotoViewer
        isOpen={Boolean(fullscreenPhoto)}
        onClose={handleCloseFullscreen}
        photoUrl={fullscreenPhoto?.url || null}
        title={fullscreenPhoto?.title}
      />
    </div>
  );
};
