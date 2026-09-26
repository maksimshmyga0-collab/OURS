import React, { useState } from 'react';
import { HistoryDay, Moment, CoupleState } from '../types';
import { PastelCard } from '../components/PastelCard';
import { Lock, ArrowLeft, Sparkles } from 'lucide-react';
import { ReactionIcon } from '../components/ReactionIcon';
import { FullscreenPhotoViewer } from '../components/FullscreenPhotoViewer';

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
  return null;
}

function resolveMomentThumbnail(m: Moment, currentUserId?: string): string | null {
  return resolveUserPhoto(m, currentUserId) || resolvePartnerPhoto(m, currentUserId) || m.imageUrl || m.photos?.[0]?.imageUrl || null;
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
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<{ url: string; title: string } | null>(null);

  // Filter out any legacy test/mock IDs if any
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

  // Completed/matched today moments from local state
  const completedTodayMoments = todayMoments.filter(
    (m) => (m.status === 'COMPLETED' || m.status === 'REVEALED' || m.status === 'REACTED') && Boolean(m.userPhoto && m.partnerPhoto)
  );

  const hasTodayInHistory = cleanHistory.some((d) => d.dateKey === 'today' || d.title === 'Сегодня');

  // Combined real history days list
  const displayHistory: HistoryDay[] = [
    ...(!hasTodayInHistory && completedTodayMoments.length > 0
      ? [
          {
            id: 'hist-today-dynamic',
            title: 'Сегодня',
            subtitle: `${completedTodayMoments.length} ${
              completedTodayMoments.length === 1 ? 'момент' : 'момента'
            }`,
            dateStr: 'Сегодня',
            isLocked: false,
            moments: completedTodayMoments,
          },
        ]
      : []),
    ...cleanHistory,
  ];

  const totalMomentsCount = displayHistory.reduce((acc, day) => acc + day.moments.length, 0);
  const selectedDay = displayHistory.find((d) => d.id === selectedDayId);

  // If a specific day is selected, show the Day Detail View
  if (selectedDay) {
    return (
      <div className="flex-1 flex flex-col space-y-6 pb-8 min-h-full animate-in fade-in duration-200">
        {/* Day Detail Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedDayId(null)}
            className="w-9 h-9 rounded-full bg-white dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#343033] dark:text-white hover:bg-[#FAF7F8] dark:hover:bg-[#252225] transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-[#343033] dark:text-white">
              {selectedDay.title}
            </h1>
            <p className="text-xs text-[#777277] dark:text-[#B8B2B5]">{selectedDay.dateStr}</p>
          </div>
        </div>

        {/* Day Moments List */}
        <div className="space-y-4">
          {selectedDay.moments.map((m) => {
            const cardColor =
              m.themeColor === 'blue' ? 'blue' : m.themeColor === 'pink' ? 'pink' : 'peach';

            const userPhoto = resolveUserPhoto(m, couple.user.id);
            const partnerPhoto = resolvePartnerPhoto(m, couple.user.id);

            return (
              <PastelCard key={m.id} color={cardColor} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-[#777277] dark:text-[#B8B2B5] uppercase">
                    {m.label}
                  </span>
                  {m.completedAt && (
                    <span className="text-[11px] text-[#777277] dark:text-[#B8B2B5]">
                      {m.completedAt}
                    </span>
                  )}
                </div>

                <h3 className="font-display text-base font-bold text-[#343033] dark:text-white">
                  {m.prompt}
                </h3>

                {/* Two photos & reactions */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* User Photo */}
                  <div className="flex flex-col items-center">
                    <div
                      onClick={() => userPhoto && setFullscreenPhoto({ url: userPhoto, title: couple.user.name })}
                      className={`relative w-full aspect-square rounded-[20px] overflow-hidden bg-white/70 dark:bg-[#181215] border border-[#F0E6E8] dark:border-[#242024] soft-card-shadow group ${
                        userPhoto ? 'cursor-pointer hover:border-[#F0B9C6]/60 dark:hover:border-[#42262E]' : ''
                      }`}
                      role={userPhoto ? 'button' : undefined}
                      tabIndex={userPhoto ? 0 : -1}
                      onKeyDown={(e) => {
                        if (userPhoto && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setFullscreenPhoto({ url: userPhoto, title: couple.user.name });
                        }
                      }}
                      aria-label={userPhoto ? `Открыть фото ${couple.user.name} на весь экран` : undefined}
                    >
                      {userPhoto ? (
                        <img
                          src={userPhoto}
                          alt={couple.user.name}
                          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-102"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#777277] dark:text-[#B8B2B5]">
                          Нет фото
                        </div>
                      )}
                      {m.partnerReaction && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white dark:bg-[#1E1C1E] shadow-xs border border-[#F0E6E8] dark:border-[#242024] flex items-center justify-center"
                        >
                          <ReactionIcon reaction={m.partnerReaction} size={18} />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-[#343033] dark:text-white mt-1.5">
                      {couple.user.name}
                    </span>
                  </div>

                  {/* Partner Photo */}
                  <div className="flex flex-col items-center">
                    <div
                      onClick={() => partnerPhoto && setFullscreenPhoto({ url: partnerPhoto, title: couple.partner.name })}
                      className={`relative w-full aspect-square rounded-[20px] overflow-hidden bg-white/70 dark:bg-[#181215] border border-[#F0E6E8] dark:border-[#242024] soft-card-shadow group ${
                        partnerPhoto ? 'cursor-pointer hover:border-[#F0B9C6]/60 dark:hover:border-[#42262E]' : ''
                      }`}
                      role={partnerPhoto ? 'button' : undefined}
                      tabIndex={partnerPhoto ? 0 : -1}
                      onKeyDown={(e) => {
                        if (partnerPhoto && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setFullscreenPhoto({ url: partnerPhoto, title: couple.partner.name });
                        }
                      }}
                      aria-label={partnerPhoto ? `Открыть фото ${couple.partner.name} на весь экран` : undefined}
                    >
                      {partnerPhoto ? (
                        <img
                          src={partnerPhoto}
                          alt={couple.partner.name}
                          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-102"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#777277] dark:text-[#B8B2B5]">
                          Нет фото
                        </div>
                      )}
                      {m.userReaction && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white dark:bg-[#1E1C1E] shadow-xs border border-[#F0E6E8] dark:border-[#242024] flex items-center justify-center"
                        >
                          <ReactionIcon reaction={m.userReaction} size={18} />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-[#343033] dark:text-white mt-1.5">
                      {couple.partner.name}
                    </span>
                  </div>
                </div>
              </PastelCard>
            );
          })}
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

  // Main History List
  return (
    <div className="flex-1 flex flex-col space-y-6 pb-8 min-h-full">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[#343033] dark:text-white">
          Ваша история
        </h1>
        <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
          {totalMomentsCount > 0
            ? `${totalMomentsCount} ${
                totalMomentsCount === 1
                  ? 'момент'
                  : totalMomentsCount < 5
                  ? 'момента'
                  : 'моментов'
              } вместе`
            : 'Только ваши реальные воспоминания'}
        </p>
      </div>

      {/* History Days Cards or Empty State */}
      {displayHistory.length === 0 ? (
        <div className="rounded-[28px] p-8 text-center bg-white/70 dark:bg-[#121212] border border-[#EBE3E5] dark:border-[#242024] shadow-2xs space-y-3 my-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#FAF0F2] dark:bg-[#201518] border border-[#EED7DC] dark:border-[#382329] flex items-center justify-center text-[#E98787]">
            <Sparkles size={22} />
          </div>
          <h3 className="font-display text-base font-bold text-[#343033] dark:text-white">
            Ваша история начинается сегодня
          </h3>
          <p className="text-xs text-[#777277] dark:text-[#B8B2B5] max-w-xs mx-auto leading-relaxed">
            Здесь будут бережно сохраняться все ваши завершённые моменты и фотографии.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayHistory.map((day, idx) => {
            const isUnlocked = !day.isLocked || couple.isLovely || couple.subscription === 'premium';

            // Pick distinct subtle soft pastel tints with dark surfaces
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
                  if (isUnlocked) {
                    setSelectedDayId(day.id);
                  } else {
                    handleOpenLovely();
                  }
                }}
                className={`rounded-[24px] p-5 border border-[#EBE3E5] dark:border-[#242024] shadow-2xs transition-all duration-150 cursor-pointer active:scale-[0.99] hover:border-[#E98787]/50 ${cardBgColor}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#343033] dark:text-white">
                      {day.title}
                    </h3>
                    <p className="text-xs text-[#777277] dark:text-[#B8B2B5] mt-0.5">
                      {day.subtitle}
                    </p>
                  </div>

                  {!isUnlocked && (
                    <span className="w-8 h-8 rounded-full bg-white/90 dark:bg-[#1A181A] border border-[#EBE3E5] dark:border-[#242024] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] shadow-2xs">
                      <Lock size={14} />
                    </span>
                  )}
                </div>

                {/* Previews with real moment photos */}
                {isUnlocked ? (
                  <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pt-1">
                    {day.moments.map((m, mIdx) => {
                      const photoUrl = resolveMomentThumbnail(m, couple.user.id);
                      return (
                        <div
                          key={m.id || mIdx}
                          className="w-16 h-16 rounded-[16px] overflow-hidden bg-white dark:bg-[#141214] border border-[#EBE3E5] dark:border-[#242024] shrink-0"
                        >
                          {photoUrl ? (
                            <img
                              src={photoUrl}
                              alt={m.prompt || "Касание"}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-[#FAF1F3] dark:bg-[#20181B] flex items-center justify-center text-[10px] text-[#777277]">
                              {m.order || mIdx + 1}
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
                          Этот момент сохранён
                        </p>
                        <p className="text-[10px] text-[#777277] dark:text-[#B8B2B5]">
                          Старше 7 дней · Доступен в LOVELY
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#E98787] underline whitespace-nowrap">
                      Стать LOVELY
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
