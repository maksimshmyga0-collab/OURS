import { Moment, HistoryDay } from '../../types/models';
import { AppState } from '../storage/appStateStorage';

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
 * Formats a moment's MATCH timestamp strictly as:
 * HH:mm DD.MM.YY
 *
 * Examples:
 * 11:35 02.01.26
 * 09:42 28.09.26
 * 18:05 01.10.26
 * 23:17 31.12.26
 */
export function formatMatchCardTimestamp(
  input: Moment | string | number | Date | null | undefined
): string {
  if (!input) return '';

  let dateObj: Date | null = null;
  let explicitTimeStr: string | null = null;
  let fallbackDateKey: string | null = null;

  if (typeof input === 'object' && !(input instanceof Date)) {
    const moment = input as Moment;
    fallbackDateKey = moment.dateKey || null;

    // 1. Try completedTimestamp (numeric ms or ISO string)
    if (moment.completedTimestamp) {
      if (typeof moment.completedTimestamp === 'number') {
        const d = new Date(moment.completedTimestamp);
        if (!isNaN(d.getTime())) dateObj = d;
      } else if (typeof moment.completedTimestamp === 'string') {
        const d = parseDateTimeRobust(moment.completedTimestamp);
        if (d) dateObj = d;
      }
    }

    // 2. Try completedAt (ISO string or timestamp or time string)
    if (!dateObj && moment.completedAt) {
      const d = parseDateTimeRobust(moment.completedAt);
      if (d) {
        dateObj = d;
      } else if (/^\d{1,2}:\d{2}/.test(moment.completedAt)) {
        const match = moment.completedAt.match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          explicitTimeStr = `${match[1].padStart(2, '0')}:${match[2]}`;
        }
      }
    }

    // 3. Try createdAt
    if (!dateObj && moment.createdAt) {
      const d = parseDateTimeRobust(moment.createdAt);
      if (d) dateObj = d;
    }

    // 4. Combine explicitTimeStr with fallbackDateKey
    if (!dateObj && explicitTimeStr && fallbackDateKey && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDateKey)) {
      const [y, m, d] = fallbackDateKey.split('-').map(Number);
      const [hh, mm] = explicitTimeStr.split(':').map(Number);
      dateObj = new Date(y, m - 1, d, hh, mm, 0);
    }
  } else if (input instanceof Date) {
    if (!isNaN(input.getTime())) dateObj = input;
  } else if (typeof input === 'number') {
    const d = new Date(input);
    if (!isNaN(d.getTime())) dateObj = d;
  } else if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{2}:\d{2}\s\d{2}\.\d{2}\.\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = parseDateTimeRobust(trimmed);
    if (d) {
      dateObj = d;
    } else if (/^\d{1,2}:\d{2}/.test(trimmed)) {
      explicitTimeStr = trimmed;
    }
  }

  if (dateObj && !isNaN(dateObj.getTime())) {
    const hours = String(dateObj.getHours()).padStart(2, '0');
    const minutes = String(dateObj.getMinutes()).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const year = String(dateObj.getFullYear() % 100).padStart(2, '0');
    return `${hours}:${minutes} ${day}.${month}.${year}`;
  }

  if (fallbackDateKey && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDateKey)) {
    const [y, m, d] = fallbackDateKey.split('-').map(Number);
    const day = String(d).padStart(2, '0');
    const month = String(m).padStart(2, '0');
    const year = String(y % 100).padStart(2, '0');
    const time = explicitTimeStr || '12:00';
    return `${time} ${day}.${month}.${year}`;
  }

  return '';
}

function parseDateTimeRobust(raw: string): Date | null {
  if (!raw || typeof raw !== 'string') return null;
  const str = raw.trim();

  // Pattern: "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss"
  const spaceMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (spaceMatch) {
    const [, y, m, d, hh, mm, ss] = spaceMatch;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), ss ? Number(ss) : 0);
    if (!isNaN(date.getTime())) return date;
  }

  // Standard ISO parser
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;

  return null;
}

let serverTimeOffset = 0;

/**
 * Updates clock skew offset relative to authoritative server time
 */
export function updateServerTimeOffset(serverTimestamp: number): void {
  if (typeof serverTimestamp === 'number' && !isNaN(serverTimestamp)) {
    serverTimeOffset = serverTimestamp - Date.now();
  }
}

/**
 * Returns current timestamp corrected for device clock skew
 */
export function getSynchronizedNow(): number {
  return Date.now() + serverTimeOffset;
}

