import { Moment, HistoryDay, CoupleState } from '../../types';
import { pluralizeWord } from '../gamification';
import { appStorage } from '../storage/keyValueStorage';

export type StarEventType = 'moment' | 'date';

export interface StarPoint {
  id: number;
  x: number; // 0 - 100
  y: number; // 0 - 100
  role: 'anchor' | 'body';
  starType: StarEventType; // 'moment' (Small Star ⭐ for daily touches) | 'date' (Big Star ✨ for completed dates)
  dateKey?: string;
  label?: string;
  isLit: boolean;
  isNewest?: boolean;
}

export interface ConstellationLine {
  fromId: number;
  toId: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  isLit: boolean;
  connectsNewest?: boolean;
}

export interface SkyState {
  month: number; // 1 - 12
  year: number;
  monthName: string;
  title: string;
  starsCount: number;
  momentStarsCount: number;
  dateStarsCount: number;
  maxStarsInMonth: number;
  points: StarPoint[];
  lines: ConstellationLine[];
  isCompleted: boolean;
  statusText: string;
}

// --------------------------------------------------------------------------
// INDEPENDENT ACCUMULATED STAR REGISTRY
// Monotonic & persistent: once earned, stars are NEVER lost, reset or wiped
// by Free-tier 7-day limits, photo stripping, or offline reloads.
// Preserves exact event types: Small Star ⭐ (Match) vs Big Star ✨ (Date).
// --------------------------------------------------------------------------

export interface StarEvent {
  id: string; // unique ID, e.g. `match_${dateKey}` or `date_${momentId || dateKey}`
  dateKey: string; // 'YYYY-MM-DD'
  starType: StarEventType; // 'moment' (Match ⭐) | 'date' (Date ✨)
  momentId?: string;
  title?: string;
  createdAt?: string;
}

const STAR_RECORDS_STORAGE_PREFIX = 'ours_accumulated_stars_v2_';
const STAR_DATES_STORAGE_PREFIX = 'ours_accumulated_stars_v1_';

export function getAccumulatedStarRecords(pairId?: string): StarEvent[] {
  const cleanId = (pairId || 'default').trim().toLowerCase();
  try {
    const raw = appStorage.getItem(`${STAR_RECORDS_STORAGE_PREFIX}${cleanId}`);
    if (typeof raw === 'string' && raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (e) =>
            e &&
            typeof e.id === 'string' &&
            typeof e.dateKey === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey) &&
            (e.starType === 'moment' || e.starType === 'date')
        );
      }
    }
  } catch {
    // fallback
  }

  // Backward migration from v1 date array
  const legacyDates = getAccumulatedStarDates(cleanId);
  if (legacyDates.length > 0) {
    return legacyDates.map((d) => ({
      id: `match_${d}`,
      dateKey: d,
      starType: 'moment',
      title: 'Касание',
    }));
  }

  return [];
}

export function recordAccumulatedStarRecords(
  pairId: string | undefined,
  newRecords: StarEvent[]
): StarEvent[] {
  const cleanId = (pairId || 'default').trim().toLowerCase();
  const existing = getAccumulatedStarRecords(cleanId);
  const eventMap = new Map<string, StarEvent>();

  for (const e of existing) {
    eventMap.set(e.id, e);
  }

  for (const e of newRecords) {
    if (e && e.id && e.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey)) {
      eventMap.set(e.id, e);
    }
  }

  const merged = Array.from(eventMap.values()).sort((a, b) => {
    const cmp = a.dateKey.localeCompare(b.dateKey);
    if (cmp !== 0) return cmp;
    if (a.starType === b.starType) return a.id.localeCompare(b.id);
    return a.starType === 'moment' ? -1 : 1;
  });

  try {
    appStorage.setItem(`${STAR_RECORDS_STORAGE_PREFIX}${cleanId}`, JSON.stringify(merged));
    // Also keep legacy date registry in sync
    const dateSet = Array.from(new Set(merged.map((e) => e.dateKey))).sort();
    appStorage.setItem(`${STAR_DATES_STORAGE_PREFIX}${cleanId}`, JSON.stringify(dateSet));
  } catch {
    // ignore
  }

  return merged;
}

