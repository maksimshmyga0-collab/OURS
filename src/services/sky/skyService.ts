import { Moment, HistoryDay, CoupleState } from '../../types';
import { pluralizeWord } from '../gamification';

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
 * Checks whether a Moment represents an authentic completed MATCH
 */
export function isMomentMatched(moment: Moment): boolean {
  if (!moment) return false;
  const hasBoth = Boolean(
    (moment.userPhoto && moment.partnerPhoto) ||
    (moment.photos && moment.photos.length >= 2)
  );
  const isMatchStatus =
    moment.status === 'COMPLETED' ||
    moment.status === 'REVEALED' ||
    moment.status === 'REACTED';

  return hasBoth && isMatchStatus;
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

  // 2. Check real history days
  for (const day of history) {
    const hasMatch = day.moments.some(isMomentMatched);
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

      if (!key) {
        for (const m of day.moments) {
          if (isMomentMatched(m)) {
            if (m.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(m.dateKey)) {
              key = m.dateKey;
            } else if (m.createdAt) {
              try {
                const d = new Date(m.createdAt);
                if (!isNaN(d.getTime())) key = toDateKey(d);
              } catch {}
            }
            if (key) break;
          }
        }
      }

      if (key) {
        matchedDatesSet.add(key);
      }
    }
  }

  // If no authentic matches recorded yet, provide the 7 test stars (4 matches + 3 dates in random order)
  if (matchedDatesSet.size === 0) {
    return getTestMatchedDates(referenceDate);
  }

  return Array.from(matchedDatesSet).sort();
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
  completedDateDays: string[] = []
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
    const dateKey = matchedDatesInMonth[idx] || '';

    // Determine star type based on whether a completed date occurred on this day
    const isDateEvent = Boolean(
      dateKey && completedDateDays.length > 0 && completedDateDays.includes(dateKey)
    );
    const starType: StarEventType = isDateEvent ? 'date' : 'moment';

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
  } else if (dateStarsCount > 0) {
    statusText = `${momentStarsCount} ${pluralizeWord(momentStarsCount, 'касание', 'касания', 'касаний')} и ${dateStarsCount} ${pluralizeWord(dateStarsCount, 'свидание', 'свидания', 'свиданий')}`;
  } else {
    statusText = 'Ваш уникальный узор звёзд продолжает расти.';
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
