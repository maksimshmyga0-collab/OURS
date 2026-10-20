import { Moment, HistoryDay, CoupleState, OurDayPhoto } from '../../types';
import { pluralizeWord } from '../gamification';
import { appStorage } from '../storage/keyValueStorage';
import { getLocalDateKey } from '../moments/momentTiming';

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
// Persistent across reloads & Free-tier 7-day photo stripping, and reconciled
// against authoritative server history so both partners see identical stars.
// Preserves exact event types: Small Star ⭐ (Match) vs Big Star ✨ (Date).
// --------------------------------------------------------------------------

export interface StarEvent {
  id: string; // canonical ID: `match_${dateKey}` or `date_${dateKey}`
  dateKey: string; // 'YYYY-MM-DD'
  starType: StarEventType; // 'moment' (Match ⭐) | 'date' (Date ✨)
  momentId?: string;
  title?: string;
  createdAt?: string;
}

const STAR_RECORDS_STORAGE_PREFIX = 'ours_accumulated_stars_v2_';
const STAR_DATES_STORAGE_PREFIX = 'ours_accumulated_stars_v1_';

/**
 * Extracts canonical YYYY-MM-DD key from an explicit dateKey or ISO timestamp.
 */
export function extractStarDateKey(
  dateKey?: string | null,
  fallbackIso?: string | null
): string | null {
  if (typeof dateKey === 'string') {
    const trimmed = dateKey.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && trimmed !== '1970-01-01') {
      return trimmed;
    }
  }
  if (typeof fallbackIso === 'string' && fallbackIso.trim()) {
    const trimmed = fallbackIso.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && trimmed !== '1970-01-01') {
      return trimmed;
    }
    try {
      const d = new Date(trimmed);
      if (!isNaN(d.getTime())) {
        const localKey = getLocalDateKey(d);
        if (localKey !== '1970-01-01') return localKey;
      }
    } catch {
      // fallback below
    }
    const sub = trimmed.substring(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(sub) && sub !== '1970-01-01') {
      return sub;
    }
  }
  return null;
}

function getRecordSemanticKey(e: StarEvent): string {
  if (e.starType === 'moment') {
    return `moment_${e.dateKey}`;
  }
  // Canonical 1 date star per calendar day so different local/remote momentIds never double-count
  return `date_${e.dateKey}`;
}

function normalizeStarRecord(e: StarEvent): StarEvent {
  if (e.starType === 'moment') {
    return {
      ...e,
      id: `match_${e.dateKey}`,
      title: e.title || 'Касание',
    };
  }
  return {
    ...e,
    id: `date_${e.dateKey}`,
    title: e.title || 'Свидание',
  };
}

export function getAccumulatedStarRecords(pairId?: string): StarEvent[] {
  const cleanId = (pairId || 'default').trim().toLowerCase();
  try {
    const raw = appStorage.getItem(`${STAR_RECORDS_STORAGE_PREFIX}${cleanId}`);
    if (typeof raw === 'string' && raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const deduped = new Map<string, StarEvent>();
        for (const e of parsed) {
          if (
            e &&
            typeof e.id === 'string' &&
            typeof e.dateKey === 'string' &&
            /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey) &&
            e.dateKey !== '1970-01-01' &&
            (e.starType === 'moment' || e.starType === 'date')
          ) {
            const norm = normalizeStarRecord(e);
            const semKey = getRecordSemanticKey(norm);
            const prev = deduped.get(semKey);
            if (!prev || norm.momentId) {
              deduped.set(semKey, norm);
            }
          }
        }
        return Array.from(deduped.values()).sort((a, b) => {
          const cmp = a.dateKey.localeCompare(b.dateKey);
          if (cmp !== 0) return cmp;
          if (a.starType === b.starType) return a.id.localeCompare(b.id);
          return a.starType === 'moment' ? -1 : 1;
        });
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
    if (e && e.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey) && e.dateKey !== '1970-01-01') {
      const norm = normalizeStarRecord(e);
      const key = getRecordSemanticKey(norm);
      eventMap.set(key, norm);
    }
  }

  for (const e of newRecords) {
    if (e && e.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey) && e.dateKey !== '1970-01-01') {
      const norm = normalizeStarRecord(e);
      const key = getRecordSemanticKey(norm);
      const prev = eventMap.get(key);
      if (!prev || norm.momentId) {
        eventMap.set(key, norm);
      }
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
    const dateSet = Array.from(new Set(merged.map((e) => e.dateKey))).sort();
    appStorage.setItem(`${STAR_DATES_STORAGE_PREFIX}${cleanId}`, JSON.stringify(dateSet));
  } catch {
    // ignore
  }

  return merged;
}

