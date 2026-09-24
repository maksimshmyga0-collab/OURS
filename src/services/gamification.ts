/**
 * Couple Gamification and Milestones Service for OURS
 */

export interface CoupleLevelInfo {
  levelTitle: string;
  levelIcon: string;
  currentMoments: number;
  nextLevelThreshold: number | null;
  progressPercent: number; // 0 - 100
  remainingToNext: number;
  progressText: string; // e.g. "23 / 30 моментов"
}

/**
 * Calculates emotional couple milestones level based strictly on total moments
 * 0–4   → 🌱 «Начало»
 * 5–14  → 🌿 «Привыкаем»
 * 15–29 → 🌸 «Своя атмосфера»
 * 30–59 → 💕 «Наша история»
 * 60+   → ✨ «Особенная история»
 */
export function getCoupleLevel(totalMoments: number): CoupleLevelInfo {
  const count = Math.max(0, totalMoments || 0);

  if (count < 5) {
    const nextLevelThreshold = 5;
    const progressPercent = Math.min(100, Math.round((count / nextLevelThreshold) * 100));
    return {
      levelTitle: 'Начало',
      levelIcon: '🌱',
      currentMoments: count,
      nextLevelThreshold,
      progressPercent,
      remainingToNext: Math.max(0, nextLevelThreshold - count),
      progressText: `${count} / ${nextLevelThreshold} моментов`,
    };
  }

  if (count < 15) {
    const nextLevelThreshold = 15;
    const progressPercent = Math.min(100, Math.round((count / nextLevelThreshold) * 100));
    return {
      levelTitle: 'Привыкаем',
      levelIcon: '🌿',
      currentMoments: count,
      nextLevelThreshold,
      progressPercent,
      remainingToNext: Math.max(0, nextLevelThreshold - count),
      progressText: `${count} / ${nextLevelThreshold} моментов`,
    };
  }

  if (count < 30) {
    const nextLevelThreshold = 30;
    const progressPercent = Math.min(100, Math.round((count / nextLevelThreshold) * 100));
    return {
      levelTitle: 'Своя атмосфера',
      levelIcon: '🌸',
      currentMoments: count,
      nextLevelThreshold,
      progressPercent,
      remainingToNext: Math.max(0, nextLevelThreshold - count),
      progressText: `${count} / ${nextLevelThreshold} моментов`,
    };
  }

  if (count < 60) {
    const nextLevelThreshold = 60;
    const progressPercent = Math.min(100, Math.round((count / nextLevelThreshold) * 100));
    return {
      levelTitle: 'Наша история',
      levelIcon: '💕',
      currentMoments: count,
      nextLevelThreshold,
      progressPercent,
      remainingToNext: Math.max(0, nextLevelThreshold - count),
      progressText: `${count} / ${nextLevelThreshold} моментов`,
    };
  }

  // 60+ moments: highest milestone
  return {
    levelTitle: 'Особенная история',
    levelIcon: '✨',
    currentMoments: count,
    nextLevelThreshold: null,
    progressPercent: 100,
    remainingToNext: 0,
    progressText: `${count} моментов`,
  };
}

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
