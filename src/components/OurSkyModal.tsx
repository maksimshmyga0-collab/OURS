import React, { useState, useMemo, useEffect } from 'react';
import { X, Sparkles, Download, Check } from 'lucide-react';
import { OursLogo } from './OursLogo';
import { CoupleSkyView } from './CoupleSkyView';
import { InteractiveSkyMap } from './InteractiveSkyMap';
import {
  getCoupleMatchedDates,
  getCoupleSkyDates,
  getMatchedDatesForMonth,
  getSkyForMonth,
  getCoupleStarEvents,
  StarEvent,
} from '../services/sky/skyService';
import { buildCelestialMomentsWithCoordinates } from '../services/sky/skyMomentsService';
import { dateInvitationService } from '../services/dates/dateInvitationService';
import { exportSkyPolaroid } from '../services/sky/exportSkyPolaroid';
import { pluralizeWord } from '../services/gamification';
import { triggerHaptic, playSoftChime } from '../services/feedback';
import { Moment, HistoryDay, CoupleState, OurDayPhoto } from '../types';

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
  isOpen?: boolean;
  onClose?: () => void;
  couple: CoupleState;
  pairSeed: string;
  todayMoments?: Moment[];
  history?: HistoryDay[];
  ourDayPhotos?: OurDayPhoto[];
  matchedDates?: string[];
  partnerAName: string;
  partnerBName: string;
  onOpenPremium?: () => void;
  onOpenLovely?: () => void;
  variant?: 'modal' | 'screen';
  isActive?: boolean;
}