/**
 * Reconciles the local star registry with authoritative server records from fetchHistory.
 * Replaces historical records (< todayKey) with server truth while preserving today's live records,
 * cleaning up any legacy duplicate or stale entries so both partners converge on identical stars.
 */
export function replaceServerStarRecords(
  pairId: string | undefined,
  serverRecords: StarEvent[],
  todayKey?: string
): StarEvent[] {
  const cleanId = (pairId || 'default').trim().toLowerCase();
  const currentTodayKey = todayKey || getLocalDateKey();
  const existing = getAccumulatedStarRecords(cleanId);
  const eventMap = new Map<string, StarEvent>();

  // Preserve only today's records from existing local cache if not yet in serverRecords
  for (const e of existing) {
    if (e && e.dateKey === currentTodayKey) {
      const norm = normalizeStarRecord(e);
      eventMap.set(getRecordSemanticKey(norm), norm);
    }
  }

  // Authoritatively apply all server records
  for (const e of serverRecords) {
    if (e && e.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(e.dateKey) && e.dateKey !== '1970-01-01') {
      const norm = normalizeStarRecord(e);
      eventMap.set(getRecordSemanticKey(norm), norm);
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
        return parsed.filter(
          (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== '1970-01-01'
        );
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
    if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && d !== '1970-01-01') {
      dateSet.add(d);
    }
  }

  const merged = Array.from(dateSet).sort();
  try {
    appStorage.setItem(`${STAR_DATES_STORAGE_PREFIX}${cleanId}`, JSON.stringify(merged));
  } catch {
    // ignore
  }

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

function isDateMomentObj(moment: Moment): boolean {
  if (!moment) return false;
  return Boolean(
    moment.isDate ||
      (typeof moment.id === 'string' &&
        (moment.id.startsWith('date-') || moment.id.startsWith('date_'))) ||
      moment.label === 'СВИДАНИЕ' ||
      (typeof moment.prompt === 'string' && moment.prompt.startsWith('Свидание'))
  );
}

/**
 * Checks whether a Moment represents an authentic completed MATCH.
 * Crucial: If a moment in history was completed/revealed/reacted, it IS a match,
 * even if older photos were stripped on the wire for Free tier limits.
 */
export function isMomentMatched(moment: Moment): boolean {
  if (!moment) return false;

  // 1. Date moments with uploaded photos (or sanitized completed status in locked history)
  if (isDateMomentObj(moment)) {
    const hasPhoto = Boolean(
      moment.imageUrl ||
        moment.userPhoto ||
        moment.partnerPhoto ||
        (moment.photos && moment.photos.length > 0) ||
        moment.status === 'COMPLETED'
    );
    if (hasPhoto) return true;
  }

  // 2. Regular & OUR_DAY moments: check for photos from both partners
  const distinctPhotoAuthors = Array.isArray(moment.photos)
    ? new Set(
        moment.photos
          .map((p: any) => p?.userId || p?.authorId)
          .filter(Boolean)
      ).size
    : 0;

  const hasBothPhotos = Boolean(
    (moment.userPhoto && moment.partnerPhoto) ||
      distinctPhotoAuthors >= 2 ||
      (Array.isArray(moment.photos) &&
        moment.photos.length >= 2 &&
        distinctPhotoAuthors === 0)
  );

  if (hasBothPhotos) {
    return true;
  }

  if (
    moment.status === 'BOTH_UPLOADED' ||
    moment.status === 'REVEALED' ||
    moment.status === 'MATCH'
  ) {
    return true;
  }

  if (Boolean(moment.userReaction) && Boolean(moment.partnerReaction)) {
    return true;
  }

  // 3. Free tier locked history moments: fetchHistory only includes confirmed matched
  // moments in history with status === 'COMPLETED', and strips imageUrl/userPhoto/partnerPhoto/photos
  // when isLocked is true (>7 days on Free plan).
  const isSanitizedCompletedHistoryMoment =
    (moment.status === 'COMPLETED' || moment.status === 'REACTED') &&
    !moment.userPhoto &&
    !moment.partnerPhoto &&
    !moment.imageUrl &&
    (!moment.photos || moment.photos.length === 0);

  if (isSanitizedCompletedHistoryMoment) {
    return true;
  }

  return false;
}

function getNormalizedOurDayAuthorKey(
  photo: OurDayPhoto,
  currentUserId?: string,
  currentUserName?: string
): string {
  const cleanCurrentId = (currentUserId || '').trim();
  const cleanAuthorId = (photo.authorId || '').trim();

  if (cleanAuthorId && cleanAuthorId !== 'user_1' && cleanAuthorId !== 'local_user') {
    return cleanAuthorId;
  }

  if (
    cleanCurrentId &&
    (cleanAuthorId === 'user_1' ||
      cleanAuthorId === 'local_user' ||
      (!cleanAuthorId && currentUserName && photo.authorName === currentUserName))
  ) {
    return cleanCurrentId;
  }

  if (cleanAuthorId) {
    return cleanAuthorId;
  }

  return `name:${(photo.authorName || 'unknown').trim()}`;
}

/**
 * Extracts date keys where both partners uploaded a photo in "Наш день" (OUR_DAY).
 */
export function getMatchedOurDayDateKeys(
  ourDayPhotos: OurDayPhoto[] = [],
  couple?: CoupleState
): Set<string> {
  const matchedDays = new Set<string>();
  if (!Array.isArray(ourDayPhotos) || ourDayPhotos.length === 0) {
    return matchedDays;
  }

  const currentUserId = couple?.user?.id;
  const currentUserName = couple?.user?.name;
  const authorsByDay = new Map<string, Set<string>>();

  for (const p of ourDayPhotos) {
    if (!p || typeof p.imageUrl !== 'string' || !p.imageUrl.trim() || p.imageUrl.startsWith('blob:')) {
      continue;
    }
    const dKey = extractStarDateKey(p.dateKey, p.createdAt);
    if (!dKey) continue;
    const authorKey = getNormalizedOurDayAuthorKey(p, currentUserId, currentUserName);
    if (!authorsByDay.has(dKey)) {
      authorsByDay.set(dKey, new Set());
    }
    authorsByDay.get(dKey)!.add(authorKey);
  }

  for (const [dKey, authors] of authorsByDay.entries()) {
    if (authors.size >= 2) {
      matchedDays.add(dKey);
    }
  }

  return matchedDays;
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
    `${y}-${m}-04`, // 3. Match ⭐
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
 * Extracts unique calendar days with an authentic MATCH from the couple's history, today's moments, and Our Day.
 * Rule: Exactly 1 star per unique calendar day with a match (even if 2 or 3 touches occurred).
 */
export function getCoupleMatchedDates(
  couple: CoupleState,
  todayMoments: Moment[] = [],
  history: HistoryDay[] = [],
  referenceDate: Date = new Date(),
  ourDayPhotos: OurDayPhoto[] = []
): string[] {
  const events = getCoupleStarEvents(
    couple,
    todayMoments,
    history,
    [],
    referenceDate,
    ourDayPhotos
  );
  return Array.from(
    new Set(events.filter((e) => e.starType === 'moment').map((e) => e.dateKey))
  ).sort();
}

/**
 * Extracts all authentic, authoritatively typed StarEvents (Match ⭐ and Date ✨)
 * directly linked to real memories, preserving individual identities across devices.
 * "Наш день" (OUR_DAY) uses the exact same 'moment' star type as "Касание".
 */
export function getCoupleStarEvents(
  couple: CoupleState,
  todayMoments: Moment[] = [],
  history: HistoryDay[] = [],
  completedDateDays: string[] = [],
  referenceDate: Date = new Date(),
  ourDayPhotos: OurDayPhoto[] = []
): StarEvent[] {
  const pairId = couple?.id || couple?.inviteCode || couple?.pairSeed;
  const eventsMap = new Map<string, StarEvent>();
  const todayKey = toDateKey(referenceDate);

  const getSemanticKey = (ev: StarEvent): string => getRecordSemanticKey(ev);

  // 1. Seed from persisted accumulated star records (protects offline / initial boot before fetchHistory resolves)
  const persisted = getAccumulatedStarRecords(pairId);
  for (const ev of persisted) {
    if (ev && ev.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(ev.dateKey) && ev.dateKey !== '1970-01-01') {
      const norm = normalizeStarRecord(ev);
      eventsMap.set(getSemanticKey(norm), norm);
    }
  }

  // Precompute matched "Наш день" dates (uses same 'moment' star type as "Касание")
  const matchedOurDayDates = getMatchedOurDayDateKeys(ourDayPhotos, couple);
  const confirmedMomentDays = new Set<string>(matchedOurDayDates);

  // 2. Extract authentic events from real history days (including Free-tier locked days)
  for (const day of history || []) {
    if (!day) continue;
    let dayKey: string | null = null;
    if (day.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(day.dateKey)) {
      dayKey = day.dateKey;
    } else if (day.id?.startsWith('day-')) {
      const raw = day.id.replace('day-', '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) dayKey = raw;
    } else if (day.id?.startsWith('hist-')) {
      const raw = day.id.replace('hist-', '');
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) dayKey = raw;
    }

    if (!dayKey && Array.isArray(day.moments)) {
      for (const m of day.moments) {
        const extracted = extractStarDateKey(m?.dateKey, m?.createdAt);
        if (extracted) {
          dayKey = extracted;
          break;
        }
      }
    }

    if (!dayKey || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey) || dayKey === '1970-01-01') continue;

    // A. Check for Match moments (daily touch or OUR_DAY) in this day:
    const nonDateMoments = Array.isArray(day.moments)
      ? day.moments.filter((m) => m && !isDateMomentObj(m))
      : [];

    const hasMatchMoment =
      nonDateMoments.some((m) => isMomentMatched(m)) ||
      (typeof day.duoMomentsCount === 'number' && day.duoMomentsCount > 0);
    const isLockedWithTouchHistory =
      Boolean(day.isLocked) &&
      (typeof day.duoMomentsCount === 'number'
        ? day.duoMomentsCount > 0
        : nonDateMoments.length > 0);

    if (hasMatchMoment || isLockedWithTouchHistory || matchedOurDayDates.has(dayKey)) {
      confirmedMomentDays.add(dayKey);
      const ev: StarEvent = {
        id: `match_${dayKey}`,
        dateKey: dayKey,
        starType: 'moment',
        title: 'Касание',
      };
      eventsMap.set(getSemanticKey(ev), ev);
    } else if (
      Array.isArray(day.moments) &&
      day.moments.length > 0 &&
      dayKey !== todayKey &&
      typeof day.duoMomentsCount === 'number' &&
      day.duoMomentsCount === 0
    ) {
      // Day only had a Date moment and confirmed 0 touch/OUR_DAY matches
      eventsMap.delete(`moment_${dayKey}`);
    }

    // B. Check for completed Date moments in this day (including locked Free-tier history):
    let addedDateForDay = false;
    if (Array.isArray(day.moments)) {
      for (const m of day.moments) {
        if (m && isDateMomentObj(m)) {
          const hasPhotoOrCompleted = Boolean(
            m.imageUrl ||
              m.userPhoto ||
              m.partnerPhoto ||
              (m.photos && m.photos.length > 0) ||
              m.status === 'COMPLETED' ||
              day.isLocked
          );
          if (hasPhotoOrCompleted) {
            const ev: StarEvent = {
              id: `date_${dayKey}`,
              dateKey: dayKey,
              starType: 'date',
              momentId: m.id,
              title: m.prompt || 'Свидание',
              createdAt: m.createdAt,
            };
            eventsMap.set(getSemanticKey(ev), ev);
            addedDateForDay = true;
          }
        }
      }
    }
    if (!addedDateForDay && day.hasDateCompleted) {
      const ev: StarEvent = {
        id: `date_${dayKey}`,
        dateKey: dayKey,
        starType: 'date',
        title: 'Свидание',
      };
      eventsMap.set(getSemanticKey(ev), ev);
    }
  }

  // 3. Extract events from todayMoments using each moment's authoritative dateKey
  if (Array.isArray(todayMoments)) {
    for (const m of todayMoments) {
      if (!m) continue;
      const mDateKey = extractStarDateKey(m.dateKey, m.createdAt) || todayKey;
      if (isDateMomentObj(m)) {
        const hasPhoto = Boolean(
          m.imageUrl ||
            m.userPhoto ||
            m.partnerPhoto ||
            (m.photos && m.photos.length > 0)
        );
        if (hasPhoto) {
          const ev: StarEvent = {
            id: `date_${mDateKey}`,
            dateKey: mDateKey,
            starType: 'date',
            momentId: m.id,
            title: m.prompt || 'Свидание',
            createdAt: m.createdAt,
          };
          eventsMap.set(getSemanticKey(ev), ev);
        }
      } else if (isMomentMatched(m)) {
        confirmedMomentDays.add(mDateKey);
        const ev: StarEvent = {
          id: `match_${mDateKey}`,
          dateKey: mDateKey,
          starType: 'moment',
          title: 'Касание',
        };
        eventsMap.set(getSemanticKey(ev), ev);
      }
    }
  }

  // 4. Apply all matched "Наш день" (OUR_DAY) days as 'moment' stars ("Касание")
  for (const dKey of matchedOurDayDates) {
    const ev: StarEvent = {
      id: `match_${dKey}`,
      dateKey: dKey,
      starType: 'moment',
      title: 'Касание',
    };
    eventsMap.set(getSemanticKey(ev), ev);
  }

  // 5. Any completed date days recorded from active/completed date invitation service
  for (const d of completedDateDays || []) {
    const dKey = extractStarDateKey(d);
    if (dKey) {
      const semKey = `date_${dKey}`;
      if (!eventsMap.has(semKey)) {
        const ev: StarEvent = {
          id: `date_${dKey}`,
          dateKey: dKey,
          starType: 'date',
          title: 'Свидание',
        };
        eventsMap.set(semKey, ev);
      }
    }
  }

  // 6. Sort chronologically: by date ascending, then moment before date
  const sortedEvents = Array.from(eventsMap.values()).sort((a, b) => {
    const cmp = a.dateKey.localeCompare(b.dateKey);
    if (cmp !== 0) return cmp;
    if (a.starType === b.starType) return a.id.localeCompare(b.id);
    return a.starType === 'moment' ? -1 : 1;
  });

  // 7. Persist in registry
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
  referenceDate: Date = new Date(),
  ourDayPhotos: OurDayPhoto[] = []
): string[] {
  const events = getCoupleStarEvents(
    couple,
    todayMoments,
    history,
    completedDateDays,
    referenceDate,
    ourDayPhotos
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
