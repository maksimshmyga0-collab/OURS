/**
 * Domain Models for OURS (aligned with Supabase schema & future Capacitor/Android persistence)
 */

export type MomentStatus =
  | 'EMPTY'
  | 'USER_UPLOADED'
  | 'BOTH_UPLOADED'
  | 'MATCH'
  | 'REVEALED'
  | 'REACTED'
  | 'COMPLETED';

export type ReactionEmoji = '❤️' | '😂' | '🔥' | '😢' | '🥹';

export type PairStatus = 'pending' | 'active' | 'archived';

export type SubscriptionTier = 'free' | 'premium';

/**
 * Individual photo inside a joint Moment Duo
 */
export interface MomentPhoto {
  userId: string;
  imageUrl: string;
  createdAt: string;
}

/**
 * User Entity (maps directly to Supabase public.users / auth.users)

 */
export interface User {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  currentPairId: string | null;
  createdAt: string;
  avatarColor?: string; // UI accent helper
}

/**
 * Pair Entity (maps directly to Supabase public.pairs)
 * A pair links maximum 2 users.
 */
export interface Pair {
  id: string;
  createdAt: string;
  inviteCode: string;
  inviteToken?: string;
  status: PairStatus;
  userA: User;
  userB: User | null;
  startDate: string;
  daysTogether: number;
  isLovely: boolean;
  lovelyPurchasedAt?: string;
  subscription?: SubscriptionTier;
}

/**
 * Moment Entity (maps directly to Supabase public.moments)
 * All moments strictly belong to a pairId.
 * createdBy tracks the author of the current moment step.
 */
export interface Moment {
  id: string;
  pairId: string;
  createdBy: string;
  createdAt: string;
  dateKey: string; // Calendar day: 'YYYY-MM-DD'
  imageUrl: string | null; // Public storage URL or primary photo reference
  caption?: string | null;
  status: MomentStatus;

  // Domain & UI rendering fields (preserving current UX)
  order: 1 | 2 | 3;
  label: string;
  prompt: string;
  subtext: string;
  themeColor: 'blue' | 'pink' | 'peach';
  userPhoto: string | null;
  partnerPhoto: string | null;
  /**
   * Moment Duo photos collection (up to 2 photos: one per partner)
   */
  photos?: MomentPhoto[];
  userReaction: ReactionEmoji | null;
  partnerReaction: ReactionEmoji | null;
  completedAt?: string;
  completedTimestamp?: number;
}

/**
 * Couple Streak and History Statistics
 */
export interface CoupleStreakInfo {
  currentStreak: number;
  totalActiveDays: number;
  totalMoments: number;
  duoMomentsCount: number;
  singleMomentsCount: number;
  daysWithOneMoment: number;
  daysWithTwoMoments: number;
  daysWithThreeMoments: number;
  isTodayActive: boolean;
  activeDates: string[]; // Set of dateKeys (YYYY-MM-DD)
  activeWeekDays: Array<{
    dayLabel: string; // 'Пн', 'Вт', etc.
    dateKey: string;
    isActive: boolean;
    isToday: boolean;
  }>;
}

/**
 * Day History representation (aggregates moments for a specific date)

 */
export interface HistoryDay {
  id: string;
  title: string;
  subtitle: string;
  dateStr: string;
  dateKey?: string;
  moments: Moment[];
  isLocked: boolean;
}

/**
 * Theme Modes
 */
export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

/**
 * App Settings
 */
export interface AppSettings {
  notifications: boolean;
  sounds: boolean;
  haptic: boolean;
  theme?: ThemeMode;
}

export type NavigationTab = 'today' | 'history' | 'profile';
