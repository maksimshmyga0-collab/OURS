/**
 * OURS Design System Tokens
 * Strict adherence to soft pastel palette, warm white background, and gentle radius.
 */

export const colors = {
  // Backgrounds & Surfaces
  background: '#FFF9FA', // Warm white / milk white
  surface: '#FFFFFF',    // Pure card white
  
  // Pastel Semantic Cards
  softPink: '#F6DCE1',   // Secondary surfaces, selected states, soft emotional areas
  dustyPink: '#EFC1CB',  // More saturated pastel pink
  softBlue: '#DDEAF7',   // Daily moment, waiting states, info cards
  peach: '#F7D8D0',      // Completed states, emotional cards, secondary moments
  cream: '#F4E8C9',      // Statistics, highlights, small warm badges
  softLilac: '#E8DCEB',  // Accent only, very careful
  
  // Emotional Accent
  coral: '#E98787',      // Reaction, primary CTA highlight, MATCH accent
  
  // Typography & Borders
  textPrimary: '#343033',   // Soft dark graphite (no pure black)
  textSecondary: '#777277', // Muted descriptive text
  divider: '#F0E6E8',       // Hairline dividers
  disabled: '#CEC5C8',      // Inactive states
} as const;

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
