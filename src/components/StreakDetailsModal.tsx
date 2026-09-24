import React, { useState } from 'react';
import { X, Flame, Sparkles, Share2, Check } from 'lucide-react';
import { CoupleStreakInfo } from '../types';
import { CoupleThreadView } from './CoupleThreadView';
import { copyToClipboard } from '../services/device/clipboard';

interface StreakDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  streakInfo: CoupleStreakInfo;
  partnerAName: string;
  partnerBName: string;
  pairSeed?: string;
}

export const StreakDetailsModal: React.FC<StreakDetailsModalProps> = ({
  isOpen,
  onClose,
  streakInfo,
  partnerAName,
  partnerBName,
  pairSeed = 'ours-couple-seed',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const {
    currentStreak,
    totalActiveDays,
    totalMoments,
    duoMomentsCount,
    isTodayActive,
    activeWeekDays,
  } = streakInfo;

  const handleShareClick = async () => {
    const text = `OURS · ${currentStreak > 0 ? `${currentStreak} дней серии` : 'Наша общая история'} · ${totalActiveDays} активных дней вместе`;
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#343033]/30 backdrop-blur-sm transition-opacity duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white border border-[#EBE3E5] rounded-t-[28px] sm:rounded-[24px] p-6 pb-8 shadow-[0_-4px_28px_rgba(0,0,0,0.08)] max-h-[90vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-4 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-[#FFF0E6] border border-[#FDE5D4] flex items-center justify-center text-[#E2765A]">
              <Flame size={20} className="fill-[#E2765A]/20" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#777277]">
                Общая серия
              </span>
              <h3 className="font-display text-lg font-bold text-[#343033]">
                Ваша история
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F5EFF1] hover:bg-[#EFE7E9] flex items-center justify-center text-[#777277] transition-all hover:text-[#343033] active:scale-95 cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Streak Counter Card */}
        <div className="rounded-[22px] bg-[#FAF5F7] border border-[#EBE3E5] p-4 text-center mb-4 shadow-2xs">
          <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-white border border-[#EBE3E5] mb-2 shadow-2xs">
            <Flame size={18} className="text-[#E2765A] fill-[#E2765A]/20" />
            <span className="font-display text-2xl font-bold text-[#343033]">
              {currentStreak > 0 ? `${currentStreak} ${currentStreak === 1 ? 'день' : currentStreak < 5 ? 'дня' : 'дней'}` : 'Новая серия'}
            </span>
          </div>

          <p className="text-xs text-[#777277] max-w-xs mx-auto leading-relaxed">
            {currentStreak > 0
              ? `${currentStreak} ${currentStreak === 1 ? 'день' : currentStreak < 5 ? 'дня' : 'дней'} подряд вы сохраняете свои моменты`
              : isTodayActive
              ? 'Сегодня первый день вашей новой серии'
              : 'Сегодня можно начать новую серию'}
          </p>

          {/* Weekly Dots Row */}
          <div className="mt-4 pt-3 border-t border-[#EBE3E5] flex items-center justify-between px-2">
            {activeWeekDays.map((d) => (
              <div key={d.dateKey} className="flex flex-col items-center gap-1.5">
                <span className={`text-[10px] ${d.isToday ? 'font-bold text-[#343033]' : 'text-[#777277]'}`}>
                  {d.dayLabel}
                </span>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    d.isActive
                      ? 'bg-[#E98787] text-white shadow-2xs'
                      : d.isToday
                      ? 'border border-dashed border-[#E98787] bg-white'
                      : 'bg-[#F2EAEC]/70'
                  }`}
                >
                  {d.isActive ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  ) : d.isToday ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#E98787]" />
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* «Наша нить» Section */}
        <div className="rounded-[22px] bg-white border border-[#EBE3E5] p-4 mb-4 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-[#E98787]" />
              <span className="font-display text-sm font-bold text-[#343033]">
                Наша нить
              </span>
            </div>
            <span className="text-[11px] text-[#777277]">
              {totalActiveDays} {totalActiveDays === 1 ? 'день' : totalActiveDays < 5 ? 'дня' : 'дней'} истории
            </span>
          </div>

          <p className="text-[11px] text-[#777277] mb-3 leading-relaxed">
            Уникальный узор вашей пары. Он развивается вместе с каждым сохранённым моментом и никогда не исчезает.
          </p>

          {/* SVG Thread Visualization */}
          <div className="rounded-[18px] bg-[#FAF5F7] border border-[#EBE3E5] p-2 mb-3">
            <CoupleThreadView
              seed={pairSeed}
              totalActiveDays={totalActiveDays}
              currentStreak={currentStreak}
              totalMoments={totalMoments}
              duoMomentsCount={duoMomentsCount}
              partnerAName={partnerAName}
              partnerBName={partnerBName}
            />
          </div>

          {/* Metrics summary */}
          <div className="grid grid-cols-3 gap-2 text-center pt-1">
            <div className="p-2 rounded-xl bg-[#FAF5F7] border border-[#EBE3E5]">
              <span className="block font-display text-sm font-bold text-[#343033]">
                {totalActiveDays}
              </span>
              <span className="text-[10px] text-[#777277]">
                активных дней
              </span>
            </div>
            <div className="p-2 rounded-xl bg-[#FAF5F7] border border-[#EBE3E5]">
              <span className="block font-display text-sm font-bold text-[#343033]">
                {totalMoments}
              </span>
              <span className="text-[10px] text-[#777277]">
                моментов
              </span>
            </div>
            <div className="p-2 rounded-xl bg-[#FAF5F7] border border-[#EBE3E5]">
              <span className="block font-display text-sm font-bold text-[#343033]">
                {duoMomentsCount}
              </span>
              <span className="text-[10px] text-[#777277]">
                общих взглядов
              </span>
            </div>
          </div>
        </div>

        {/* Share Button (Prepared entry point) */}
        <button
          type="button"
          onClick={handleShareClick}
          className="w-full py-3.5 px-4 rounded-[18px] bg-white border border-[#EBE3E5] flex items-center justify-center gap-2 text-xs font-semibold text-[#343033] transition-all hover:bg-[#FAF7F8] active:scale-98 cursor-pointer shadow-2xs"
        >
          {copied ? (
            <>
              <Check size={16} className="text-[#649A6E]" />
              <span>Скопировано в буфер обмена</span>
            </>
          ) : (
            <>
              <Share2 size={16} className="text-[#E98787]" />
              <span>Поделиться нитью</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
