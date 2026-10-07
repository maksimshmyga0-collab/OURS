import React, { useState, useMemo } from 'react';
import { X, Sparkles, Download, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { OursLogo } from './OursLogo';
import { CoupleSkyView } from './CoupleSkyView';
import {
  getCoupleMatchedDates,
  getCoupleSkyDates,
  getMatchedDatesForMonth,
  getSkyForMonth,
} from '../services/sky/skyService';
import { dateInvitationService } from '../services/dates/dateInvitationService';
import { exportSkyPolaroid } from '../services/sky/exportSkyPolaroid';
import { pluralizeWord } from '../services/gamification';
import { triggerHaptic, playSoftChime } from '../services/feedback';
import { Moment, HistoryDay, CoupleState } from '../types';

/**
 * Custom small glowing star icon (Касание / Match)
 */
export const SmallStarIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 14,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={`inline-block align-middle shrink-0 ${className}`}
    fill="none"
  >
    <circle cx="8" cy="8" r="7.5" fill="#E98787" fillOpacity="0.28" />
    <circle cx="8" cy="8" r="4.8" fill="#FFEED8" fillOpacity="0.75" />
    <circle cx="8" cy="8" r="2.8" fill="#FFFDF8" />
    <circle cx="8" cy="8" r="1.4" fill="#FFFFFF" />
  </svg>
);

/**
 * Custom 5-pointed glowing star icon (Свидание / Date)
 */
export const BigDateStarIcon: React.FC<{ size?: number; className?: string }> = ({
  size = 15,
  className = '',
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    className={`inline-block align-middle shrink-0 ${className}`}
    fill="none"
  >
    <circle cx="8" cy="8" r="7.5" fill="#E98787" fillOpacity="0.25" />
    <path
      d="M 8 1.8 L 9.85 5.55 L 14 6.16 L 11 9.08 L 11.71 13.2 L 8 11.25 L 4.29 13.2 L 5 9.08 L 2 6.16 L 6.15 5.55 Z"
      fill="#FFFDF8"
      stroke="#FFEED8"
      strokeWidth="0.8"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="8" r="1.4" fill="#FFFFFF" />
  </svg>
);

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
  onOpenPremium?: () => void;
  onOpenLovely?: () => void;
}