/**
 * Checks whether a moment has achieved completion for the current user.
 * A moment is completed for the current user if:
 * 1. It has status 'COMPLETED', OR
 * 2. Both photos are present AND this user has submitted their reaction (userReaction is set)
 */
export function isMomentMatchCompleted(m: Moment): boolean {
  if (m.status === 'COMPLETED') return true;
  if (
    Boolean(m.userPhoto && m.partnerPhoto) &&
    (m.status === 'REACTED' || Boolean(m.userReaction))
  ) {
    return true;
  }
  return false;
}

/**
 * Computes exact availability based on saved timestamps in todayMoments.
 * Authoritative source of truth that survives reload, page refresh, and tab switches.
 */
export function calculateMomentAvailability(
  todayMoments: Moment[],
  now: number = getSynchronizedNow()
): MomentAvailabilityInfo {
  const completedMoments = todayMoments
    .filter(isMomentMatchCompleted)
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
  const photoTimes = (lastCompletedMoment.photos || [])
    .map((p) => (p.createdAt ? new Date(p.createdAt).getTime() : 0))
    .filter((t) => !isNaN(t) && t > 0);

  const sharedPhotoMatchTs = photoTimes.length >= 2 ? Math.max(...photoTimes) : 0;

  const lastCompletedTs =
    lastCompletedMoment.completedTimestamp ||
    sharedPhotoMatchTs ||
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
  {
    prompt: 'Что сегодня вызвало у тебя улыбку?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Покажи место, где ты прямо сейчас',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Твой любимый вид или ракурс сегодня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Что сейчас у тебя в руках или на столе?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Покажи кусочек неба над тобой',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Что прямо сейчас создаёт твоё настроение?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Покажи то, на что тебе приятно смотреть',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Чашка кофе, чай или твой перерыв',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Наш момент',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'То, что напомнило тебе обо мне сегодня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Что окружает тебя прямо сейчас?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Твоя дорога или вид из окна',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Маленькая деталь, которую никто не заметил',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Твой уютный уголок сегодня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Что ты видишь, если поднимешь взгляд?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Твой любимый предмет прямо сейчас',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Как выглядит твой текущий момент?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Покажи то, что согревает тебя сегодня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'То, что лежит перед тобой',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Твоё пространство в эту минуту',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Маленькая радость сегодняшнего дня',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Что-то красивое, попавшееся на пути',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Снимок прямо сейчас — без подготовки',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Что хочется сохранить в памяти сегодня?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  },
  {
    prompt: 'Оставь кусочек своего дня для нас',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'blue',
  },
  {
    prompt: 'Покажи свой сегодняшний момент',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink',
  },
  {
    prompt: 'Что хочется разделить со мной прямо сейчас?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach',
  }
];

export function getPromptForPairMoment(pairId: string, dateKey: string, order: 1 | 2 | 3): {
  prompt: string;
  subtext: string;
  themeColor: 'peach' | 'pink' | 'blue';
} {
  let hash = 0;
  const seed = `${pairId || 'ours'}_${dateKey || 'today'}`;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  const baseIndex = Math.abs(hash);
  const promptIdx = (baseIndex + (order - 1) * 7) % DAILY_PROMPTS_POOL.length;
  return DAILY_PROMPTS_POOL[promptIdx];
}

export function createFreshDayMoments(pairId: string, dateKey: string, currentUserId: string = ''): Moment[] {
  const nowIso = new Date().toISOString();
  return ([1, 2, 3] as const).map((order) => {
    const promptData = getPromptForPairMoment(pairId, dateKey, order);
    return {
      id: `moment-${pairId}-${dateKey}-${order}`,
      pairId,
      createdBy: currentUserId || '',
      createdAt: nowIso,
      dateKey,
      imageUrl: null,
      caption: null,
      order,
      label: `МОМЕНТ ${order}`,
      prompt: promptData.prompt,
      subtext: promptData.subtext,
      status: 'EMPTY',
      themeColor: promptData.themeColor,
      userPhoto: null,
      partnerPhoto: null,
      userReaction: null,
      partnerReaction: null,
    };
  });
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

  // 2. Generate 3 fresh moments for currentTodayKey with unique prompts
  const pairId = state.couple?.id || state.couple?.inviteCode || 'pair-default-1';
  const freshMoments = createFreshDayMoments(pairId, currentTodayKey);

  return {
    ...state,
    todayMoments: freshMoments,
    activeMomentId: freshMoments[0].id,
    history: nextHistory,
  };
}