export function getAccumulatedStarDates(pairId?: string): string[] {
  const cleanId = (pairId || 'default').trim().toLowerCase();
  try {
    const raw = appStorage.getItem(`${STAR_DATES_STORAGE_PREFIX}${cleanId}`);
    if (typeof raw === 'string' && raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
      }
    }
  } catch {
    // fallback
  }
  return [];
}

export function recordAccumulatedStarDates(pairId: string | undefined, newDates: string[]): string[] {
  const cleanId = (pairId || 'default').trim().toLowerCase();
  const existing = getAccumulatedStarDates(cleanId);
  const dateSet = new Set<string>(existing);

  for (const d of newDates) {
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      dateSet.add(d);
    }
  }

  const merged = Array.from(dateSet).sort();
  try {
    appStorage.setItem(`${STAR_DATES_STORAGE_PREFIX}${cleanId}`, JSON.stringify(merged));
  } catch {
    // ignore
  }

  // Also sync to v2 records
  const newRecords: StarEvent[] = merged.map((d) => ({
    id: `event_${d}`,
    dateKey: d,
    starType: 'moment',
    title: 'Воспоминание',
  }));
  recordAccumulatedStarRecords(cleanId, newRecords);

  return merged;
}

// --------------------------------------------------------------------------
// DETERMINISTIC PSEUDO-RANDOM NUMBER GENERATOR
// Guarantees exact coordinate replication across reloads, devices, and tabs.
// --------------------------------------------------------------------------

function murmurhash3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

// --------------------------------------------------------------------------
// CALENDAR & MATCH EXTRACTION HELPERS
// --------------------------------------------------------------------------

export function getMonthNameRu(month: number): string {
  const months = [
    'Январь',
    'Февраль',
    'Март',
    'Апрель',
    'Май',
    'Июнь',
    'Июль',
    'Август',
    'Сентябрь',
    'Октябрь',
    'Ноябрь',
    'Декабрь',
  ];
  return months[(month - 1) % 12] || 'Месяц';
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Checks whether a Moment represents an authentic completed MATCH.
 * Crucial: If a moment was completed/revealed/reacted, it IS a match, even if
 * older photos were archived or stripped on the wire for Free tier limits.
 */
export function isMomentMatched(moment: Moment): boolean {
  if (!moment) return false;

  // 1. Date moments with uploaded photos count as completed date events
  if (moment.isDate || (typeof moment.id === 'string' && moment.id.startsWith('date-'))) {
    const hasPhoto = Boolean(
      moment.imageUrl ||
      moment.userPhoto ||
      moment.partnerPhoto ||
      (moment.photos && moment.photos.length > 0)
    );
    if (hasPhoto) return true;
  }

  // 2. If moment has completed status or recorded reactions: it is definitely an authentic match
  const isMatchStatus =
    moment.status === 'COMPLETED' ||
    moment.status === 'REVEALED' ||
    moment.status === 'REACTED' ||
    moment.status === 'MATCH' ||
    Boolean(moment.userReaction || moment.partnerReaction);

  if (isMatchStatus) {
    return true;
  }

  // 3. In-progress / unfinalized moments count if both photos are present or both uploaded
  const hasBoth = Boolean(
    (moment.userPhoto && moment.partnerPhoto) ||
    (moment.photos && moment.photos.length >= 2) ||
    moment.status === 'BOTH_UPLOADED'
  );

  return hasBoth;
}

/**
 * 11 Test Stars for preview & testing:
 * 7 Match moments ⭐ and 4 Conducted dates ✨ interleaved in organic order.
 */
export function getTestMatchedDates(referenceDate: Date = new Date()): string[] {
  const y = referenceDate.getFullYear();
  const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
  return [
    `${y}-${m}-01`, // 1. Match ⭐
    `${y}-${m}-02`, // 2. Date ✨
    `${y}-${m}-03`, // 3. Match ⭐
    `${y}-${m}-04`, // 4. Match ⭐
    `${y}-${m}-05`, // 5. Date ✨
    `${y}-${m}-06`, // 6. Match ⭐
    `${y}-${m}-07`, // 7. Date ✨
    `${y}-${m}-08`, // 8. Match ⭐
    `${y}-${m}-09`, // 9. Date ✨
    `${y}-${m}-10`, // 10. Match ⭐
    `${y}-${m}-11`, // 11. Match ⭐
  ];
}

export function getTestDateDays(referenceDate: Date = new Date()): string[] {
  const y = referenceDate.getFullYear();
  const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
  return [
    `${y}-${m}-02`, // Date ✨
    `${y}-${m}-05`, // Date ✨
    `${y}-${m}-07`, // Date ✨
    `${y}-${m}-09`, // Date ✨
  ];
}

/**
 * Extracts unique calendar days with an authentic MATCH from the couple's history and today's moments.
 * Rule: Exactly 1 star per unique calendar day with a match (even if 2 or 3 touches occurred).
 */
export function getCoupleMatchedDates(
  _couple: CoupleState,
  todayMoments: Moment[] = [],
  history: HistoryDay[] = [],
  referenceDate: Date = new Date()
): string[] {
  const matchedDatesSet = new Set<string>();
  const todayKey = toDateKey(referenceDate);

  // 1. Check if today has at least one moment that achieved MATCH
  const todayHasMatch = todayMoments.some(isMomentMatched);
  if (todayHasMatch) {
    matchedDatesSet.add(todayKey);
  }

  // 2. Check real history days:
  // History days only exist when joint moments took place.
  // Locked days (>7 days on Free plan) and sanitized moments MUST retain their stars.
  for (const day of history) {
    const hasMatch =
      Boolean(day.isLocked) ||
      (Array.isArray(day.moments) && day.moments.length > 0) ||
      (Array.isArray(day.moments) && day.moments.some(isMomentMatched));

    if (hasMatch) {
      let key: string | null = null;
      if (day.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(day.dateKey)) {
        key = day.dateKey;
      } else if (day.id?.startsWith('day-')) {
        const rawId = day.id.replace('day-', '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawId)) {
          key = rawId;
        }
      } else if (day.id?.startsWith('hist-')) {
        const rawId = day.id.replace('hist-', '');
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawId)) {
          key = rawId;
        }
      }

      if (!key && Array.isArray(day.moments)) {
        for (const m of day.moments) {
          if (m.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(m.dateKey)) {
            key = m.dateKey;
            break;
          } else if (m.createdAt) {
            try {
              const d = new Date(m.createdAt);
              if (!isNaN(d.getTime())) {
                key = toDateKey(d);
                break;
              }
            } catch {}
          }
        }
      }

      if (key && /^\d{4}-\d{2}-\d{2}$/.test(key)) {
        matchedDatesSet.add(key);
      }
    }
  }

  // Never return fake test dates for couples; return strictly authentic matched dates
  return Array.from(matchedDatesSet).sort();
}

