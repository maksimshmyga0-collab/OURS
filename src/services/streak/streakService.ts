import { Moment, HistoryDay, CoupleStreakInfo, OurDayPhoto } from '../../types';

/**
 * Format date to YYYY-MM-DD
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Calculate calendar days together from pair creation date.
 * Calendar calculation: creation day is day 1 together.
 */
export function calculateDaysTogether(startDateOrCreatedAt: string | Date | undefined, fallback: number = 1): number {
  if (!startDateOrCreatedAt) return Math.max(1, fallback);
  try {
    const createdDate = new Date(startDateOrCreatedAt);
    if (isNaN(createdDate.getTime())) return Math.max(1, fallback);
    const now = new Date();

    const startMidnight = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const diffMs = todayMidnight.getTime() - startMidnight.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    return Math.max(1, diffDays + 1);
  } catch {
    return Math.max(1, fallback);
  }
}

/**
 * Subtract N days from date
 */
function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Check if a moment counts as active (has user photo or completed)
 */
function isMomentActive(m: Moment): boolean {
  return Boolean(
    m.status === 'COMPLETED' ||
    m.status === 'BOTH_UPLOADED' ||
    m.status === 'REVEALED' ||
    m.status === 'REACTED' ||
    m.userPhoto ||
    m.partnerPhoto ||
    (m.photos && m.photos.length > 0)
  );
}

/**
 * Extract per-day "Наш день" (OUR_DAY) activity without constructing synthetic Moment objects
 */
function extractOurDayActivityByDate(
  ourDayPhotos: OurDayPhoto[],
  fallbackDateKey: string
): Map<string, { isDuo: boolean }> {
  const result = new Map<string, { isDuo: boolean }>();
  if (!Array.isArray(ourDayPhotos) || ourDayPhotos.length === 0) {
    return result;
  }

  const authorsByDay = new Map<string, Set<string>>();
  for (const p of ourDayPhotos) {
    if (!p || !p.imageUrl || p.imageUrl.startsWith('blob:')) continue;
    const dKey =
      p.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(p.dateKey.trim())
        ? p.dateKey.trim()
        : fallbackDateKey;
    const authorKey = (p.authorId || p.authorName || 'user').trim();
    if (!authorsByDay.has(dKey)) {
      authorsByDay.set(dKey, new Set());
    }
    if (authorKey) {
      authorsByDay.get(dKey)!.add(authorKey);
    }
  }

  for (const [dKey, authors] of authorsByDay.entries()) {
    result.set(dKey, { isDuo: authors.size >= 2 });
  }

  return result;
}

/**
 * Calculate streak and historical metrics across todayMoments, history, and ourDayPhotos
 */
