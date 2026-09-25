/**
 * OURS Design System Tokens
 * Supports Light & Dark themes with unified yogurt-pink accent and anti-inversion photo discipline.
 */

export const lightThemeTokens = {
  background: '#FFF9FA',
  surface: '#FFFFFF',
  surfaceSecondary: '#FAF5F7',
  surfaceElevated: '#FFFFFF',
  textPrimary: '#343033',
  textSecondary: '#777277',
  textMuted: '#A8A1A4',
  border: '#EBE3E5',
  borderSubtle: '#F2ECEE',
  divider: '#F0E6E8',
  accent: '#F0B9C6',
  coral: '#E98787',
  blue: '#97B2EB',
  softPink: '#F6DCE1',
  dustyPink: '#EFC1CB',
  softBlue: '#DDEAF7',
  peach: '#F7D8D0',
  cream: '#F4E8C9',
  softLilac: '#E8DCEB',
  disabled: '#CEC5C8',
} as const;

export const darkThemeTokens = {
  background: '#000000',
  surface: '#111111',
  surfaceSecondary: '#121212',
  surfaceElevated: '#161616',
  textPrimary: '#FFFFFF',
  textSecondary: '#B8B2B5',
  textMuted: '#807B7E',
  border: '#242024',
  borderSubtle: '#242024',
  divider: '#242024',
  accent: '#F0B9C6', // Yogurt pink accent preserved in dark mode
  coral: '#E98787',
  blue: '#97B2EB',
  softPink: '#1E1417',
  dustyPink: '#2E1920',
  softBlue: '#141A22',
  peach: '#1F1714',
  cream: '#1C1A14',
  softLilac: '#1A151E',
  disabled: '#484447',
} as const;

export const colors = lightThemeTokens;

export const radius = {
  sm: '12px',
  md: '18px',
  lg: '24px',
  xl: '28px',
  full: '9999px',
} as const;

export const shadows = {
  soft: '0 8px 30px -4px rgba(52, 48, 51, 0.04), 0 2px 10px -1px rgba(52, 48, 51, 0.02)',
  card: '0 12px 32px -6px rgba(52, 48, 51, 0.06), 0 4px 12px -2px rgba(52, 48, 51, 0.03)',
  glow: '0 16px 40px -8px rgba(233, 135, 135, 0.25)',
} as const;