/**
 * Extracts all authentic, authoritatively typed StarEvents (Match ⭐ and Date ✨)
 * directly linked to real memories, preserving individual identities across devices.
 */
export function getCoupleStarEvents(
  couple: CoupleState,
  todayMoments: Moment[] = [],
  history: HistoryDay[] = [],
  completedDateDays: string[] = [],
  referenceDate: Date = new Date()
): StarEvent[] {
  const pairId = couple?.id || couple?.inviteCode || couple?.pairSeed;
  const eventsMap = new Map<string, StarEvent>();

  // 1. Retrieve previously persisted accumulated star records
  const persisted = getAccumulatedStarRecords(pairId);
  for (const ev of persisted) {
    if (ev && ev.id && ev.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(ev.dateKey)) {
      eventsMap.set(ev.id, ev);
    }
  }

  // 2. Extract authentic events from real history days
  for (const day of history) {
    let dayKey: string | null = null;
    if (day.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(day.dateKey)) {
      dayKey = day.dateKey;
    } else if (day.id?.startsWith('day-')) {
      const raw = day.id.replace('day-', '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) dayKey = raw;
    }

    if (!dayKey && Array.isArray(day.moments)) {
      for (const m of day.moments) {
        if (m.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(m.dateKey)) {
          dayKey = m.dateKey;
          break;
        } else if (m.createdAt) {
          try {
            const d = new Date(m.createdAt);
            if (!isNaN(d.getTime())) {
              dayKey = toDateKey(d);
              break;
            }
          } catch {}
        }
      }
    }

    if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) continue;

    // A. Check for Match moments in this day:
    const hasMatchMoment = Array.isArray(day.moments) && day.moments.some((m) => {
      const isDate = Boolean(
        m.isDate ||
        (typeof m.id === 'string' && m.id.startsWith('date-')) ||
        (typeof m.prompt === 'string' && m.prompt.startsWith('Свидание'))
      );
      return !isDate && isMomentMatched(m);
    });

    const isLockedWithoutMoments = Boolean(day.isLocked) && (!day.moments || day.moments.length === 0);

    if (hasMatchMoment || isLockedWithoutMoments) {
      const matchId = `match_${dayKey}`;
      eventsMap.set(matchId, {
        id: matchId,
        dateKey: dayKey,
        starType: 'moment',
        title: 'Касание',
      });
    }

    // B. Check for completed Date moments in this day:
    if (Array.isArray(day.moments)) {
      for (const m of day.moments) {
        const isDate = Boolean(
          m.isDate ||
          (typeof m.id === 'string' && m.id.startsWith('date-')) ||
          (typeof m.prompt === 'string' && m.prompt.startsWith('Свидание')) ||
          m.label === 'СВИДАНИЕ'
        );
        if (isDate) {
          const hasPhoto = Boolean(
            m.imageUrl ||
            m.userPhoto ||
            m.partnerPhoto ||
            (m.photos && m.photos.length > 0)
          );
          if (hasPhoto) {
            const dateEventId = `date_${m.id || dayKey}`;
            eventsMap.set(dateEventId, {
              id: dateEventId,
              dateKey: dayKey,
              starType: 'date',
              momentId: m.id,
              title: m.prompt || 'Свидание',
              createdAt: m.createdAt,
            });
          }
        }
      }
    }
  }

  // 3. Extract today's events from todayMoments
  const todayKey = toDateKey(referenceDate);
  const todayHasMatch = todayMoments.some((m) => {
    const isDate = Boolean(
      m.isDate ||
      (typeof m.id === 'string' && m.id.startsWith('date-')) ||
      (typeof m.prompt === 'string' && m.prompt.startsWith('Свидание'))
    );
    return !isDate && isMomentMatched(m);
  });

  if (todayHasMatch) {
    const matchId = `match_${todayKey}`;
    eventsMap.set(matchId, {
      id: matchId,
      dateKey: todayKey,
      starType: 'moment',
      title: 'Касание',
    });
  }

  // 4. Any completed date days recorded from invitation service
  for (const d of completedDateDays) {
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const dateId = `date_inv_${d}`;
      const alreadyHasDateStar = Array.from(eventsMap.values()).some(
        (e) => e.dateKey === d && e.starType === 'date'
      );
      if (!alreadyHasDateStar) {
        eventsMap.set(dateId, {
          id: dateId,
          dateKey: d,
          starType: 'date',
          title: 'Свидание',
        });
      }
    }
  }

  // 5. Sort chronologically: by date ascending, then moment before date
  const sortedEvents = Array.from(eventsMap.values()).sort((a, b) => {
    const cmp = a.dateKey.localeCompare(b.dateKey);
    if (cmp !== 0) return cmp;
    if (a.starType === b.starType) return a.id.localeCompare(b.id);
    return a.starType === 'moment' ? -1 : 1;
  });

  // 6. Monotonically persist in registry
  recordAccumulatedStarRecords(pairId, sortedEvents);

  return sortedEvents;
}

