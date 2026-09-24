import React, { useState, useMemo } from 'react';
import { X, Sparkles, Share2, Check, ChevronLeft, ChevronRight, Moon } from 'lucide-react';
import { CoupleSkyView } from './CoupleSkyView';
import {
  getCoupleMatchedDates,
  getMatchedDatesForMonth,
  getSkyForMonth,
  getMonthNameRu,
} from '../services/sky/skyService';
import { copyToClipboard } from '../services/device/clipboard';
import { pluralizeWord } from '../services/gamification';
import { Moment, HistoryDay, CoupleState } from '../types';

export interface OurSkyModalProps {
  isOpen: boolean;
  onClose: () => void;
  couple: CoupleState;
  pairSeed: string;
  todayMoments?: Moment[];
  history?: HistoryDay[];
  matchedDates?: string[];
  partnerAName: string;
  partnerBName: string;
}

export const OurSkyModal: React.FC<OurSkyModalProps> = ({
  isOpen,
  onClose,
  couple,
  pairSeed,
  todayMoments = [],
  history = [],
  matchedDates: passedMatchedDates,
  partnerAName,
  partnerBName,
}) => {
  const [copied, setCopied] = useState(false);

  // Current calendar date anchor
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 - 12

  // Month navigation state
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // All deduplicated matched dates (1 day = max 1 star)
  const allMatchedDates = useMemo(() => {
    return getCoupleMatchedDates(couple, todayMoments, history, now);
  }, [couple, todayMoments, history, now, passedMatchedDates]);

  // Determine available historical months + current month
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    // Always include current month
    set.add(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
    for (const d of allMatchedDates) {
      if (d && d.length >= 7) {
        set.add(d.substring(0, 7));
      }
    }
    return Array.from(set).sort();
  }, [allMatchedDates, currentYear, currentMonth]);

  const currentSelectedKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const currentIdx = availableMonths.indexOf(currentSelectedKey);

  // Month navigation boundaries based on real history only
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx >= 0 && currentIdx < availableMonths.length - 1;

  const handlePrevMonth = () => {
    if (!canGoPrev || currentIdx <= 0) return;
    const targetKey = availableMonths[currentIdx - 1];
    const [y, m] = targetKey.split('-').map(Number);
    setSelectedYear(y);
    setSelectedMonth(m);
  };

  const handleNextMonth = () => {
    if (!canGoNext || currentIdx >= availableMonths.length - 1) return;
    const targetKey = availableMonths[currentIdx + 1];
    const [y, m] = targetKey.split('-').map(Number);
    setSelectedYear(y);
    setSelectedMonth(m);
  };

  // Determine if viewing the active current month
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;

  // Matched dates in the currently selected month
  const monthMatchedDates = useMemo(() => {
    return getMatchedDatesForMonth(allMatchedDates, selectedYear, selectedMonth);
  }, [allMatchedDates, selectedYear, selectedMonth]);

  const starsCount = monthMatchedDates.length;

  // Generate deterministic sky state for selected month
  const sky = useMemo(() => {
    return getSkyForMonth(pairSeed, selectedYear, selectedMonth, starsCount, isCurrentMonth);
  }, [pairSeed, selectedYear, selectedMonth, starsCount, isCurrentMonth]);

  const handleShareClick = async () => {
    const monthName = getMonthNameRu(selectedMonth);
    const starText = `${starsCount} ${pluralizeWord(starsCount, 'звезда', 'звезды', 'звёзд')}`;
    const text = `OURS · Наше небо за ${monthName} · ${starText} пары ${partnerAName} и ${partnerBName}`;
    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2400);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#000000]/50 backdrop-blur-[6px] animate-in fade-in duration-250 ease-out"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-[#111111] border border-[#EBE3E5] dark:border-[#242024] rounded-t-[32px] sm:rounded-[28px] p-6 pb-8 shadow-[0_-4px_32px_rgba(0,0,0,0.18)] max-h-[94vh] overflow-y-auto no-scrollbar animate-in slide-in-from-bottom-4 sm:zoom-in-[0.98] duration-300 ease-out transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Title & Close */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#FAF0F2] dark:bg-[#201518] border border-[#EED7DC] dark:border-[#382329] flex items-center justify-center text-[#E98787]">
              <Sparkles size={19} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#777277] dark:text-[#B8B2B5]">
                {isCurrentMonth ? 'Текущий месяц' : 'Архив неба'}
              </span>
              <h3 className="font-display text-lg font-bold text-[#343033] dark:text-white leading-tight">
                Наше небо
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F5EFF1] dark:bg-[#1E1C1E] border border-[#EBE3E5] dark:border-[#2A262A] flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="flex items-center justify-between px-2 py-1.5 rounded-2xl bg-[#FAF5F7] dark:bg-[#161416] border border-[#EBE3E5] dark:border-[#242024] mb-3">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Предыдущий месяц"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-center">
            <span className="font-display text-sm font-bold text-[#343033] dark:text-white block">
              {sky.title}
            </span>
            <span className="text-[10px] font-medium text-[#E98787] dark:text-[#F0B9C6]">
              {starsCount} {pluralizeWord(starsCount, 'звезда', 'звезды', 'звёзд')}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={!canGoNext}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              canGoNext
                ? 'text-[#777277] dark:text-[#B8B2B5] hover:text-[#343033] dark:hover:text-white active:scale-95 cursor-pointer'
                : 'text-[#C5BFC2] dark:text-[#4A4549] cursor-not-allowed opacity-40'
            }`}
            title="Следующий месяц"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Hero Canvas: Visual Sky */}
        <div className="my-2 flex flex-col items-center text-center">
          <CoupleSkyView sky={sky} compact={false} />

          {/* Calm emotional caption below the canvas */}
          <div className="mt-3.5 space-y-1">
            <h4 className="font-display text-base font-semibold text-[#343033] dark:text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>{starsCount > 3 ? sky.template.name : 'Ваше небо'}</span>
            </h4>
            <p className="text-xs text-[#777277] dark:text-[#B8B2B5] max-w-xs mx-auto leading-relaxed">
              {starsCount > 3 ? sky.template.meaning : 'Каждый день вместе зажигает новую звезду.'}
            </p>
          </div>
        </div>

        {/* Minimal Summary Badge (Restrained, not a dashboard) */}
        <div className="my-4 p-3 rounded-2xl bg-[#FAF5F7] dark:bg-[#161416] border border-[#EBE3E5] dark:border-[#242024] text-center">
          <p className="text-xs font-medium text-[#343033] dark:text-white leading-relaxed">
            {sky.statusText}
          </p>
        </div>

        {/* Share Button */}
        <button
          type="button"
          onClick={handleShareClick}
          className="w-full py-3.5 px-4 rounded-[18px] bg-white dark:bg-[#1A181A] border border-[#EBE3E5] dark:border-[#2D282D] flex items-center justify-center gap-2 text-xs font-semibold text-[#343033] dark:text-white transition-all hover:bg-[#FAF7F8] dark:hover:bg-[#221F22] active:scale-98 cursor-pointer shadow-2xs"
        >
          {copied ? (
            <>
              <Check size={16} className="text-[#649A6E]" />
              <span>Скопировано в буфер обмена</span>
            </>
          ) : (
            <>
              <Share2 size={16} className="text-[#E98787]" />
              <span>Поделиться небом</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
