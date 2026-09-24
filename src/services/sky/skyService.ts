import { Moment, HistoryDay, CoupleState } from '../../types';

export interface StarPoint {
  id: number;
  x: number; // 0 - 100
  y: number; // 0 - 100
  role: 'anchor' | 'body' | 'detail' | 'companion';
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

export interface ConstellationTemplate {
  id: string;
  name: string;
  meaning: string;
  // Ordered sequence of points (0 to N)
  points: Array<{ x: number; y: number; role?: 'anchor' | 'body' | 'detail' }>;
  // Connections between point indices
  lines: Array<[number, number]>;
  // Extra companion points if month has more days than points in the figure (up to 31)
  companions: Array<{ x: number; y: number }>;
}

export interface SkyState {
  month: number; // 1 - 12
  year: number;
  monthName: string;
  title: string;
  template: {
    id: string;
    name: string;
    meaning: string;
  };
  starsCount: number;
  maxStarsInMonth: number;
  points: StarPoint[];
  lines: ConstellationLine[];
  isCompleted: boolean;
  statusText: string;
}

// --------------------------------------------------------------------------
// 12 SERENE CONSTELLATION TEMPLATES
// Handcrafted minimal abstract figures (cat, bunny, bear, heart, swan, butterfly, moon, house, etc.)
// --------------------------------------------------------------------------

const TEMPLATES: ConstellationTemplate[] = [
  // 1. КОТИК (Cat)
  {
    id: 'cat',
    name: 'Котик',
    meaning: 'Тёплый уют ваших общих дней',
    points: [
      { x: 34, y: 22, role: 'anchor' }, // 0: Left ear tip
      { x: 28, y: 36, role: 'body' },   // 1: Left ear base
      { x: 44, y: 30, role: 'body' },   // 2: Head top
      { x: 66, y: 22, role: 'anchor' }, // 3: Right ear tip
      { x: 72, y: 36, role: 'body' },   // 4: Right ear base
      { x: 50, y: 44, role: 'body' },   // 5: Chin
      { x: 40, y: 36, role: 'detail' }, // 6: Left eye
      { x: 60, y: 36, role: 'detail' }, // 7: Right eye
      { x: 50, y: 38, role: 'detail' }, // 8: Nose
      { x: 36, y: 60, role: 'body' },   // 9: Left chest
      { x: 64, y: 60, role: 'body' },   // 10: Right side
      { x: 40, y: 78, role: 'body' },   // 11: Left paw
      { x: 60, y: 78, role: 'body' },   // 12: Right paw
      { x: 50, y: 80, role: 'body' },   // 13: Belly base
      { x: 70, y: 74, role: 'detail' }, // 14: Tail base
      { x: 80, y: 66, role: 'detail' }, // 15: Tail curve
      { x: 82, y: 52, role: 'detail' }, // 16: Tail tip
      { x: 20, y: 36, role: 'detail' }, // 17: Left whisker
      { x: 80, y: 36, role: 'detail' }, // 18: Right whisker
      { x: 50, y: 62, role: 'detail' }, // 19: Heart on chest
    ],
    lines: [
      [0, 1], [0, 2], [2, 3], [3, 4], [1, 5], [4, 5],
      [6, 8], [7, 8],
      [1, 9], [4, 10], [9, 11], [10, 12], [11, 13], [12, 13],
      [12, 14], [14, 15], [15, 16],
      [1, 17], [4, 18], [5, 19],
    ],
    companions: [
      { x: 18, y: 20 }, { x: 82, y: 20 }, { x: 22, y: 76 }, { x: 50, y: 14 },
      { x: 14, y: 50 }, { x: 86, y: 78 }, { x: 30, y: 88 }, { x: 70, y: 88 },
      { x: 50, y: 92 }, { x: 88, y: 38 }, { x: 12, y: 36 },
    ],
  },

  // 2. ЗАЙЧИК (Bunny)
  {
    id: 'bunny',
    name: 'Зайчик',
    meaning: 'Нежность и чуткая забота',
    points: [
      { x: 36, y: 14, role: 'anchor' }, // 0: Left ear tip
      { x: 42, y: 30, role: 'body' },   // 1: Left ear base
      { x: 50, y: 32, role: 'body' },   // 2: Head center
      { x: 58, y: 30, role: 'body' },   // 3: Right ear base
      { x: 62, y: 12, role: 'anchor' }, // 4: Right ear tip
      { x: 32, y: 42, role: 'body' },   // 5: Left cheek
      { x: 68, y: 42, role: 'body' },   // 6: Right cheek
      { x: 50, y: 50, role: 'body' },   // 7: Chin
      { x: 42, y: 40, role: 'detail' }, // 8: Left eye
      { x: 58, y: 40, role: 'detail' }, // 9: Right eye
      { x: 50, y: 44, role: 'detail' }, // 10: Nose
      { x: 38, y: 64, role: 'body' },   // 11: Left side
      { x: 62, y: 64, role: 'body' },   // 12: Right side
      { x: 38, y: 78, role: 'body' },   // 13: Left foot
      { x: 62, y: 78, role: 'body' },   // 14: Right foot
      { x: 50, y: 82, role: 'body' },   // 15: Bottom
      { x: 74, y: 74, role: 'detail' }, // 16: Tail
      { x: 80, y: 68, role: 'detail' }, // 17: Tail puff
      { x: 50, y: 60, role: 'detail' }, // 18: Heart tummy
    ],
    lines: [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [1, 5], [3, 6], [5, 7], [6, 7],
      [8, 10], [9, 10],
      [5, 11], [6, 12], [11, 13], [12, 14], [13, 15], [14, 15],
      [12, 16], [16, 17], [7, 18],
    ],
    companions: [
      { x: 20, y: 22 }, { x: 78, y: 18 }, { x: 18, y: 60 }, { x: 84, y: 52 },
      { x: 50, y: 92 }, { x: 26, y: 86 }, { x: 74, y: 88 }, { x: 48, y: 8 },
      { x: 86, y: 82 }, { x: 14, y: 38 }, { x: 86, y: 34 },
    ],
  },

  // 3. МИШКА (Teddy Bear)
  {
    id: 'bear',
    name: 'Мишка',
    meaning: 'Надёжные и тёплые объятия',
    points: [
      { x: 30, y: 20, role: 'anchor' }, // 0: Left round ear
      { x: 40, y: 26, role: 'body' },   // 1: Head top left
      { x: 50, y: 24, role: 'body' },   // 2: Head crown
      { x: 60, y: 26, role: 'body' },   // 3: Head top right
      { x: 70, y: 20, role: 'anchor' }, // 4: Right round ear
      { x: 32, y: 38, role: 'body' },   // 5: Left cheek
      { x: 68, y: 38, role: 'body' },   // 6: Right cheek
      { x: 50, y: 46, role: 'body' },   // 7: Chin
      { x: 42, y: 34, role: 'detail' }, // 8: Left eye
      { x: 58, y: 34, role: 'detail' }, // 9: Right eye
      { x: 50, y: 38, role: 'detail' }, // 10: Muzzle center
      { x: 24, y: 56, role: 'body' },   // 11: Left arm
      { x: 76, y: 56, role: 'body' },   // 12: Right arm
      { x: 36, y: 68, role: 'body' },   // 13: Left hip
      { x: 64, y: 68, role: 'body' },   // 14: Right hip
      { x: 34, y: 82, role: 'body' },   // 15: Left foot
      { x: 66, y: 82, role: 'body' },   // 16: Right foot
      { x: 50, y: 84, role: 'body' },   // 17: Base
      { x: 50, y: 62, role: 'detail' }, // 18: Heart on chest
    ],
    lines: [
      [0, 1], [1, 2], [2, 3], [3, 4],
      [1, 5], [3, 6], [5, 7], [6, 7],
      [8, 10], [9, 10],
      [5, 11], [6, 12], [11, 13], [12, 14],
      [13, 15], [14, 16], [15, 17], [16, 17],
      [7, 18],
    ],
    companions: [
      { x: 16, y: 26 }, { x: 84, y: 26 }, { x: 18, y: 72 }, { x: 82, y: 72 },
      { x: 50, y: 12 }, { x: 50, y: 94 }, { x: 26, y: 90 }, { x: 74, y: 90 },
      { x: 88, y: 44 }, { x: 12, y: 44 }, { x: 88, y: 86 }, { x: 12, y: 86 },
    ],
  },

  // 4. СЕРДЦЕ (Heart)
  {
    id: 'heart',
    name: 'Сердце',
    meaning: 'Одно дыхание на двоих',
    points: [
      { x: 50, y: 30, role: 'anchor' }, // 0: Top cleft
      { x: 36, y: 18, role: 'anchor' }, // 1: Left lobe crest
      { x: 22, y: 26, role: 'body' },   // 2: Left upper curve
      { x: 18, y: 42, role: 'body' },   // 3: Left widest
      { x: 28, y: 60, role: 'body' },   // 4: Left lower slope
      { x: 38, y: 74, role: 'body' },   // 5: Left bottom slope
      { x: 50, y: 86, role: 'anchor' }, // 6: Heart bottom tip
      { x: 62, y: 74, role: 'body' },   // 7: Right bottom slope
      { x: 72, y: 60, role: 'body' },   // 8: Right lower slope
      { x: 82, y: 42, role: 'body' },   // 9: Right widest
      { x: 78, y: 26, role: 'body' },   // 10: Right upper curve
      { x: 64, y: 18, role: 'anchor' }, // 11: Right lobe crest
      { x: 50, y: 46, role: 'detail' }, // 12: Inner heart core
      { x: 42, y: 52, role: 'detail' }, // 13: Inner left
      { x: 58, y: 52, role: 'detail' }, // 14: Inner right
      { x: 50, y: 62, role: 'detail' }, // 15: Inner bottom
    ],
    lines: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6],
      [6, 7], [7, 8], [8, 9], [9, 10], [10, 11], [11, 0],
      [0, 12], [12, 13], [12, 14], [13, 15], [14, 15], [15, 6],
    ],
    companions: [
      { x: 16, y: 14 }, { x: 84, y: 14 }, { x: 12, y: 68 }, { x: 88, y: 68 },
      { x: 50, y: 12 }, { x: 50, y: 94 }, { x: 30, y: 90 }, { x: 70, y: 90 },
      { x: 8, y: 34 }, { x: 92, y: 34 }, { x: 36, y: 38 }, { x: 64, y: 38 },
      { x: 26, y: 78 }, { x: 74, y: 78 }, { x: 50, y: 74 },
    ],
  },

  // 5. БАБОЧКА (Butterfly)
  {
    id: 'butterfly',
    name: 'Бабочка',
    meaning: 'Лёгкость и трепет первой встречи',
    points: [
      { x: 50, y: 28, role: 'anchor' }, // 0: Head
      { x: 50, y: 44, role: 'body' },   // 1: Thorax
      { x: 50, y: 64, role: 'body' },   // 2: Abdomen
      { x: 50, y: 80, role: 'body' },   // 3: Tail
      // Left upper wing
      { x: 38, y: 22, role: 'anchor' }, // 4: Left antenna tip
      { x: 24, y: 20, role: 'anchor' }, // 5: Left wing apex
      { x: 14, y: 34, role: 'body' },   // 6: Left wing outer edge
      { x: 28, y: 48, role: 'body' },   // 7: Left wing lower joint
      // Left lower wing
      { x: 22, y: 66, role: 'body' },   // 8: Left bottom wing lobe
      { x: 36, y: 74, role: 'body' },   // 9: Left lower wing inner
      // Right upper wing
      { x: 62, y: 22, role: 'anchor' }, // 10: Right antenna tip
      { x: 76, y: 20, role: 'anchor' }, // 11: Right wing apex
      { x: 86, y: 34, role: 'body' },   // 12: Right wing outer edge
      { x: 72, y: 48, role: 'body' },   // 13: Right wing lower joint
      // Right lower wing
      { x: 78, y: 66, role: 'body' },   // 14: Right bottom wing lobe
      { x: 64, y: 74, role: 'body' },   // 15: Right lower wing inner
    ],
    lines: [
      [0, 4], [0, 10], [0, 1], [1, 2], [2, 3],
      [1, 5], [5, 6], [6, 7], [7, 1],
      [1, 8], [8, 9], [9, 2],
      [1, 11], [11, 12], [12, 13], [13, 1],
      [1, 14], [14, 15], [15, 2],
    ],
    companions: [
      { x: 12, y: 16 }, { x: 88, y: 16 }, { x: 10, y: 52 }, { x: 90, y: 52 },
      { x: 16, y: 84 }, { x: 84, y: 84 }, { x: 50, y: 12 }, { x: 50, y: 92 },
      { x: 30, y: 36 }, { x: 70, y: 36 }, { x: 32, y: 60 }, { x: 68, y: 60 },
      { x: 24, y: 92 }, { x: 76, y: 92 }, { x: 40, y: 88 },
    ],
  },

  // 6. ЛУНА И ЗВЕЗДА (Moon & Little Star)
  {
    id: 'moon',
    name: 'Полумесяц',
    meaning: 'Тихий свет, хранящий ваши сны',
    points: [
      { x: 52, y: 14, role: 'anchor' }, // 0: Moon top cusp
      { x: 36, y: 22, role: 'body' },   // 1: Moon outer upper curve
      { x: 26, y: 38, role: 'body' },   // 2: Moon outer mid curve
      { x: 24, y: 56, role: 'body' },   // 3: Moon outer lower curve
      { x: 32, y: 72, role: 'body' },   // 4: Moon outer bottom
      { x: 48, y: 82, role: 'anchor' }, // 5: Moon bottom cusp
      { x: 42, y: 66, role: 'body' },   // 6: Moon inner bottom
      { x: 38, y: 50, role: 'body' },   // 7: Moon inner mid
      { x: 44, y: 32, role: 'body' },   // 8: Moon inner upper
      // Little companion star resting in the crescent
      { x: 68, y: 44, role: 'anchor' }, // 9: Star center
      { x: 68, y: 34, role: 'detail' }, // 10: Star top
      { x: 76, y: 44, role: 'detail' }, // 11: Star right
      { x: 68, y: 54, role: 'detail' }, // 12: Star bottom
      { x: 60, y: 44, role: 'detail' }, // 13: Star left
    ],
    lines: [
      [0, 1], [1, 2], [2, 3], [3, 4], [4, 5],
      [5, 6], [6, 7], [7, 8], [8, 0],
      [9, 10], [9, 11], [9, 12], [9, 13],
      [7, 9],
    ],
    companions: [
      { x: 16, y: 18 }, { x: 84, y: 20 }, { x: 14, y: 70 }, { x: 86, y: 68 },
      { x: 74, y: 14 }, { x: 58, y: 22 }, { x: 82, y: 52 }, { x: 78, y: 82 },
      { x: 50, y: 92 }, { x: 24, y: 88 }, { x: 62, y: 74 }, { x: 88, y: 34 },
      { x: 12, y: 42 }, { x: 32, y: 10 }, { x: 72, y: 92 }, { x: 92, y: 88 },
      { x: 46, y: 4 },
    ],
  },
];