/**
 * Filter StarEvents belonging to a specific Year & Month (1-indexed month)
 */
export function getStarEventsForMonth(
  events: StarEvent[],
  year: number,
  month: number
): StarEvent[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return events.filter((e) => e.dateKey.startsWith(prefix));
}

/**
 * Combines authentic matches and confirmed completed dates for a couple into the unified sky calendar.
 * Rule: Exactly 1 star per unique event, strictly monotonic & persistent.
 */
export function getCoupleSkyDates(
  couple: CoupleState,
  todayMoments: Moment[] = [],
  history: HistoryDay[] = [],
  completedDateDays: string[] = [],
  referenceDate: Date = new Date()
): string[] {
  const events = getCoupleStarEvents(
    couple,
    todayMoments,
    history,
    completedDateDays,
    referenceDate
  );
  return events.map((e) => e.dateKey);
}

/**
 * Filter matched dates belonging to a specific Year & Month (1-indexed month)
 */
export function getMatchedDatesForMonth(
  matchedDates: string[],
  year: number,
  month: number
): string[] {
  const prefix = `${year}-${String(month).padStart(2, '0')}`;
  return matchedDates.filter((d) => d.startsWith(prefix));
}

// --------------------------------------------------------------------------
// DYNAMIC NATURAL ABSTRACT CONSTELLATION GENERATOR
// --------------------------------------------------------------------------