export function calculateCoupleStreak(
  todayMoments: Moment[],
  history: HistoryDay[],
  referenceDate: Date = new Date(),
  ourDayPhotos: OurDayPhoto[] = []
): CoupleStreakInfo {
  // Aggregate all unique moments grouped by dateKey
  const seenMomentIds = new Set<string>();
  const momentsByDate: Record<string, Moment[]> = {};

  const addMomentIfUnique = (m: Moment, fallbackDateKey: string) => {
    if (!isMomentActive(m)) return;

    // Use moment ID or canonical (dateKey + order) as unique identifier
    const canonicalKey = m.id || `${m.dateKey || fallbackDateKey}_${m.order || 1}`;
    if (seenMomentIds.has(canonicalKey)) {
      return; // Already counted this moment
    }
    seenMomentIds.add(canonicalKey);

    const dKey = m.dateKey || fallbackDateKey;
    if (!momentsByDate[dKey]) {
      momentsByDate[dKey] = [];
    }
    momentsByDate[dKey].push(m);
  };

  // 1. Process today's moments
  const todayKey = formatDateKey(referenceDate);
  for (const m of (todayMoments || [])) {
    if (m) addMomentIfUnique(m, todayKey);
  }

  // 2. Process history moments
  for (const day of (history || [])) {
    if (!day) continue;
    const dayKey = day.dateKey || todayKey;
    for (const moment of (day.moments || [])) {
      if (moment) addMomentIfUnique(moment, dayKey);
    }
  }

  // 3. Process "Наш день" (OUR_DAY) photos grouped by dateKey if not already in momentsByDate as OUR_DAY
  const ourDayRawByDate = extractOurDayActivityByDate(ourDayPhotos, todayKey);
  const ourDayExtraByDate = new Map<string, { isDuo: boolean }>();
  for (const [dKey, info] of ourDayRawByDate.entries()) {
    const existingList = momentsByDate[dKey] || [];
    const alreadyHasOurDay = existingList.some(
      (m) => m.label === 'НАШ ДЕНЬ' || m.prompt === 'Наш день'
    );
    if (!alreadyHasOurDay) {
      ourDayExtraByDate.set(dKey, info);
    }
  }

  const isDateActive = (key: string): boolean => {
    return Boolean(
      (momentsByDate[key] && momentsByDate[key].length > 0) ||
      ourDayExtraByDate.has(key)
    );
  };

  // Distinct active date keys sorted
  const allDateKeys = new Set<string>([
    ...Object.keys(momentsByDate),
    ...ourDayExtraByDate.keys(),
  ]);
  const activeDates = Array.from(allDateKeys).filter(isDateActive).sort();
  const totalActiveDays = activeDates.length;

  let totalMoments = 0;
  let duoMomentsCount = 0;
  let singleMomentsCount = 0;
  let daysWithOneMoment = 0;
  let daysWithTwoMoments = 0;
  let daysWithThreeMoments = 0;

  for (const dateKey of activeDates) {
    const list = momentsByDate[dateKey] || [];
    const extraOurDay = ourDayExtraByDate.get(dateKey);
    const dayTotalCount = list.length + (extraOurDay ? 1 : 0);

    totalMoments += dayTotalCount;
    if (dayTotalCount === 1) daysWithOneMoment++;
    else if (dayTotalCount === 2) daysWithTwoMoments++;
    else if (dayTotalCount >= 3) daysWithThreeMoments++;

    for (const m of list) {
      const distinctAuthors = Array.isArray(m.photos)
        ? new Set(m.photos.map((p: any) => p?.userId || p?.authorId).filter(Boolean)).size
        : 0;
      const hasBothPhotos = Boolean(
        (m.userPhoto && m.partnerPhoto) ||
        distinctAuthors >= 2 ||
        (Array.isArray(m.photos) && m.photos.length >= 2 && distinctAuthors === 0)
      );
      const isSanitizedCompleted =
        (m.status === 'COMPLETED' || m.status === 'REACTED') &&
        !m.userPhoto &&
        !m.partnerPhoto &&
        !m.imageUrl &&
        (!m.photos || m.photos.length === 0);

      const hasDuo =
        hasBothPhotos ||
        isSanitizedCompleted ||
        m.status === 'BOTH_UPLOADED' ||
        m.status === 'REVEALED' ||
        (Boolean(m.userReaction) && Boolean(m.partnerReaction)) ||
        ((m.status === 'COMPLETED' || m.status === 'REACTED') && hasBothPhotos);

      if (hasDuo) {
        duoMomentsCount++;
      } else {
        singleMomentsCount++;
      }
    }

    if (extraOurDay) {
      if (extraOurDay.isDuo) {
        duoMomentsCount++;
      } else {
        singleMomentsCount++;
      }
    }
  }

  // Calculate calendar streak
  const isTodayActive = isDateActive(todayKey);
  const yesterdayKey = formatDateKey(subDays(referenceDate, 1));
  const isYesterdayActive = isDateActive(yesterdayKey);

  let currentStreak = 0;

  if (isTodayActive) {
    // Today is active: count today + consecutive previous days
    currentStreak = 1;
    let step = 1;
    while (true) {
      const prevKey = formatDateKey(subDays(referenceDate, step));
      if (isDateActive(prevKey)) {
        currentStreak++;
        step++;
      } else {
        break;
      }
    }
  } else if (isYesterdayActive) {
    // Today is not active yet, but yesterday was active:
    // The active streak is kept alive waiting for today's moment!
    let step = 1;
    while (true) {
      const prevKey = formatDateKey(subDays(referenceDate, step));
      if (isDateActive(prevKey)) {
        currentStreak++;
        step++;
      } else {
        break;
      }
    }
  } else {
    // Gap day: previous streak ended. Current streak is 0 until today gets a moment.
    currentStreak = 0;
  }

  // Generate current calendar week row (Monday to Sunday)
  const dayOfWeek = referenceDate.getDay(); // 0 is Sunday, 1 is Monday, ...
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const mondayDate = new Date(referenceDate);
  mondayDate.setDate(referenceDate.getDate() + mondayOffset);

  const dayLabels = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const activeWeekDays = dayLabels.map((label, idx) => {
    const cur = new Date(mondayDate);
    cur.setDate(mondayDate.getDate() + idx);
    const key = formatDateKey(cur);
    return {
      dayLabel: label,
      dateKey: key,
      isActive: isDateActive(key),
      isToday: key === todayKey,
    };
  });

  return {
    currentStreak,
    totalActiveDays,
    totalMoments,
    duoMomentsCount,
    singleMomentsCount,
    daysWithOneMoment,
    daysWithTwoMoments,
    daysWithThreeMoments,
    isTodayActive,
    activeDates,
    activeWeekDays,
  };
}
