import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  RotateCcw,
  Eye,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';
import { CoupleSkyView } from './CoupleSkyView';
import {
  getCoupleMatchedDates,
  getMatchedDatesForMonth,
  getSkyForMonth,
  getMonthNameRu,
  getDaysInMonth,
} from '../services/sky/skyService';
import { CoupleState, HistoryDay, Moment } from '../types';

export interface DevSkyTesterModalProps {
  isOpen: boolean;
  onClose: () => void;
  couple: CoupleState;
  pairSeed: string;
  todayMoments: Moment[];
  history: HistoryDay[];
  onUpdateSimulatedDays: (count: number, year: number, month: number) => void;
  onOpenFullSky: () => void;
}

/**
 * Developer Tool: Stage 3 — «Наше небо» Testing Sandbox
 * Exclusively for Demo Mode.
 * Directly simulates matched calendar days and tests CoupleSkyView with real data flow.
 */
export const DevSkyTesterModal: React.FC<DevSkyTesterModalProps> = ({
  isOpen,
  onClose,
  couple,
  pairSeed,
  todayMoments,
  history,
  onUpdateSimulatedDays,
  onOpenFullSky,
}) => {
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Compute matched dates for the selected month from actual current history & today
  const allMatchedDates = useMemo(() => {
    return getCoupleMatchedDates(couple, todayMoments, history, now);
  }, [couple, todayMoments, history, now]);

  const monthMatchedDates = useMemo(() => {
    return getMatchedDatesForMonth(allMatchedDates, selectedYear, selectedMonth);
  }, [allMatchedDates, selectedYear, selectedMonth]);

  const starsCount = monthMatchedDates.length;
  const maxDays = getDaysInMonth(selectedYear, selectedMonth);
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;

  // Real sky state for the selected month and count
  const sky = useMemo(() => {
    return getSkyForMonth(pairSeed, selectedYear, selectedMonth, starsCount, isCurrentMonth);
  }, [pairSeed, selectedYear, selectedMonth, starsCount, isCurrentMonth]);

  if (!isOpen) return null;

  const handlePrevDay = () => {
    const nextCount = Math.max(0, starsCount - 1);
    onUpdateSimulatedDays(nextCount, selectedYear, selectedMonth);
  };

  const handleNextDay = () => {
    const nextCount = Math.min(maxDays, starsCount + 1);
    onUpdateSimulatedDays(nextCount, selectedYear, selectedMonth);
  };

  const handleAddStar = () => {
    handleNextDay();
  };

  const handleRemoveStar = () => {
    handlePrevDay();
  };

  const handleSetPreset = (target: number) => {
    const count = Math.min(maxDays, Math.max(0, target));
    onUpdateSimulatedDays(count, selectedYear, selectedMonth);
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#000000]/65 backdrop-blur-[8px] animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FAF7F9] dark:bg-[#12111A] border border-[#EBE3E5] dark:border-[#282436] rounded-[28px] p-5 shadow-2xl max-h-[92vh] overflow-y-auto no-scrollbar animate-in zoom-in-[0.98] duration-250 transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#F6DCE1] dark:bg-[#2D1B28] flex items-center justify-center text-[#E98787]">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#E98787]">
                Sandbox Test Mode
              </span>
              <h3 className="font-display text-base font-bold text-[#343033] dark:text-white leading-none">
                Тестирование «Нашего неба»
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white dark:bg-[#1E1C26] border border-[#EBE3E5] dark:border-[#332E40] flex items-center justify-center text-[#777277] dark:text-[#A6A0B0] hover:text-[#343033] dark:hover:text-white transition-all cursor-pointer shadow-xs active:scale-95"
          >
            <X size={17} />
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="flex items-center justify-between px-2.5 py-1.5 rounded-2xl bg-white dark:bg-[#191722] border border-[#EBE3E5] dark:border-[#2C2738] mb-3 shadow-2xs">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#777277] dark:text-[#A6A0B0] hover:text-[#343033] dark:hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Предыдущий месяц"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Calendar size={13} className="text-[#E98787]" />
            <span>
              {getMonthNameRu(selectedMonth)} {selectedYear}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-[#777277] dark:text-[#A6A0B0] hover:text-[#343033] dark:hover:text-white transition-all active:scale-95 cursor-pointer"
            title="Следующий месяц"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Live Sky Canvas Preview */}
        <div className="flex flex-col items-center justify-center mb-4">
          <div className="w-full max-w-[280px] aspect-square rounded-[24px] overflow-hidden border border-[#231F32] shadow-xl relative">
            <CoupleSkyView sky={sky} compact={false} />
            <div className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded-full bg-[#000000]/60 backdrop-blur-xs border border-white/10 text-[10px] font-mono font-medium text-white/90">
              {starsCount} / {maxDays} ★
            </div>
          </div>

          <div className="mt-2 text-center">
            <span className="text-xs font-bold text-[#343033] dark:text-white">
              {sky.title}
            </span>
            <p className="text-[11px] text-[#777277] dark:text-[#A6A0B0]">
              {sky.statusText}
            </p>
          </div>
        </div>

        {/* Current Test State Badge */}
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-[#FAF0F2] dark:bg-[#1E1622] border border-[#EED7DC] dark:border-[#382637] mb-3">
          <span className="text-xs font-bold text-[#E98787] flex items-center gap-1.5">
            <Layers size={14} />
            Тестовый день: {starsCount === 0 ? '0 (Пустое небо)' : starsCount}
          </span>
          <span className="text-[11px] font-medium text-[#777277] dark:text-[#BDB7C4]">
            {starsCount === 0
              ? 'Ожидает первый MATCH'
              : starsCount === 1
              ? '1 звезда зажжена'
              : `${starsCount} звёзд зажжено`}
          </span>
        </div>

        {/* Step-by-Step Simulation Controls */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={handlePrevDay}
            disabled={starsCount <= 0}
            className="py-2.5 px-3 rounded-xl bg-white dark:bg-[#1C1A26] border border-[#EBE3E5] dark:border-[#302B3E] hover:bg-[#FAF5F7] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          >
            <ChevronLeft size={15} className="text-[#777277]" />
            <span>← Предыдущий день</span>
          </button>

          <button
            type="button"
            onClick={handleNextDay}
            disabled={starsCount >= maxDays}
            className="py-2.5 px-3 rounded-xl bg-white dark:bg-[#1C1A26] border border-[#EBE3E5] dark:border-[#302B3E] hover:bg-[#FAF5F7] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          >
            <span>Следующий день →</span>
            <ChevronRight size={15} className="text-[#777277]" />
          </button>
        </div>

        {/* Quick Add / Remove Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <button
            type="button"
            onClick={handleAddStar}
            disabled={starsCount >= maxDays}
            className="py-2.5 px-3 rounded-xl bg-[#E98787] text-white hover:bg-[#DE7777] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
          >
            <Plus size={15} />
            <span>+1 звезда (MATCH)</span>
          </button>

          <button
            type="button"
            onClick={handleRemoveStar}
            disabled={starsCount <= 0}
            className="py-2.5 px-3 rounded-xl bg-white dark:bg-[#1C1A26] border border-[#EBE3E5] dark:border-[#302B3E] hover:bg-[#FAF5F7] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
          >
            <Minus size={15} />
            <span>-1 звезда</span>
          </button>
        </div>

        {/* Presets Grid */}
        <div className="mb-4">
          <span className="text-[11px] font-bold text-[#777277] dark:text-[#8E8799] uppercase tracking-wider block mb-2">
            Быстрые пресеты прогресса:
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: '0 дней', count: 0 },
              { label: '1 день', count: 1 },
              { label: '3 дня', count: 3 },
              { label: '7 дней', count: 7 },
              { label: '14 дней', count: 14 },
              { label: '21 день', count: 21 },
              { label: '28 дней', count: 28 },
              { label: 'Финал', count: maxDays },
            ].map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handleSetPreset(p.count)}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all active:scale-95 cursor-pointer border ${
                  starsCount === p.count
                    ? 'bg-[#E98787] text-white border-[#E98787] shadow-xs'
                    : 'bg-white dark:bg-[#1A1824] border-[#EBE3E5] dark:border-[#2D283A] text-[#343033] dark:text-[#D5D0E0] hover:bg-[#FAF5F7]'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Bottom Buttons */}
        <div className="space-y-2 pt-2 border-t border-[#EBE3E5] dark:border-[#272335]">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenFullSky();
            }}
            className="w-full py-3 px-4 rounded-xl bg-white dark:bg-[#1E1C28] border border-[#EBE3E5] dark:border-[#332E42] text-xs font-semibold text-[#343033] dark:text-white flex items-center justify-center gap-2 hover:bg-[#FAF5F7] transition-all cursor-pointer active:scale-98 shadow-2xs"
          >
            <Eye size={15} className="text-[#E98787]" />
            <span>Открыть полное окно «Наше небо»</span>
          </button>

          <button
            type="button"
            onClick={() => onUpdateSimulatedDays(0, selectedYear, selectedMonth)}
            className="w-full py-2.5 px-4 rounded-xl text-xs font-medium text-[#8F8895] hover:text-[#5E5764] flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <RotateCcw size={13} />
            <span>Сбросить тест для этого месяца</span>
          </button>
        </div>
      </div>
    </div>
  );
};