interface GeneratedMonthLayout {
  stars: Array<{ id: number; x: number; y: number; role: 'anchor' | 'body' }>;
  lines: Array<[number, number]>;
}

function ccw(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
): number {
  return (p3.y - p1.y) * (p2.x - p1.x) - (p2.y - p1.y) * (p3.x - p1.x);
}

/**
 * Robust check if two line segments cross each other (excluding shared endpoints).
 */
function segmentsCross(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  p4: { x: number; y: number }
): boolean {
  if (
    (Math.abs(p1.x - p3.x) < 0.001 && Math.abs(p1.y - p3.y) < 0.001) ||
    (Math.abs(p1.x - p4.x) < 0.001 && Math.abs(p1.y - p4.y) < 0.001) ||
    (Math.abs(p2.x - p3.x) < 0.001 && Math.abs(p2.y - p3.y) < 0.001) ||
    (Math.abs(p2.x - p4.x) < 0.001 && Math.abs(p2.y - p4.y) < 0.001)
  ) {
    return false;
  }

  const d1 = ccw(p1, p2, p3);
  const d2 = ccw(p1, p2, p4);
  const d3 = ccw(p3, p4, p1);
  const d4 = ccw(p3, p4, p2);

  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * Distance from point p to line segment vw.
 */
function distToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = v.x + t * (w.x - v.x);
  const projY = v.y + t * (w.y - v.y);
  return Math.hypot(p.x - projX, p.y - projY);
}

/**
 * Deterministically generates a clean, natural constellation layout for a pair and month.
 * - Organic, non-grid celestial star distribution.
 * - Connects new stars without crossing existing constellation lines.
 * - Prevents lines from cutting through the middle of intermediate stars.
 * - 100% deterministic & incremental: adding star (k+1) never alters stars 0..k or established lines 0..k.
 */
