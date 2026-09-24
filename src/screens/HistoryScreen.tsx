import React, { useState } from 'react';
import { HistoryDay, Moment, CoupleState } from '../types';
import { PastelCard } from '../components/PastelCard';
import { PrimaryButton } from '../components/PrimaryButton';
import { Avatar } from '../components/Avatar';
import { Lock, ArrowLeft, Calendar, Sparkles, Heart } from 'lucide-react';

interface HistoryScreenProps {
  history: HistoryDay[];
  todayMoments: Moment[];
  couple: CoupleState;
  onOpenPremium: () => void;
  onNavigateToToday: () => void;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({
  history,
  todayMoments,
  couple,
  onOpenPremium,
  onNavigateToToday,
}) => {
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null);

  // Completed today moments
  const completedTodayMoments = todayMoments.filter((m) => m.status === 'COMPLETED');

  // Combined history list including today if any moments completed
  const displayHistory: HistoryDay[] = [
    ...(completedTodayMoments.length > 0
      ? [
          {
            id: 'hist-today-dynamic',
            title: 'Сегодня',
            subtitle: `${completedTodayMoments.length} ${
              completedTodayMoments.length === 1 ? 'момент' : 'момента'
            }`,
            dateStr: 'Сегодня, 23 сентября 2026',
            isLocked: false,
            moments: completedTodayMoments,
          },
        ]
      : []),
    ...history,
  ];

  const totalMomentsCount =
    displayHistory.reduce((acc, day) => acc + (day.isLocked ? 3 : day.moments.length), 0) + 33; // ~42 moments realistic mock

  const selectedDay = displayHistory.find((d) => d.id === selectedDayId);

  // If a specific day is selected, show the Day Detail View
  if (selectedDay) {
    return (
      <div className="space-y-6 pb-8 animate-in fade-in duration-200">
        {/* Day Detail Header */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSelectedDayId(null)}
            className="w-9 h-9 rounded-full bg-white border border-[#EBE3E5] flex items-center justify-center text-[#343033] hover:bg-[#FAF7F8] transition-all active:scale-95 cursor-pointer shadow-2xs"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-[#343033]">
              {selectedDay.title}
            </h1>
            <p className="text-xs text-[#777277]">{selectedDay.dateStr}</p>
          </div>
        </div>

        {/* Day Moments List */}
        <div className="space-y-4">
          {selectedDay.moments.map((m) => {
            const cardColor =
              m.themeColor === 'blue' ? 'blue' : m.themeColor === 'pink' ? 'pink' : 'peach';

            return (
              <PastelCard key={m.id} color={cardColor} className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold tracking-wider text-[#777277] uppercase">
                    {m.label}
                  </span>
                  {m.completedAt && (
                    <span className="text-[11px] text-[#777277]">
                      {m.completedAt}
                    </span>
                  )}
                </div>

                <h3 className="font-display text-base font-bold text-[#343033]">
                  {m.prompt}
                </h3>

                {/* Two photos & reactions */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {/* User Photo */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-full aspect-square rounded-[20px] overflow-hidden bg-white/70 border border-[#F0E6E8] soft-card-shadow">
                      {m.userPhoto ? (
                        <img
                          src={m.userPhoto}
                          alt={couple.user.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#777277]">
                          Нет фото
                        </div>
                      )}
                      {m.partnerReaction && (
                        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white shadow-xs border border-[#F0E6E8] flex items-center justify-center text-sm">
                          {m.partnerReaction}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-[#343033] mt-1.5">
                      {couple.user.name}
                    </span>
                  </div>

                  {/* Partner Photo */}
                  <div className="flex flex-col items-center">
                    <div className="relative w-full aspect-square rounded-[20px] overflow-hidden bg-white/70 border border-[#F0E6E8] soft-card-shadow">
                      {m.partnerPhoto ? (
                        <img
                          src={m.partnerPhoto}
                          alt={couple.partner.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#777277]">
                          Нет фото
                        </div>
                      )}
                      {m.userReaction && (
                        <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-white shadow-xs border border-[#F0E6E8] flex items-center justify-center text-sm">
                          {m.userReaction}
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-medium text-[#343033] mt-1.5">
                      {couple.partner.name}
                    </span>
                  </div>
                </div>
              </PastelCard>
            );
          })}
        </div>
      </div>
    );
  }

  // Main History List
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-[#343033]">
          Ваша история
        </h1>
        <p className="text-xs text-[#777277] mt-0.5">
          {totalMomentsCount} момента вместе
        </p>
      </div>

      {/* Empty State */}
      {displayHistory.length === 0 ? (
        <div className="rounded-[24px] bg-white border border-[#EBE3E5] p-8 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 rounded-full bg-[#FAF0F2] mx-auto flex items-center justify-center text-[#E98787]">
            <Heart size={20} />
          </div>
          <div className="space-y-1">
            <h3 className="font-display text-base font-bold text-[#343033]">
              Здесь появится ваша история
            </h3>
            <p className="text-xs text-[#777277]">
              Первый момент уже может стать началом.
            </p>
          </div>
          <PrimaryButton variant="coral" onClick={onNavigateToToday}>
            Создать момент
          </PrimaryButton>
        </div>
      ) : (
        /* History Days Cards */
        <div className="space-y-3">
          {displayHistory.map((day, idx) => {
            const isUnlocked = !day.isLocked || couple.subscription === 'premium';

            // Pick distinct subtle soft pastel tints
            const cardBgColor =
              idx % 3 === 0 ? 'bg-[#EDF4FB]/70' : idx % 3 === 1 ? 'bg-[#FAF0F2]/70' : 'bg-[#FAF2EE]/70';

            return (
              <div
                key={day.id}
                onClick={() => {
                  if (isUnlocked) {
                    setSelectedDayId(day.id);
                  } else {
                    onOpenPremium();
                  }
                }}
                className={`rounded-[24px] p-5 border border-[#EBE3E5] shadow-2xs transition-all duration-150 cursor-pointer active:scale-[0.99] hover:border-[#E98787]/50 ${cardBgColor}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-display text-base font-bold text-[#343033]">
                      {day.title}
                    </h3>
                    <p className="text-xs text-[#777277] mt-0.5">
                      {day.subtitle}
                    </p>
                  </div>

                  {!isUnlocked && (
                    <span className="w-8 h-8 rounded-full bg-white/90 border border-[#EBE3E5] flex items-center justify-center text-[#777277] shadow-2xs">
                      <Lock size={14} />
                    </span>
                  )}
                </div>

                {/* Previews or Locked notice */}
                {isUnlocked ? (
                  <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar pt-1">
                    {day.moments.map((m, mIdx) => (
                      <div
                        key={mIdx}
                        className="w-16 h-16 rounded-[16px] overflow-hidden bg-white border border-[#EBE3E5] shrink-0"
                      >
                        {m.userPhoto ? (
                          <img
                            src={m.userPhoto}
                            alt="moment"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-[#FAF1F3]" />
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[18px] bg-white p-3.5 border border-[#EBE3E5] flex items-center justify-between gap-3 mt-1 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <Lock size={15} className="text-[#E98787] shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-[#343033]">
                          Этот момент сохранён
                        </p>
                        <p className="text-[10px] text-[#777277]">
                          Старше 7 дней · Доступен в OURS Память
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-[#E98787] underline whitespace-nowrap">
                      Открыть историю
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
