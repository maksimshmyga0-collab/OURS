import { Moment, HistoryDay, CoupleStreakInfo } from '../../types';

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
 * Calculate streak and historical metrics across todayMoments and history
 */
export function calculateCoupleStreak(
  todayMoments: Moment[],
  history: HistoryDay[],
  referenceDate: Date = new Date()
): CoupleStreakInfo {
  // Aggregate all moments grouped by dateKey
  const momentsByDate: Record<string, Moment[]> = {};

  // 1. Process today's moments
  const todayKey = formatDateKey(referenceDate);
  const activeTodayMoments = todayMoments.filter(isMomentActive);
  if (activeTodayMoments.length > 0) {
    momentsByDate[todayKey] = activeTodayMoments;
  }

  // 2. Process history moments
  for (const day of history) {
    for (const moment of day.moments) {
      if (isMomentActive(moment)) {
        const key = moment.dateKey || formatDateKey(new Date(moment.createdAt || referenceDate));
        if (!momentsByDate[key]) {
          momentsByDate[key] = [];
        }
        momentsByDate[key].push(moment);
      }
    }
  }

  // Distinct active date keys sorted
  const activeDates = Object.keys(momentsByDate).sort();
  const totalActiveDays = activeDates.length;

  let totalMoments = 0;
  let duoMomentsCount = 0;
  let singleMomentsCount = 0;
  let daysWithOneMoment = 0;
  let daysWithTwoMoments = 0;
  let daysWithThreeMoments = 0;

  for (const dateKey of activeDates) {
    const list = momentsByDate[dateKey];
    totalMoments += list.length;
    if (list.length === 1) daysWithOneMoment++;
    else if (list.length === 2) daysWithTwoMoments++;
    else if (list.length >= 3) daysWithThreeMoments++;

    for (const m of list) {
      const hasDuo =
        (Boolean(m.userPhoto) && Boolean(m.partnerPhoto)) ||
        (m.photos && m.photos.length >= 2);
      if (hasDuo) {
        duoMomentsCount++;
      } else {
        singleMomentsCount++;
      }
    }
  }

  // Calculate calendar streak
  const isTodayActive = Boolean(momentsByDate[todayKey] && momentsByDate[todayKey].length > 0);
  const yesterdayKey = formatDateKey(subDays(referenceDate, 1));
  const isYesterdayActive = Boolean(momentsByDate[yesterdayKey] && momentsByDate[yesterdayKey].length > 0);

  let currentStreak = 0;

  if (isTodayActive) {
    // Today is active: count today + consecutive previous days
    currentStreak = 1;
    let step = 1;
    while (true) {
      const prevKey = formatDateKey(subDays(referenceDate, step));
      if (momentsByDate[prevKey] && momentsByDate[prevKey].length > 0) {
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
      if (momentsByDate[prevKey] && momentsByDate[prevKey].length > 0) {
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
      isActive: Boolean(momentsByDate[key] && momentsByDate[key].length > 0),
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