function generateMonthLayout(seedKey: string, maxDays: number): GeneratedMonthLayout {
  const prng = murmurhash3(seedKey);
  const stars: Array<{ id: number; x: number; y: number; role: 'anchor' | 'body' }> = [];

  const minDistance = 9.0; // Clean natural spacing between stars
  const paddingX = 14;
  const paddingY = 14;
  const usableWidth = 100 - paddingX * 2;
  const usableHeight = 100 - paddingY * 2;

  let attempts = 0;
  while (stars.length < maxDays && attempts < 3500) {
    attempts++;
    const rawX = paddingX + prng() * usableWidth;
    const rawY = paddingY + prng() * usableHeight;
    const x = Math.round(rawX * 10) / 10;
    const y = Math.round(rawY * 10) / 10;

    let tooClose = false;
    for (const s of stars) {
      const dx = s.x - x;
      const dy = s.y - y;
      if (Math.hypot(dx, dy) < minDistance) {
        tooClose = true;
        break;
      }
    }

    if (!tooClose) {
      const isAnchor = prng() < 0.24;
      stars.push({
        id: stars.length,
        x,
        y,
        role: isAnchor ? 'anchor' : 'body',
      });
    }
  }

  // Fallback in rare case if space ran out before maxDays
  while (stars.length < maxDays) {
    const rawX = paddingX + prng() * usableWidth;
    const rawY = paddingY + prng() * usableHeight;
    stars.push({
      id: stars.length,
      x: Math.round(rawX * 10) / 10,
      y: Math.round(rawY * 10) / 10,
      role: prng() < 0.24 ? 'anchor' : 'body',
    });
  }

  // Connection planning with non-intersecting geometry
  const lines: Array<[number, number]> = [];
  const degrees: number[] = new Array(stars.length).fill(0);

  const countIntersections = (fromIdx: number, toIdx: number): number => {
    const pA = stars[fromIdx];
    const pB = stars[toIdx];
    let count = 0;
    for (const [lFrom, lTo] of lines) {
      if (segmentsCross(pA, pB, stars[lFrom], stars[lTo])) {
        count++;
      }
    }
    return count;
  };

  const passesTooCloseToOtherStars = (fromIdx: number, toIdx: number): boolean => {
    const pA = stars[fromIdx];
    const pB = stars[toIdx];
    for (let k = 0; k < stars.length; k++) {
      if (k === fromIdx || k === toIdx) continue;
      if (distToSegment(stars[k], pA, pB) < 3.8) {
        return true;
      }
    }
    return false;
  };

  for (let i = 1; i < stars.length; i++) {
    const starPrng = murmurhash3(`${seedKey}_star_conn_clean_${i}`);
    const curr = stars[i];

    // Evaluate all preceding stars (0 .. i-1)
    interface Candidate {
      id: number;
      dist: number;
      crossings: number;
      passesNearStar: boolean;
      degree: number;
    }

    const candidates: Candidate[] = [];
    for (let j = 0; j < i; j++) {
      const prev = stars[j];
      const dist = Math.hypot(prev.x - curr.x, prev.y - curr.y);
      const crossings = countIntersections(j, i);
      const passesNearStar = passesTooCloseToOtherStars(j, i);
      candidates.push({
        id: j,
        dist,
        crossings,
        passesNearStar,
        degree: degrees[j] || 0,
      });
    }

    // Filter tier 1: Zero crossings, no passing through stars, reasonable distance
    const perfectCandidates = candidates.filter(
      (c) => c.crossings === 0 && !c.passesNearStar && c.dist <= 48
    );

    // Filter tier 2: Zero crossings
    const zeroCrossCandidates = candidates.filter((c) => c.crossings === 0);

    let chosenCandidateId: number;

    if (perfectCandidates.length > 0) {
      // Sort by proximity & degree balance (avoid creating 5+ line clusters)
      perfectCandidates.sort((a, b) => {
        const scoreA = a.dist + (a.degree > 2 ? 10 : 0);
        const scoreB = b.dist + (b.degree > 2 ? 10 : 0);
        return scoreA - scoreB;
      });

      // 78% take closest perfect, 22% take 2nd closest if available for organic variety
      const roll = starPrng();
      if (roll < 0.78 || perfectCandidates.length === 1) {
        chosenCandidateId = perfectCandidates[0].id;
      } else {
        chosenCandidateId = perfectCandidates[1].id;
      }
    } else if (zeroCrossCandidates.length > 0) {
      zeroCrossCandidates.sort((a, b) => a.dist - b.dist);
      chosenCandidateId = zeroCrossCandidates[0].id;
    } else {
      // Minimal crossing fallback if geometry is extremely congested
      candidates.sort((a, b) => {
        if (a.crossings !== b.crossings) return a.crossings - b.crossings;
        return a.dist - b.dist;
      });
      chosenCandidateId = candidates[0].id;
    }

    lines.push([chosenCandidateId, i]);
    degrees[chosenCandidateId] = (degrees[chosenCandidateId] || 0) + 1;
    degrees[i] = (degrees[i] || 0) + 1;

    // Optional subtle secondary branch/loop (~18% chance for stars >= 4):
    // Strictly allowed ONLY IF it produces 0 crossings and 0 collisions
    const roll2 = starPrng();
    if (i >= 4 && roll2 < 0.18 && degrees[i] <= 2) {
      const secondaryCandidates = candidates.filter((c) => {
        if (c.id === chosenCandidateId) return false;
        if (c.dist > 28) return false;
        if (countIntersections(c.id, i) > 0) return false;
        if (passesTooCloseToOtherStars(c.id, i)) return false;
        return true;
      });

      if (secondaryCandidates.length > 0) {
        secondaryCandidates.sort((a, b) => a.dist - b.dist);
        const secTarget = secondaryCandidates[0].id;
        lines.push([secTarget, i]);
        degrees[secTarget] = (degrees[secTarget] || 0) + 1;
        degrees[i] = (degrees[i] || 0) + 1;
      }
    }
  }

  return { stars, lines };
}

/**
 * Builds the authoritative SkyState for a specific month and stars count.
 * Distinguishes Small Stars ⭐ (regular daily moments) from Big Stars ✨ (completed couple dates).
 */
