import { Moment, HistoryDay } from '../../types/models';
import { AppState } from '../mockStorage';

export const MOMENT_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
export const MAX_DAILY_MOMENTS = 3;

export interface MomentAvailabilityInfo {
  completedCount: number;
  maxAllowedCount: number;
  isAllCompleted: boolean;
  nextOrder: 1 | 2 | 3 | null;
  isWaitingForNext: boolean;
  remainingCooldownMs: number;
  nextUnlockTimestamp: number | null;
  isNextMomentReady: boolean;
  unlockedOrderLimit: number;
}

/**
 * Returns local date key string YYYY-MM-DD
 */
export function getLocalDateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats Russian countdown:
 * e.g. "3 ч 42 мин", "45 мин 12 сек", "25 сек"
 */
export function formatRemainingTime(ms: number): string {
  if (ms <= 0) return '0 мин';
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours} ч ${minutes} мин`;
    }
    return `${hours} ч`;
  }
  if (minutes > 0) {
    return `${minutes} мин ${seconds} сек`;
  }
  return `${seconds} сек`;
}

/**
 * Formats a Russian date like "23 сентября 2026"
 */
export function formatRussianDate(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateKey;
  }
}

/**
 * Computes exact availability based on saved timestamps in todayMoments.
 * Authoritative source of truth that survives reload, page refresh, and tab switches.
 */
export function calculateMomentAvailability(
  todayMoments: Moment[],
  now: number = Date.now()
): MomentAvailabilityInfo {
  const completedMoments = todayMoments
    .filter((m) => m.status === 'COMPLETED')
    .sort((a, b) => a.order - b.order);

  const completedCount = completedMoments.length;
  const isAllCompleted = completedCount >= MAX_DAILY_MOMENTS;

  if (isAllCompleted) {
    return {
      completedCount,
      maxAllowedCount: MAX_DAILY_MOMENTS,
      isAllCompleted: true,
      nextOrder: null,
      isWaitingForNext: false,
      remainingCooldownMs: 0,
      nextUnlockTimestamp: null,
      isNextMomentReady: false,
      unlockedOrderLimit: 3,
    };
  }

  const nextOrder = (completedCount + 1) as 1 | 2 | 3;

  // Moment 1 is always available at the start of the day
  if (completedCount === 0) {
    return {
      completedCount: 0,
      maxAllowedCount: MAX_DAILY_MOMENTS,
      isAllCompleted: false,
      nextOrder: 1,
      isWaitingForNext: false,
      remainingCooldownMs: 0,
      nextUnlockTimestamp: null,
      isNextMomentReady: true,
      unlockedOrderLimit: 1,
    };
  }

  // Completed count is 1 or 2: check cooldown after last completed moment
  const lastCompletedMoment = completedMoments[completedMoments.length - 1];
  const lastCompletedTs =
    lastCompletedMoment.completedTimestamp ||
    (lastCompletedMoment.createdAt
      ? new Date(lastCompletedMoment.createdAt).getTime()
      : now);

  const nextUnlockTimestamp = lastCompletedTs + MOMENT_INTERVAL_MS;
  const remainingCooldownMs = Math.max(0, nextUnlockTimestamp - now);
  const isWaitingForNext = remainingCooldownMs > 0;
  const isNextMomentReady = !isWaitingForNext;

  // If waiting, the unlocked editable/active limit is completedCount.
  // If cooldown passed, the next moment is ready to be entered!
  const unlockedOrderLimit = isNextMomentReady ? nextOrder : completedCount;

  return {
    completedCount,
    maxAllowedCount: MAX_DAILY_MOMENTS,
    isAllCompleted: false,
    nextOrder,
    isWaitingForNext,
    remainingCooldownMs,
    nextUnlockTimestamp,
    isNextMomentReady,
    unlockedOrderLimit,
  };
}

/**
 * Natural, open, warm prompts that inspire a photo without feeling like a chore
 */
export const DAILY_PROMPTS_POOL: Array<{
  prompt: string;
  subtext: string;
  themeColor: 'peach' | 'pink' | 'blue';
}> = [
  {
    prompt: 'Покажи, что сейчас рядом с тобой',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Что сейчас перед твоими глазами?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Покажи маленькую часть своего дня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
];

export const EXTENDED_PROMPTS_LIST: string[] = [
  'Покажи, что сейчас рядом с тобой',
  'Что сейчас перед твоими глазами?',
  'Покажи маленькую часть своего дня',
  'Что хочется сохранить в памяти?',
  'Покажи место, где ты сейчас',
  'Что сегодня было рядом с тобой?',
  'Покажи то, на что сейчас хочется посмотреть',
  'Оставь кусочек своего дня для нас',
  'Что сейчас окружает тебя?',
  'Покажи свой сегодняшний момент',
  'Покажи что-нибудь, что сейчас с тобой',
  'Что хочется разделить со мной?',
];

export function createFreshDayMoments(pairId: string, dateKey: string): Moment[] {
  const nowIso = new Date().toISOString();
  return DAILY_PROMPTS_POOL.map((p, idx) => ({
    id: `moment-${pairId}-${dateKey}-${idx + 1}`,
    pairId,
    createdBy: 'user-a-default',
    createdAt: nowIso,
    dateKey,
    imageUrl: null,
    caption: null,
    order: (idx + 1) as 1 | 2 | 3,
    label: `МОМЕНТ ${idx + 1}`,
    prompt: p.prompt,
    subtext: p.subtext,
    status: 'EMPTY',
    themeColor: p.themeColor,
    userPhoto: null,
    partnerPhoto: null,
    userReaction: null,
    partnerReaction: null,
  }));
}

/**
 * Handles transition to a new calendar day:
 * - Resets daily moments counter to 0 (fresh 3 moments).
 * - Archives completed moments from previous days into history without data loss.
 * - Leaves existing history intact.
 */
export function syncAppStateForDate(state: AppState): AppState {
  const currentTodayKey = getLocalDateKey();
  const currentMomentsDateKey = state.todayMoments?.[0]?.dateKey;

  // If already on today's calendar date, return state as is
  if (currentMomentsDateKey === currentTodayKey) {
    return state;
  }

  // The calendar date has changed!
  // 1. Check if previous todayMoments has any completed moments
  const completedPrevious = state.todayMoments?.filter(
    (m) => m.status === 'COMPLETED'
  ) || [];

  let nextHistory = [...state.history];

  if (completedPrevious.length > 0 && currentMomentsDateKey) {
    // Check if an entry for this dateKey already exists in history
    const alreadyArchived = nextHistory.some(
      (h) => h.id === `hist-${currentMomentsDateKey}` || h.moments.some((m) => m.dateKey === currentMomentsDateKey)
    );

    if (!alreadyArchived) {
      const historyDay: HistoryDay = {
        id: `hist-${currentMomentsDateKey}`,
        title: formatRussianDate(currentMomentsDateKey),
        subtitle: `${completedPrevious.length} ${
          completedPrevious.length === 1
            ? 'момент'
            : completedPrevious.length < 5
            ? 'момента'
            : 'моментов'
        }`,
        dateStr: formatRussianDate(currentMomentsDateKey),
        isLocked: false,
        moments: completedPrevious,
      };
      nextHistory = [historyDay, ...nextHistory];
    }
  }

  // 2. Generate 3 fresh moments for currentTodayKey
  const pairId = state.couple?.inviteCode || 'pair-default-1';
  const freshMoments = createFreshDayMoments(pairId, currentTodayKey);

  return {
    ...state,
    todayMoments: freshMoments,
    activeMomentId: freshMoments[0].id,
    history: nextHistory,
  };
}
