import { CoupleState, HistoryDay, Moment } from '../../types';
import { FingerprintDayInput } from './fingerprintGenerator';
import { formatDateKey } from '../streak/streakService';

/**
 * Format a Date object to YYYY-MM-DD in local time
 */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Parse an ISO or YYYY-MM-DD string into a local Date
 */
export function parseDateKey(key: string): Date {
  const parts = key.split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(key);
}

/**
 * Get or compute a stable pairSeed for the couple
 */
export function getCoupleSeed(couple: CoupleState): string {
  if (couple.id && couple.id.trim()) {
    return `pair_${couple.id.trim()}`;
  }
  if (couple.pairSeed && couple.pairSeed.trim()) {
    return couple.pairSeed.trim();
  }
  if (couple.inviteCode && couple.inviteCode.trim()) {
    return `pair_code_${couple.inviteCode.trim().toLowerCase()}`;
  }
  return 'pair_default';
}

/**
 * Extract calendar day history for the couple, marking each day as 'matched' or 'missed'
 */
export function getCoupleFingerprintDays(
  couple: CoupleState,
  todayMoments: Moment[],
  history: HistoryDay[],
  referenceDate: Date = new Date()
): FingerprintDayInput[] {
  const todayKey = toDateKey(referenceDate);

  // Set of dates that had at least one successful MATCH (completed moment)
  const matchedDates = new Set<string>();

  // Check today's moments
  const todayHasMatch = todayMoments.some((m) => m.status === 'COMPLETED');
  if (todayHasMatch) {
    matchedDates.add(todayKey);
  }

  // Check history moments
  for (const day of history) {
    for (const m of day.moments) {
      if (m.status === 'COMPLETED') {
        const key = m.dateKey || (m.createdAt ? toDateKey(new Date(m.createdAt)) : null);
        if (key) {
          matchedDates.add(key);
        }
      }
    }
  }

  // Determine span of days from couple inception
  const totalSpan = Math.max(couple.daysTogether || 12, 1);
  const days: FingerprintDayInput[] = [];

  // Generate sequence from (totalSpan - 1) days ago up to yesterday/today
  for (let offset = totalSpan - 1; offset >= 0; offset--) {
    const d = new Date(referenceDate);
    d.setDate(d.getDate() - offset);
    const dateKey = toDateKey(d);

    const isToday = dateKey === todayKey;

    if (isToday) {
      // If today has reached MATCH, include it as matched!
      if (todayHasMatch) {
        days.push({
          date: dateKey,
          status: 'matched',
        });
      }
      // If today does not have MATCH yet, it is still ongoing (not yet a missed day)
    } else {
      // Past day
      const wasMatched = matchedDates.has(dateKey);
      days.push({
        date: dateKey,
        status: wasMatched ? 'matched' : 'missed',
      });
    }
  }

  return days;
}