export function getSkyForMonth(
  pairSeed: string,
  year: number,
  month: number,
  starsCount: number,
  isCurrentMonth: boolean = true,
  matchedDatesInMonth: string[] = [],
  completedDateDays: string[] = [],
  starEventsInMonth?: StarEvent[]
): SkyState {
  const cleanSeed = (pairSeed || 'ours').trim().toLowerCase();
  const seedKey = `${cleanSeed}_sky_${year}_${month}`;
  const maxStarsInMonth = getDaysInMonth(year, month);
  const effectiveStarsCount = Math.min(Math.max(0, starsCount), maxStarsInMonth);

  // Generate deterministic layout for this month
  const layout = generateMonthLayout(seedKey, maxStarsInMonth);

  let momentStarsCount = 0;
  let dateStarsCount = 0;

  // Build points
  const points: StarPoint[] = layout.stars.map((raw, idx) => {
    const isLit = idx < effectiveStarsCount;
    const isNewest = idx === effectiveStarsCount - 1 && isCurrentMonth && isLit;
    const starEvent = starEventsInMonth && starEventsInMonth[idx];
    const dateKey = starEvent ? starEvent.dateKey : (matchedDatesInMonth[idx] || '');

    // Determine star type based on authoritative StarEvent, or fallback to completedDateDays
    let starType: StarEventType;
    if (starEvent) {
      starType = starEvent.starType;
    } else {
      const isDateEvent = Boolean(
        dateKey && completedDateDays.length > 0 && completedDateDays.includes(dateKey)
      );
      starType = isDateEvent ? 'date' : 'moment';
    }

    if (isLit) {
      if (starType === 'date') {
        dateStarsCount++;
      } else {
        momentStarsCount++;
      }
    }

    return {
      id: idx,
      x: raw.x,
      y: raw.y,
      role: raw.role,
      starType,
      dateKey: dateKey || undefined,
      label: starEvent?.title || (starType === 'date' ? 'Свидание' : 'Касание'),
      isLit,
      isNewest,
    };
  });

  // Build lines
  const lines: ConstellationLine[] = layout.lines.map(([fromIdx, toIdx]) => {
    const pFrom = points[fromIdx];
    const pTo = points[toIdx];
    const isLit = Boolean(pFrom?.isLit && pTo?.isLit);
    const connectsNewest = Boolean(isLit && isCurrentMonth && (pFrom?.isNewest || pTo?.isNewest));

    return {
      fromId: fromIdx,
      toId: toIdx,
      from: { x: pFrom ? pFrom.x : 50, y: pFrom ? pFrom.y : 50 },
      to: { x: pTo ? pTo.x : 50, y: pTo ? pTo.y : 50 },
      isLit,
      connectsNewest,
    };
  });

  // Quiet emotional status text reflecting moments & dates
  let statusText = 'Здесь будет ваша история.';
  if (effectiveStarsCount === 0) {
    statusText = 'Пустое небо ждёт вашего первого общего момента.';
  } else if (effectiveStarsCount === 1) {
    statusText = dateStarsCount > 0
      ? 'Ваше первое совместное свидание зажгло большую звезду'
      : 'Первая звезда зажглась от вашего общего касания';
  } else if (effectiveStarsCount >= maxStarsInMonth) {
    statusText = 'Завершённое созвездие месяца.';
  } else if (dateStarsCount > 0 && momentStarsCount > 0) {
    statusText = `${momentStarsCount} ${pluralizeWord(momentStarsCount, 'касание', 'касания', 'касаний')} и ${dateStarsCount} ${pluralizeWord(dateStarsCount, 'свидание', 'свидания', 'свиданий')}`;
  } else if (dateStarsCount > 0) {
    statusText = `${dateStarsCount} ${pluralizeWord(dateStarsCount, 'свидание', 'свидания', 'свиданий')} зажгли большие звёзды`;
  } else {
    statusText = `${momentStarsCount} ${pluralizeWord(momentStarsCount, 'касание', 'касания', 'касаний')} зажгли звёзды в небе`;
  }

  const monthName = getMonthNameRu(month);

  return {
    month,
    year,
    monthName,
    title: `${monthName} ${year}`,
    starsCount: effectiveStarsCount,
    momentStarsCount,
    dateStarsCount,
    maxStarsInMonth,
    points,
    lines,
    isCompleted: effectiveStarsCount >= maxStarsInMonth,
    statusText,
  };
}