export const OurSkyModal: React.FC<OurSkyModalProps> = ({
  isOpen = true,
  onClose = () => {},
  couple,
  pairSeed,
  todayMoments = [],
  history = [],
  ourDayPhotos = [],
  matchedDates: passedMatchedDates,
  onOpenPremium,
  onOpenLovely,
  variant = 'modal',
  isActive = true,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [dateSyncVersion, setDateSyncVersion] = useState(0);

  useEffect(() => {
    return dateInvitationService.subscribe(() => {
      setDateSyncVersion((v) => v + 1);
    });
  }, []);

  const handleOpenPaywall = onOpenPremium || onOpenLovely || (() => {});

  // Current calendar anchor
  const now = useMemo(() => new Date(), []);
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1 - 12

  // Retrieve calendar days with completed/conducted dates (real, confirmed dates only)
  const completedDateDays = useMemo(() => {
    return dateInvitationService.getCompletedDateDays(couple.id);
  }, [couple.id, isOpen, todayMoments, history, dateSyncVersion]);

  // All authoritative star events with exact type directly linked to memories
  const allStarEvents = useMemo(() => {
    return getCoupleStarEvents(couple, todayMoments, history, completedDateDays, now, ourDayPhotos);
  }, [couple, todayMoments, history, completedDateDays, now, ourDayPhotos]);

  // Exclude date stars since date functionality is currently paused
  const validStarEvents = useMemo(() => {
    return allStarEvents.filter((e) => e.starType !== 'date');
  }, [allStarEvents]);

  const stablePairSeed = useMemo(() => {
    return couple.id ? `pair_${couple.id}` : (couple.pairSeed || pairSeed || couple.inviteCode || 'ours_pair');
  }, [couple.id, couple.pairSeed, couple.inviteCode, pairSeed]);

  // Build unified persistent, organic celestial layout containing all moments across time
  const celestialData = useMemo(() => {
    return buildCelestialMomentsWithCoordinates(
      stablePairSeed,
      validStarEvents,
      history,
      todayMoments,
      ourDayPhotos,
      couple.user?.id
    );
  }, [
    stablePairSeed,
    validStarEvents,
    history,
    todayMoments,
    ourDayPhotos,
    couple.user?.id,
  ]);

  // Active celestial moments & lines: strictly excludes date stars
  const activeMoments = useMemo(() => {
    return celestialData.moments.filter((m) => m.starType !== 'date');
  }, [celestialData.moments]);

  const activeLines = useMemo(() => {
    return celestialData.lines;
  }, [celestialData.lines]);

  // Deterministic sky representation for Polaroid card download
  const sky = useMemo(() => {
    return getSkyForMonth(
      stablePairSeed,
      currentYear,
      currentMonth,
      activeMoments.length,
      true,
      activeMoments.map((m) => m.dateKey),
      completedDateDays,
      validStarEvents
    );
  }, [
    stablePairSeed,
    currentYear,
    currentMonth,
    activeMoments,
    completedDateDays,
    validStarEvents,
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

  if (!isOpen && variant !== 'screen') return null;

  const isScreen = variant === 'screen';

  if (isScreen) {
    return (
      <>
        <div className="flex-1 min-h-0 h-full w-full flex flex-col pb-1.5 sm:pb-2">
          {/* Top Compact Bar: Unified Infinite Sky & Actions */}
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 rounded-full bg-white/85 dark:bg-[#141224]/90 backdrop-blur-md border border-[#EBE3E5] dark:border-[#28223C] mb-2 shadow-2xs">
            <div className="flex items-center gap-2 px-1">
              <span className="font-display text-xs sm:text-sm font-bold text-[#343033] dark:text-white select-none flex items-center gap-1.5">
                <span>Наше звёздное небо</span>
              </span>

              <span className="text-[11px] text-[#777277] dark:text-[#A9A1B8] font-medium">
                • {activeMoments.length} {pluralizeWord(activeMoments.length, 'звезда', 'звезды', 'звёзд')}
              </span>
            </div>

            {/* Compact Quick Download Button */}
            <button
              type="button"
              onClick={handleDownloadCard}
              disabled={isExporting}
              className="h-7 px-3 rounded-full bg-[#FAF0F2] dark:bg-[#1E162B] border border-[#EED7DC] dark:border-[#382D50] flex items-center gap-1.5 text-[11px] font-semibold text-[#343033] dark:text-white hover:border-[#E98787]/50 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
              title="Скачать карточку неба"
              aria-label="Скачать карточку неба"
            >
              {downloaded ? (
                <>
                  <Check size={13} className="text-[#649A6E]" />
                  <span className="text-[10px]">Скачано</span>
                </>
              ) : isExporting ? (
                <>
                  <Sparkles size={13} className="text-[#E98787] animate-spin" />
                  <span className="text-[10px]">Экспорт...</span>
                </>
              ) : (
                <>
                  <Download size={13} className="text-[#E98787]" />
                  <span className="text-[10px]">Карточка</span>
                </>
              )}
            </button>
          </div>

          {/* Interactive Celestial Memory Map Filling Maximum Available Screen Space */}
          <div className="flex-1 min-h-0 w-full h-full relative">
            <InteractiveSkyMap
              moments={activeMoments}
              lines={activeLines}
              onOpenLockedMoment={handleOpenPaywall}
              isActive={isActive}
              className="w-full h-full"
            />
          </div>
        </div>
      </>
    );
  }

  // Modal Sheet Variant
  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#000000]/70 backdrop-blur-[8px] animate-sheet-backdrop"
        onClick={onClose}
      >
        <div
          className="w-full max-w-md bg-[#FAF5F7] dark:bg-[#0E0D18] border border-[#EBE3E5] dark:border-[#262238] rounded-t-[32px] sm:rounded-[30px] p-4 sm:p-5 shadow-[0_-4px_36px_rgba(0,0,0,0.4)] flex flex-col h-[82vh] max-h-[88vh] animate-sheet-enter transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Top Bar in Modal */}
          <div className="shrink-0 flex items-center justify-between px-3 py-1.5 rounded-full bg-white/90 dark:bg-[#151224] border border-[#EBE3E5] dark:border-[#28223C] mb-2.5 shadow-2xs">
            <div className="flex items-center gap-2 px-1">
              <span className="font-display text-xs sm:text-sm font-bold text-[#343033] dark:text-white px-1 select-none flex items-center gap-1.5">
                <span>Наше звёздное небо</span>
              </span>
              <span className="text-[11px] text-[#777277] dark:text-[#A9A1B8] font-medium">
                • {activeMoments.length} {pluralizeWord(activeMoments.length, 'звезда', 'звезды', 'звёзд')}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDownloadCard}
                disabled={isExporting}
                className="h-7 px-2.5 rounded-full bg-[#FAF0F2] dark:bg-[#1E162B] border border-[#EED7DC] dark:border-[#382D50] flex items-center gap-1 text-[11px] font-semibold text-[#343033] dark:text-white hover:border-[#E98787]/50 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-60"
                title="Скачать карточку"
              >
                {downloaded ? (
                  <Check size={13} className="text-[#649A6E]" />
                ) : (
                  <Download size={13} className="text-[#E98787]" />
                )}
                <span className="text-[10px]">Карточка</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 rounded-full bg-white dark:bg-[#1A162B] border border-[#EBE3E5] dark:border-[#2E2745] flex items-center justify-center text-[#777277] dark:text-[#B8B2C8] hover:text-[#343033] dark:hover:text-white transition-all active:scale-95 cursor-pointer shadow-2xs"
                title="Закрыть"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Large Interactive Map in Modal */}
          <div className="flex-1 min-h-0 w-full h-full relative">
            <InteractiveSkyMap
              moments={activeMoments}
              lines={activeLines}
              onOpenLockedMoment={handleOpenPaywall}
              isActive={isActive}
              className="w-full h-full"
            />
          </div>
        </div>
      </div>
    </>
  );
};
