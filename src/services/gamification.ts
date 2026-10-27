/**
 * Couple Pluralization Service for OURS
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