export const OurSkyModal: React.FC<OurSkyModalProps> = ({
  isOpen,
  onClose,
  couple,
  pairSeed,
  todayMoments = [],
  history = [],
  matchedDates: passedMatchedDates,
  onOpenPremium,
  onOpenLovely,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [showSkyPaywall, setShowSkyPaywall] = useState(false);

  const handleOpenPaywall = onOpenPremium || onOpenLovely || (() => {});
  const isLovely = Boolean(couple.isLovely || couple.subscription === 'premium');

  // Current calendar date anchor
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 - 12

  // Month navigation state
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Retrieve calendar days with completed/conducted dates (real, confirmed dates only)
  const completedDateDays = useMemo(() => {
    return dateInvitationService.getCompletedDateDays();
  }, [isOpen]);

  // All deduplicated sky dates (1 day = max 1 star: authentic match or confirmed date)
  const allSkyDates = useMemo(() => {
    return getCoupleSkyDates(couple, todayMoments, history, completedDateDays, now);
  }, [couple, todayMoments, history, completedDateDays, now]);

  // Determine available historical months + current month (strictly from real history & events)
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    // Always include current month
    set.add(`${currentYear}-${String(currentMonth).padStart(2, '0')}`);
    for (const d of allSkyDates) {
      if (d && d.length >= 7) {
        set.add(d.substring(0, 7));
      }
    }
    return Array.from(set).sort();
  }, [allSkyDates, currentYear, currentMonth]);

  const currentSelectedKey = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;
  const currentIdx = availableMonths.indexOf(currentSelectedKey);

  // Month navigation boundaries based on real history only
  const canGoPrev = currentIdx > 0;
  const canGoNext = currentIdx >= 0 && currentIdx < availableMonths.length - 1;

  const handlePrevMonth = () => {
    if (!canGoPrev || currentIdx <= 0) return;

    // Free model rule: Previous months require Premium
    if (!isLovely) {
      setShowSkyPaywall(true);
      triggerHaptic(true);
      return;
    }

    const targetKey = availableMonths[currentIdx - 1];
    const [y, m] = targetKey.split('-').map(Number);
    setSelectedYear(y);
    setSelectedMonth(m);
    setShowSkyPaywall(false);
    triggerHaptic(true);
  };

  const handleNextMonth = () => {
    if (!canGoNext || currentIdx >= availableMonths.length - 1) return;
    const targetKey = availableMonths[currentIdx + 1];
    const [y, m] = targetKey.split('-').map(Number);
    setSelectedYear(y);
    setSelectedMonth(m);
    setShowSkyPaywall(false);
    triggerHaptic(true);
  };

  // Determine if viewing the active current month
  const isCurrentMonth = selectedYear === currentYear && selectedMonth === currentMonth;

  // Sky dates in the currently selected month
  const monthSkyDates = useMemo(() => {
    return getMatchedDatesForMonth(allSkyDates, selectedYear, selectedMonth);
  }, [allSkyDates, selectedYear, selectedMonth]);

  const starsCount = monthSkyDates.length;
  const effectiveStarsCount = starsCount;

  const stablePairSeed = useMemo(() => {
    return couple.id ? `pair_${couple.id}` : (couple.pairSeed || pairSeed || couple.inviteCode || 'ours_pair');
  }, [couple.id, couple.pairSeed, couple.inviteCode, pairSeed]);

  // Generate deterministic sky state for selected month with moment & date differentiation
  const sky = useMemo(() => {
    return getSkyForMonth(
      stablePairSeed,
      selectedYear,
      selectedMonth,
      effectiveStarsCount,
      isCurrentMonth,
      monthSkyDates,
      completedDateDays
    );
  }, [
    stablePairSeed,
    selectedYear,
    selectedMonth,
    effectiveStarsCount,
    isCurrentMonth,
    monthSkyDates,
    completedDateDays,
  ]);

  // Download Polaroid Card
  const handleDownloadCard = async () => {
    if (isExporting) return;
    setIsExporting(true);
    triggerHaptic(true);
    playSoftChime('tap', true);

    try {
      const success = await exportSkyPolaroid(sky);
      if (success) {
        setDownloaded(true);
        triggerHaptic(true);
        playSoftChime('success', true);
        setTimeout(() => setDownloaded(false), 2600);
      }
    } catch (err) {
      console.error('[OURS] Export error:', err);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#000000]/70 backdrop-blur-[8px] animate-sheet-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FAF5F7] dark:bg-[#0E0D18] border border-[#EBE3E5] dark:border-[#262238] rounded-t-[32px] sm:rounded-[30px] p-6 pb-8 shadow-[0_-4px_36px_rgba(0,0,0,0.4)] max-h-[94vh] overflow-y-auto no-scrollbar animate-sheet-enter transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Title & Close */}
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#FAF0F2] dark:bg-[#1C182A] border border-[#EED7DC] dark:border-[#352D4C] flex items-center justify-center shrink-0 shadow-2xs">
              <OursLogo size={65} className="shrink-0" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#777277] dark:text-[#A9A1B8]">
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
            className="w-8 h-8 rounded-full bg-white dark:bg-[#1A162B] border border-[#EBE3E5] dark:border-[#2E2745] flex items-center justify-center text-[#777277] dark:text-[#B8B2C8] hover:text-[#343033] dark:hover:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
            title="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Month Selector Bar */}
        <div className="flex items-center justify-between px-3 py-2 rounded-[22px] bg-white/90 dark:bg-[#151224] border border-[#EBE3E5] dark:border-[#28223C] mb-3.5 shadow-2xs">
          <button
            type="button"
            onClick={handlePrevMonth}
            disabled={!canGoPrev}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              canGoPrev
                ? 'text-[#777277] dark:text-[#B8B2C8] hover:text-[#343033] dark:hover:text-white active:scale-95 cursor-pointer'
                : 'text-[#C5BFC2] dark:text-[#3C3650] cursor-not-allowed opacity-35'
            }`}
            title="Предыдущий месяц"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-center py-0.5">
            <span className="font-display text-sm font-bold text-[#343033] dark:text-white block leading-tight">
              {sky.title}
            </span>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            disabled={!canGoNext}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
              canGoNext
                ? 'text-[#777277] dark:text-[#B8B2C8] hover:text-[#343033] dark:hover:text-white active:scale-95 cursor-pointer'
                : 'text-[#C5BFC2] dark:text-[#3C3650] cursor-not-allowed opacity-35'
            }`}
            title="Следующий месяц"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Free Tier Past Months Prompt */}
        {showSkyPaywall && !isLovely && (
          <div className="rounded-[22px] p-4 bg-[#FAF0F2] dark:bg-[#1E141D] border border-[#F2D1D8] dark:border-[#3E2436] shadow-2xs text-center space-y-2.5 mb-3.5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-8 h-8 mx-auto rounded-full bg-white dark:bg-[#2A1626] border border-[#F2D1D8] dark:border-[#4B2842] flex items-center justify-center text-[#E98787] shadow-2xs">
              <Sparkles size={16} />
            </div>
            <div className="space-y-0.5 max-w-xs mx-auto">
              <h4 className="font-display text-sm font-bold text-[#343033] dark:text-white">
                Ваше небо продолжается ✨
              </h4>
              <p className="text-xs text-[#777277] dark:text-[#B8B2C8] leading-relaxed">
                Откройте Premium, чтобы увидеть предыдущие месяцы и всю историю ваших звёзд.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowSkyPaywall(false);
                handleOpenPaywall();
              }}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[#E98787] text-white text-xs font-semibold hover:bg-[#DE7676] active:scale-98 transition-all shadow-xs cursor-pointer"
            >
              Открыть Premium
            </button>
          </div>
        )}

        {/* Hero Canvas: Visual Sky */}
        <div className="my-2 flex flex-col items-center text-center">
          <CoupleSkyView sky={sky} compact={false} />

          {/* Calm emotional caption below the canvas */}
          <div className="mt-3.5 space-y-1">
            <h4 className="font-display text-base font-semibold text-[#343033] dark:text-white tracking-tight flex items-center justify-center gap-1.5">
              <span>{starsCount > 0 ? 'Ваше созвездие' : 'Ваше небо'}</span>
            </h4>
            <p className="text-xs text-[#777277] dark:text-[#A9A1B8] max-w-xs mx-auto leading-relaxed">
              Касания зажигают звёзды-точки, а проведённые свидания — большие звёзды.
            </p>
          </div>
        </div>

        {/* Status Summary Banner */}
        <div className="my-4 px-4 py-3 rounded-[22px] bg-white/95 dark:bg-[#151224] border border-[#EBE3E5] dark:border-[#28223C] text-center shadow-2xs flex items-center justify-center">
          {sky.starsCount === 0 ? (
            <p className="font-display text-xs sm:text-sm font-semibold text-[#777277] dark:text-[#B8B2C8] leading-snug">
              Пустое небо ждёт вашего первого общего момента.
            </p>
          ) : sky.dateStarsCount > 0 && sky.momentStarsCount > 0 ? (
            <div className="flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap font-display text-sm sm:text-[15px] font-bold text-[#343033] dark:text-white leading-snug tracking-tight">
              <span className="inline-flex items-center gap-1.5">
                <span>
                  {sky.momentStarsCount} {pluralizeWord(sky.momentStarsCount, 'касание', 'касания', 'касаний')}
                </span>
                <SmallStarIcon size={14} className="mb-0.5" />
              </span>
              <span className="text-[#E98787] dark:text-[#F0B9C6] font-normal text-xs sm:text-sm">и</span>
              <span className="inline-flex items-center gap-1.5">
                <span>
                  {sky.dateStarsCount} {pluralizeWord(sky.dateStarsCount, 'свидание', 'свидания', 'свиданий')}
                </span>
                <BigDateStarIcon size={15} className="mb-0.5" />
              </span>
            </div>
          ) : sky.dateStarsCount > 0 ? (
            <div className="flex items-center justify-center gap-1.5 font-display text-sm sm:text-[15px] font-bold text-[#343033] dark:text-white leading-snug tracking-tight">
              <span>
                {sky.dateStarsCount} {pluralizeWord(sky.dateStarsCount, 'свидание', 'свидания', 'свиданий')}
              </span>
              <BigDateStarIcon size={15} className="mb-0.5" />
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 font-display text-sm sm:text-[15px] font-bold text-[#343033] dark:text-white leading-snug tracking-tight">
              <span>
                {sky.momentStarsCount} {pluralizeWord(sky.momentStarsCount, 'касание', 'касания', 'касаний')}
              </span>
              <SmallStarIcon size={14} className="mb-0.5" />
            </div>
          )}
        </div>

        {/* Single Action Button: Скачать карточку */}
        <button
          type="button"
          onClick={handleDownloadCard}
          disabled={isExporting}
          className="w-full min-h-[48px] py-3.5 px-4 rounded-[22px] bg-white dark:bg-[#1A162B] border border-[#EBE3E5] dark:border-[#2E2745] flex items-center justify-center gap-2 text-xs font-semibold text-[#343033] dark:text-white transition-all hover:bg-[#FAF7F8] dark:hover:bg-[#221C38] active:scale-[0.98] cursor-pointer shadow-2xs disabled:opacity-60"
        >
          {downloaded ? (
            <>
              <Check size={16} className="text-[#649A6E]" />
              <span>Карточка скачана</span>
            </>
          ) : isExporting ? (
            <>
              <Sparkles size={16} className="text-[#E98787] animate-spin" />
              <span>Создание карточки...</span>
            </>
          ) : (
            <>
              <Download size={16} className="text-[#E98787]" />
              <span>Скачать карточку</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