// --------------------------------------------------------------------------
// HELPER FUNCTIONS & PRNG
// --------------------------------------------------------------------------

function createPrng(seedString: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 16777619);
  }
  return function () {
    h += 0x6d2b79f5;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const MONTH_NAMES_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export function getMonthNameRu(month: number): string {
  return MONTH_NAMES_RU[(month - 1 + 12) % 12];
}

/**
 * Check if a moment has completed its MATCH
 * (status is REVEALED, REACTED, COMPLETED or both photos exist)
 */
export function isMomentMatched(m: Moment): boolean {
  return Boolean(
    m.status === 'REVEALED' ||
    m.status === 'REACTED' ||
    m.status === 'COMPLETED' ||
    (m.userPhoto && m.partnerPhoto) ||
    (m.photos && m.photos.length >= 2)
  );
}

/**
 * Extract deduplicated list of calendar dates (YYYY-MM-DD) that had at least 1 MATCH.
 * 1-3 moments in a day = exactly 1 matched date / 1 star.
 * Uses strictly real couple data (no fake/sample dates).
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
      // Determine date string from moment.dateKey or day.id
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

/**
 * Get the total number of calendar days in a given month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

// --------------------------------------------------------------------------
// DETERMINISTIC QUIET SKY GENERATION
// --------------------------------------------------------------------------

export function getSkyForMonth(
  pairSeed: string,
  year: number,
  month: number,
  starsCount: number,
  isCurrentMonth: boolean = true
): SkyState {
  const seedKey = `${pairSeed.trim().toLowerCase()}_sky_${year}_${month}`;
  const prng = createPrng(seedKey);

  // 1. Pick template deterministically
  const templateIdx = Math.floor(prng() * TEMPLATES.length);
  const template = TEMPLATES[templateIdx];

  // 2. Fixed coordinates
  const allRawPoints: Array<{ x: number; y: number; role: 'anchor' | 'body' | 'detail' | 'companion' }> = [
    ...template.points.map((p) => ({
      x: p.x,
      y: p.y,
      role: (p.role || 'body') as 'anchor' | 'body' | 'detail' | 'companion',
    })),
    ...template.companions.map((c) => ({
      x: c.x,
      y: c.y,
      role: 'companion' as const,
    })),
  ];

  // 3. Build star points list
  const maxStarsInMonth = getDaysInMonth(year, month);
  const effectiveStarsCount = Math.min(starsCount, maxStarsInMonth);

  const points: StarPoint[] = allRawPoints.map((raw, idx) => {
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

  // 4. Build lines between points
  // A line is lit if BOTH its connecting points are lit!
  const lines: ConstellationLine[] = template.lines.map(([fromIdx, toIdx]) => {
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

  // 5. Quiet emotional status text
  let statusText = 'Здесь будет ваша история.';
  if (effectiveStarsCount === 0) {
    statusText = 'Пустое небо ждёт вашего первого общего момента.';
  } else if (effectiveStarsCount === 1) {
    statusText = 'Первая звезда зажглась в вашем небе.';
  } else if (effectiveStarsCount === 2) {
    statusText = 'Две звезды тихо соединяются.';
  } else if (!isCurrentMonth) {
    statusText = `Завершённое созвездие: ${template.name}`;
  } else {
    statusText = `Созвездие тихо складывается: ${template.name}`;
  }

  const monthName = getMonthNameRu(month);

  return {
    month,
    year,
    monthName,
    title: `${monthName} ${year}`,
    template: {
      id: template.id,
      name: template.name,
      meaning: template.meaning,
    },
    starsCount: effectiveStarsCount,
    maxStarsInMonth,
    points,
    lines,
    isCompleted: effectiveStarsCount >= maxStarsInMonth,
    statusText,
  };
}

/**
 * Developer Sandbox helper for Demo Mode:
 * Creates or updates simulated matched days in history for the specified month and year.
 * This guarantees authentic data flow through getCoupleMatchedDates() and CoupleSkyView.
 */
export function createSimulatedSkyHistory(
  targetCount: number,
  year: number,
  month: number,
  existingHistory: HistoryDay[]
): HistoryDay[] {
  const prefix = `hist-sim-${year}-${String(month).padStart(2, '0')}`;
  // Remove existing simulated days for this month
  const baseHistory = existingHistory.filter((h) => !h.id.startsWith(prefix));

  if (targetCount <= 0) {
    return baseHistory;
  }

  const simulatedDays: HistoryDay[] = [];
  const maxDays = getDaysInMonth(year, month);
  const safeCount = Math.min(targetCount, maxDays);

  for (let day = 1; day <= safeCount; day++) {
    const dayStr = String(day).padStart(2, '0');
    const monthStr = String(month).padStart(2, '0');
    const dateKey = `${year}-${monthStr}-${dayStr}`;
    const isoString = `${dateKey}T12:00:00.000Z`;

    simulatedDays.push({
      id: `${prefix}-${dayStr}`,
      title: `${day} ${getMonthNameRu(month).toLowerCase()}`,
      subtitle: 'Тестовый день MATCH',
      dateStr: `${day} ${getMonthNameRu(month).toLowerCase()} ${year}`,
      isLocked: false,
      moments: [
        {
          id: `sim-moment-${dateKey}-1`,
          pairId: 'pair-default-1',
          createdBy: 'user',
          createdAt: isoString,
          dateKey,
          imageUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
          order: 1,
          label: 'Тестовое касание',
          prompt: 'Общий момент',
          subtext: 'Успешный MATCH',
          themeColor: 'pink',
          userPhoto: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
          partnerPhoto: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
          photos: [
            {
              userId: 'user',
              imageUrl: 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=600&auto=format&fit=crop&q=80',
              createdAt: isoString,
            },
            {
              userId: 'partner',
              imageUrl: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=600&auto=format&fit=crop&q=80',
              createdAt: isoString,
            },
          ],
          userReaction: '❤️',
          partnerReaction: '❤️',
          status: 'COMPLETED',
          completedAt: isoString,
          completedTimestamp: new Date(isoString).getTime(),
        },
      ],
    });
  }

  return [...baseHistory, ...simulatedDays];
}
