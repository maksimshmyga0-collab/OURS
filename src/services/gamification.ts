/**
 * Couple Pluralization & Gamification Service for OURS
 */

/**
 * Pluralize Russian nouns
 */
export function pluralizeWord(count: number, one: string, twoToFour: string, many: string): string {
  const abs = Math.abs(count) % 100;
  const lastDigit = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (lastDigit > 1 && lastDigit < 5) return twoToFour;
  if (lastDigit === 1) return one;
  return many;
}

export interface CoupleLevelInfo {
  level: number;
  levelTitle: string;
  progressPercent: number;
  progressText: string;
  nextLevelThreshold: number | null;
  remainingToNext: number;
}

const LEVEL_THRESHOLDS = [
  { minMoments: 0, title: 'Уровень 1: Первые искорки' },
  { minMoments: 5, title: 'Уровень 2: Тёплое дыхание' },
  { minMoments: 15, title: 'Уровень 3: Общее притяжение' },
  { minMoments: 30, title: 'Уровень 4: Созвездие чувств' },
  { minMoments: 60, title: 'Уровень 5: Бесконечный космос' },
];

export function getCoupleLevel(totalMoments: number): CoupleLevelInfo {
  let currentLevelIdx = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalMoments >= LEVEL_THRESHOLDS[i].minMoments) {
      currentLevelIdx = i;
    } else {
      break;
    }
  }

  const currentLevel = LEVEL_THRESHOLDS[currentLevelIdx];
  const nextLevel = LEVEL_THRESHOLDS[currentLevelIdx + 1] || null;

  if (!nextLevel) {
    return {
      level: currentLevelIdx + 1,
      levelTitle: currentLevel.title,
      progressPercent: 100,
      progressText: `${totalMoments} моментов`,
      nextLevelThreshold: null,
      remainingToNext: 0,
    };
  }

  const range = nextLevel.minMoments - currentLevel.minMoments;
  const progressInLevel = totalMoments - currentLevel.minMoments;
  const progressPercent = Math.min(100, Math.max(0, Math.round((progressInLevel / range) * 100)));
  const remainingToNext = Math.max(0, nextLevel.minMoments - totalMoments);

  return {
    level: currentLevelIdx + 1,
    levelTitle: currentLevel.title,
    progressPercent,
    progressText: `${totalMoments} / ${nextLevel.minMoments}`,
    nextLevelThreshold: nextLevel.minMoments,
    remainingToNext,
  };
}
