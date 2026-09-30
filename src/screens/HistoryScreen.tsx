import React, { useState } from 'react';
import { HistoryDay, Moment, CoupleState, ReactionEmoji } from '../types';
import { Lock, ArrowLeft, Sparkles, Heart, Calendar, Layers, Image as ImageIcon } from 'lucide-react';
import { ReactionIcon } from '../components/ReactionIcon';
import { FullscreenPhotoViewer } from '../components/FullscreenPhotoViewer';
import { triggerHaptic, playSoftChime } from '../services/feedback';

interface HistoryScreenProps {
  history: HistoryDay[];
  todayMoments: Moment[];
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

function getPluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'день';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'дня';
  return 'дней';
}





export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  history,
  todayMoments,
  couple,
  onOpenPremium,
  onOpenLovely,
  onNavigateToToday: _onNavigateToToday,
}) => {
  const handleOpenLovely = onOpenLovely || onOpenPremium || (() => {});
  const [viewMode, setViewMode] = useState<'days' | 'stream'>('days');
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; title: string } | null>(null);

  // Filter out any legacy mock test IDs
  const cleanHistory = (history || []).filter(
    (d) =>
      d &&
      d.id &&
      !d.id.startsWith('hist-yesterday') &&
      !d.id.startsWith('hist-20-sep') &&
      !d.id.startsWith('hist-18-sep') &&
      !d.id.startsWith('hist-14-sep') &&
      !d.id.startsWith('hist-week-ago') &&
      !d.id.startsWith('hist-first-day')
  );

  // Completed / matched today moments from local state
  const completedTodayMoments = todayMoments.filter(
    (m) =>
      (m.status === 'COMPLETED' || m.status === 'REVEALED' || m.status === 'REACTED') &&
      Boolean(m.userPhoto || m.partnerPhoto)
  );

  const hasTodayInHistory = cleanHistory.some((d) => d.dateKey === 'today' || d.title === 'Сегодня');
  const hasRealContent = cleanHistory.length > 0 || completedTodayMoments.length > 0;

  // Combined history list: renders real history if available, otherwise empty
  const displayHistory: HistoryDay[] = hasRealContent
    ? [
        ...(!hasTodayInHistory && completedTodayMoments.length > 0
          ? [
              {
                id: 'hist-today-dynamic',
                title: 'Сегодня',
                subtitle: `${completedTodayMoments.length} ${getPluralMoments(completedTodayMoments.length)}`,
                dateStr: 'Сегодня',
                isLocked: false,
                moments: completedTodayMoments,
              },
            ]
          : []),
        ...cleanHistory,
      ]
    : [];

  const totalMomentsCount = displayHistory.reduce((acc, day) => acc + day.moments.length, 0);
  const totalDaysCount = displayHistory.length;

  const isUnlockedGlobally = couple.isLovely || couple.subscription === 'premium';
  const selectedDay = displayHistory.find((d) => d.id === selectedDayId);

  const handlePhotoClick = (url: string | null, authorName: string) => {
    if (!url) return;
    triggerHaptic(true);
    playSoftChime('tap', true);
    setFullscreenPhoto({ url, title: authorName });
  };

  /**
   * Renders the Signature OURS Couple Diptych Frame
   * Gracefully handles:
   * 1. Both photos available -> Romantic interlocking diptych with central heart talisman & reaction badges
   * 2. Only user's photo -> Elegant hero frame + poetic partner reflection placeholder
   * 3. Only partner's photo -> Poetic user placeholder + elegant partner hero frame
   */
  const renderCoupleDiptych = (moment: Moment, isDayLocked: boolean) => {
    const userPhoto = resolveUserPhoto(moment, couple.user.id);
    const partnerPhoto = resolvePartnerPhoto(moment, couple.user.id);
    const hasBoth = Boolean(userPhoto && partnerPhoto);

    if (isDayLocked && !isUnlockedGlobally) {
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
            onClick={handleOpenLovely}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#E98787] text-white text-xs font-semibold hover:bg-[#DE7676] active:scale-95 transition-all shadow-xs cursor-pointer"
          >
            <span>Открыть воспоминания</span>
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {/* The Couple Frame Diptych - Large Expressive Shared Memories */}
        <div className="relative grid grid-cols-2 gap-1.5 sm:gap-2 items-center">
          {/* User Photo Slot */}
          <div className="flex flex-col">
            {userPhoto ? (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handlePhotoClick(userPhoto, couple.user.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePhotoClick(userPhoto, couple.user.name);
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
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                />

                {/* Subtle author name tag */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-md text-white text-[10px] font-semibold tracking-tight pointer-events-none shadow-xs">
                  {couple.user.name}
                </div>

                {/* Floating Partner Reaction Badge on User's Photo */}
                {moment.partnerReaction && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-2 right-2 w-7.5 h-7.5 rounded-full bg-white/95 dark:bg-[#1E1A1E] shadow-sm border border-[#F0E6E8] dark:border-[#38262E] flex items-center justify-center transition-transform hover:scale-110 pointer-events-none"
                    title={`Реакция ${couple.partner.name}`}
                  >
                    <ReactionIcon reaction={moment.partnerReaction} size={16} />
                  </div>
                )}
              </div>
            ) : (
              /* Poetic placeholder when user photo is absent */
              <div className="aspect-[4/5] w-full rounded-[18px] sm:rounded-[20px] bg-[#FAF5F7] dark:bg-[#181316] border border-dashed border-[#EED7DC] dark:border-[#382329] flex flex-col items-center justify-center text-center p-3 text-[#777277] dark:text-[#A8A0A6]">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-[#201518] border border-[#F0DADE] dark:border-[#3A222A] flex items-center justify-center text-[#E98787] mb-2">
                  <Heart size={14} className="fill-[#E98787]/20" />
                </div>
                <span className="text-[11px] font-semibold text-[#343033] dark:text-white">
                  {couple.user.name}
                </span>
                <span className="text-[10px] text-[#8A8488] dark:text-[#A8A0A6] mt-0.5 leading-tight">
                  Кадр в сердце ✨
                </span>
              </div>
            )}
          </div>

          {/* Central Connecting Talisman (Shown when both photos are present) */}
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
                  handlePhotoClick(partnerPhoto, couple.partner.name);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    handlePhotoClick(partnerPhoto, couple.partner.name);
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
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-103"
                />

                {/* Subtle author name tag */}
                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/45 backdrop-blur-md text-white text-[10px] font-semibold tracking-tight pointer-events-none shadow-xs">
                  {couple.partner.name}
                </div>

                {/* Floating User Reaction Badge on Partner's Photo */}
                {moment.userReaction && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-2 right-2 w-7.5 h-7.5 rounded-full bg-white/95 dark:bg-[#1E1A1E] shadow-sm border border-[#F0E6E8] dark:border-[#38262E] flex items-center justify-center transition-transform hover:scale-110 pointer-events-none"
                    title={`Реакция ${couple.user.name}`}
                  >
                    <ReactionIcon reaction={moment.userReaction} size={16} />
                  </div>
                )}
              </div>
            ) : (
              /* Poetic placeholder when partner photo is absent */
              <div className="aspect-[4/5] w-full rounded-[18px] sm:rounded-[20px] bg-[#FAF5F7] dark:bg-[#181316] border border-dashed border-[#EED7DC] dark:border-[#382329] flex flex-col items-center justify-center text-center p-3 text-[#777277] dark:text-[#A8A0A6]">
                <div className="w-8 h-8 rounded-full bg-white dark:bg-[#201518] border border-[#F0DADE] dark:border-[#3A222A] flex items-center justify-center text-[#E98787] mb-2">
                  <Heart size={14} className="fill-[#E98787]/20" />
                </div>
                <span className="text-[11px] font-semibold text-[#343033] dark:text-white">
                  {couple.partner.name}
                </span>
                <span className="text-[10px] text-[#8A8488] dark:text-[#A8A0A6] mt-0.5 leading-tight">
                  Рядом в мыслях 🕊️
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quiet footer summary of shared reactions if present */}
        {(moment.userReaction || moment.partnerReaction) && (
          <div className="flex items-center justify-center gap-3 pt-1 text-[11px] text-[#777277] dark:text-[#A8A0A6]">
            {moment.userReaction && (
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-[#343033] dark:text-white">{couple.user.name}:</span>
                <ReactionIcon reaction={moment.userReaction} size={15} />
              </span>
            )}
            {moment.userReaction && moment.partnerReaction && (
              <span className="text-[#C8C2C5] dark:text-[#4A4047]" aria-hidden="true">·</span>
            )}
            {moment.partnerReaction && (
              <span className="inline-flex items-center gap-1">
                <span className="font-medium text-[#343033] dark:text-white">{couple.partner.name}:</span>
                <ReactionIcon reaction={moment.partnerReaction} size={15} />
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // Day Detail View (Drilldown)
  if (selectedDay) {
    const isDayUnlocked = !selectedDay.isLocked || isUnlockedGlobally;

    return (
      <div className="flex-1 flex flex-col space-y-5 pb-8 min-h-full animate-in fade-in duration-200">
        {/* Detail Top Header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                triggerHaptic(true);
                setSelectedDayId(null);
              }}
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

        {/* Moments in this Day */}
        <div className="space-y-4">
          {selectedDay.moments.map((m, idx) => (
            <div
              key={m.id || idx}
              className="rounded-[24px] sm:rounded-[26px] p-2.5 sm:p-3 pb-3 sm:pb-3.5 bg-white dark:bg-[#141215] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs space-y-2.5 transition-all"
            >
              {/* Moment Prompt & Order Header */}
              <div className="flex items-start justify-between gap-2 px-1 pt-0.5">
                <div className="space-y-0.5">
                  <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#E98787] dark:text-[#F0B9C6] uppercase tracking-wider">
                    <Sparkles size={11} />
                    <span>{m.label || `МОМЕНТ ${m.order || idx + 1}`}</span>
                  </div>
                  <h3 className="font-display text-[15px] sm:text-base font-bold text-[#343033] dark:text-white leading-snug">
                    {m.prompt}
                  </h3>
                </div>
                {m.completedAt && (
                  <span className="text-xs font-semibold text-[#8C858A] dark:text-[#A8A0A6] shrink-0 pt-0.5 tabular-nums">
                    {m.completedAt}
                  </span>
                )}
              </div>

              {/* The Signature Duo Diptych */}
              {renderCoupleDiptych(m, !isDayUnlocked)}
            </div>
          ))}
        </div>

        {/* Fullscreen Photo Viewer */}
        <FullscreenPhotoViewer
          isOpen={Boolean(fullscreenPhoto)}
          onClose={() => setFullscreenPhoto(null)}
          photoUrl={fullscreenPhoto?.url || null}
          title={fullscreenPhoto?.title}
        />
      </div>
    );
  }

  // Main History View
  return (
    <div className="flex-1 flex flex-col space-y-5 pb-8 min-h-full">
      {/* Top Header & Quiet Couple Metadata */}
      <div className="space-y-2 pt-1">
        <div className="flex items-end justify-between gap-3">
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

          {/* Clean Segmented View Mode Toggle (Stream vs Days) */}
          {displayHistory.length > 0 && (
            <div className="flex items-center gap-1 p-1 rounded-full bg-[#F5EFF1] dark:bg-[#1E1A1D] border border-[#EBE3E5] dark:border-[#282126] shadow-2xs shrink-0">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(true);
                  setViewMode('days');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'days'
                    ? 'bg-white dark:bg-[#282025] text-[#343033] dark:text-white shadow-xs'
                    : 'text-[#777277] dark:text-[#A8A0A6] hover:text-[#343033] dark:hover:text-white'
                }`}
                title="По дням"
              >
                <Calendar size={13} className="shrink-0" />
                <span>По дням</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(true);
                  setViewMode('stream');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'stream'
                    ? 'bg-white dark:bg-[#282025] text-[#343033] dark:text-white shadow-xs'
                    : 'text-[#777277] dark:text-[#A8A0A6] hover:text-[#343033] dark:hover:text-white'
                }`}
                title="Лента моментов"
              >
                <Layers size={13} className="shrink-0" />
                <span>Лента</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {displayHistory.length === 0 ? (
        <div className="rounded-[28px] p-8 text-center bg-white/70 dark:bg-[#121212] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs space-y-3 my-6">
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
      ) : viewMode === 'stream' ? (
        /* ==================================================================== */
        /* MODE 1: VISUAL JOURNAL STREAM (Full Couple Moments Feed)             */
        /* ==================================================================== */
        <div className="space-y-7">
          {displayHistory.map((day) => {
            const isDayUnlocked = !day.isLocked || isUnlockedGlobally;

            return (
              <div key={day.id} className="space-y-3.5">
                {/* Day Chapter Header */}
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

                {/* Day's Moments Cards */}
                <div className="space-y-4">
                  {day.moments.map((m, mIdx) => (
                    <div
                      key={m.id || mIdx}
                      className="rounded-[24px] sm:rounded-[26px] p-2.5 sm:p-3 pb-3 sm:pb-3.5 bg-white dark:bg-[#141215] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs space-y-2.5 transition-all"
                    >
                      {/* Moment Title & Timestamp */}
                      <div className="flex items-start justify-between gap-2 px-1 pt-0.5">
                        <div className="space-y-0.5">
                          <div className="inline-flex items-center gap-1.5 text-[10.5px] font-bold text-[#E98787] dark:text-[#F0B9C6] uppercase tracking-wider">
                            <Sparkles size={11} />
                            <span>{m.label || `МОМЕНТ ${m.order || mIdx + 1}`}</span>
                          </div>
                          <h3 className="font-display text-[15px] sm:text-base font-bold text-[#343033] dark:text-white leading-snug">
                            {m.prompt}
                          </h3>
                        </div>
                        {m.completedAt && (
                          <span className="text-xs font-semibold text-[#8C858A] dark:text-[#A8A0A6] shrink-0 pt-0.5 tabular-nums">
                            {m.completedAt}
                          </span>
                        )}
                      </div>

                      {/* Couple Diptych View */}
                      {renderCoupleDiptych(m, !isDayUnlocked)}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Dedicated 7-day boundary reminder for Free tier */}
          {!isUnlockedGlobally && (
            <div className="rounded-[24px] p-5 bg-[#FAF0F2] dark:bg-[#1E1417] border border-[#F2D1D8] dark:border-[#382229] shadow-2xs text-center space-y-3 mt-4 animate-in fade-in duration-200">
              <div className="w-10 h-10 mx-auto rounded-full bg-white dark:bg-[#2A161E] border border-[#F2D1D8] dark:border-[#42222B] flex items-center justify-center text-[#E98787] shadow-2xs">
                <Sparkles size={18} />
              </div>
              <div className="space-y-1 max-w-xs mx-auto">
                <h4 className="font-display text-base font-bold text-[#343033] dark:text-white">
                  Здесь начинается ваша более старая история ✨
                </h4>
                <p className="text-xs text-[#777277] dark:text-[#B8B2B5] leading-relaxed">
                  С LOVELY все воспоминания старше 7 дней остаются с вами навсегда.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenLovely}
                className="inline-flex items-center justify-center px-5 py-2.5 rounded-full bg-[#E98787] text-white text-xs font-semibold hover:bg-[#DE7676] active:scale-98 transition-all shadow-xs cursor-pointer"
              >
                Открыть LOVELY
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ==================================================================== */
        /* MODE 2: CHAPTERS / DAYS COLLECTION (Compact Day Cards Grid)         */
        /* ==================================================================== */
        <div className="space-y-3.5">
          {displayHistory.map((day, idx) => {
            const isDayUnlocked = !day.isLocked || isUnlockedGlobally;
            const cardBgColor =
              idx % 3 === 0
                ? 'bg-[#EDF4FB]/70 dark:bg-[#141A22]'
                : idx % 3 === 1
                ? 'bg-[#FAF0F2]/70 dark:bg-[#1E1417]'
                : 'bg-[#FAF2EE]/70 dark:bg-[#1F1714]';

            return (
              <div
                key={day.id}
                onClick={() => {
                  triggerHaptic(true);
                  if (isDayUnlocked) {
                    setSelectedDayId(day.id);
                  } else {
                    handleOpenLovely();
                  }
                }}
                className={`rounded-[24px] p-4 sm:p-5 border border-[#EBE3E5] dark:border-[#242024] shadow-2xs transition-all duration-150 cursor-pointer active:scale-[0.99] hover:border-[#E98787]/50 ${cardBgColor}`}
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

                {/* Paired Preview of Moments in this Day */}
                {isDayUnlocked ? (
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    {day.moments.slice(0, 3).map((m, mIdx) => {
                      const uP = resolveUserPhoto(m, couple.user.id);
                      const pP = resolvePartnerPhoto(m, couple.user.id);

                      return (
                        <div
                          key={m.id || mIdx}
                          className="aspect-[4/3] rounded-[14px] overflow-hidden bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] relative shadow-2xs flex"
                        >
                          {uP && pP ? (
                            <div className="grid grid-cols-2 w-full h-full">
                              <img src={uP} alt="" className="w-full h-full object-cover border-r border-white/20" />
                              <img src={pP} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : uP || pP ? (
                            <img src={uP || pP!} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[#777277]">
                              <ImageIcon size={14} />
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
            );
          })}
        </div>
      )}

      {/* Fullscreen Photo Viewer Modal */}
      <FullscreenPhotoViewer
        isOpen={Boolean(fullscreenPhoto)}
        onClose={() => setFullscreenPhoto(null)}
        photoUrl={fullscreenPhoto?.url || null}
        title={fullscreenPhoto?.title}
      />
    </div>
  );
};
