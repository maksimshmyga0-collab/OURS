import { Moment, HistoryDay, CoupleState } from '../../types/index';

export interface StarPoint {
  id: number;
  x: number; // 0 - 100
  y: number; // 0 - 100
  role: 'anchor' | 'body';
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
      for (const m of day.moments) {
        if (isMomentMatched(m)) {
          let key: string | null = null;
          if (m.dateKey && /^\d{4}-\d{2}-\d{2}$/.test(m.dateKey)) {
            key = m.dateKey;
          } else if (day.id?.startsWith('hist-')) {
            const rawId = day.id.replace('hist-', '');
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawId)) {
              key = rawId;
            }
          } else if (m.createdAt) {
            try {
              const d = new Date(m.createdAt);
              if (!isNaN(d.getTime())) key = toDateKey(d);
            } catch {}
          }

          if (key) {
            matchedDatesSet.add(key);
            break;
          }
        }
      }
    }
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

/**
 * Deterministically generates the complete abstract celestial layout for a pair and month.
 * Stars are placed organically with natural varying distances and clusters, completely free of pre-drawn shapes.
 */
function generateMonthLayout(seedKey: string, maxDays: number): GeneratedMonthLayout {
  const prng = murmurhash3(seedKey);
  const stars: Array<{ id: number; x: number; y: number; role: 'anchor' | 'body' }> = [];

  const minDistance = 8.5; // Natural minimum spacing between stars
  const paddingX = 14;
  const paddingY = 14;
  const usableWidth = 100 - paddingX * 2;
  const usableHeight = 100 - paddingY * 2;

  let attempts = 0;
  while (stars.length < maxDays && attempts < 3000) {
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
      const isAnchor = prng() < 0.26;
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
      role: prng() < 0.26 ? 'anchor' : 'body',
    });
  }

  // Generate gentle subtle constellation lines between closest neighbors
  const lines: Array<[number, number]> = [];
  const maxLineDist = 23.5;
  const degree = new Array(stars.length).fill(0);

  const edges: Array<{ from: number; to: number; dist: number }> = [];
  for (let i = 0; i < stars.length; i++) {
    for (let j = i + 1; j < stars.length; j++) {
      const dist = Math.hypot(stars[i].x - stars[j].x, stars[i].y - stars[j].y);
      if (dist <= maxLineDist) {
        edges.push({ from: i, to: j, dist });
      }
    }
  }

  // Sort edges by distance so closest neighbors connect first
  edges.sort((a, b) => a.dist - b.dist);

  for (const edge of edges) {
    // Keep max 2 connections per star to avoid forming a grid/mesh
    if (degree[edge.from] < 2 && degree[edge.to] < 2) {
      degree[edge.from]++;
      degree[edge.to]++;
      lines.push([edge.from, edge.to]);
    }
  }

  return { stars, lines };
}

/**
 * Builds the authoritative SkyState for a specific month and stars count.
 */
export function getSkyForMonth(
  pairSeed: string,
  year: number,
  month: number,
  starsCount: number,
  isCurrentMonth: boolean = true
): SkyState {
  const cleanSeed = (pairSeed || 'ours').trim().toLowerCase();
  const seedKey = `${cleanSeed}_sky_${year}_${month}`;
  const maxStarsInMonth = getDaysInMonth(year, month);
  const effectiveStarsCount = Math.min(Math.max(0, starsCount), maxStarsInMonth);

  // Generate deterministic layout for this month
  const layout = generateMonthLayout(seedKey, maxStarsInMonth);

  // Build points
  const points: StarPoint[] = layout.stars.map((raw, idx) => {
    const isLit = idx < effectiveStarsCount;
    const isNewest = idx === effectiveStarsCount - 1 && isCurrentMonth && isLit;

    return {
      id: idx,
      x: raw.x,
      y: raw.y,
      role: raw.role,
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

  // Quiet emotional status text
  let statusText = 'Здесь будет ваша история.';
  if (effectiveStarsCount === 0) {
    statusText = 'Пустое небо ждёт вашего первого общего момента.';
  } else if (effectiveStarsCount === 1) {
    statusText = 'Первая звезда зажглась в вашем небе.';
  } else if (effectiveStarsCount <= 4) {
    statusText = 'Звёзды тихо соединяются в ваше созвездие.';
  } else if (effectiveStarsCount >= maxStarsInMonth) {
    statusText = 'Завершённое созвездие месяца.';
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
    maxStarsInMonth,
    points,
    lines,
    isCompleted: effectiveStarsCount >= maxStarsInMonth,
    statusText,
  };
}
