/**
 * OURS Local Client State Storage
 * Caches UI preferences and active state.
 */

import { CoupleState, HistoryDay, Moment, AppSettings, ThemeMode } from '../../types';
import { appStorage } from './keyValueStorage';
import {
  syncAppStateForDate,
  getLocalDateKey,
  createFreshDayMoments,
} from '../moments/momentTiming';

const STORAGE_KEY = 'ours_app_state_v2';

export interface AppState {
  hasCompletedOnboarding: boolean;
  couple: CoupleState;
  todayMoments: Moment[];
  activeMomentId: string;
  history: HistoryDay[];
  settings: AppSettings;
}

const DEFAULT_TODAY_MOMENTS: Moment[] = createFreshDayMoments('OURS', getLocalDateKey());
const DEFAULT_HISTORY: HistoryDay[] = [];

export function getInitialAppState(): AppState {
  let savedThemePreference: ThemeMode | null = null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const t = localStorage.getItem('ours_theme_mode_v1');
      if (t === 'light' || t === 'dark' || t === 'system') {
        savedThemePreference = t as ThemeMode;
      }
    }
  } catch {
    // fallback
  }

  try {
    const stored = appStorage.getItem(STORAGE_KEY);
    if (stored && typeof stored === 'string') {
      const parsed = JSON.parse(stored);
      if (
        parsed &&
        Array.isArray(parsed.todayMoments) &&
        parsed.couple &&
        parsed.couple.user
      ) {
        if (!parsed.settings) {
          parsed.settings = { notifications: true, sounds: true, haptic: true, theme: savedThemePreference || 'system' };
        } else {
          parsed.settings.theme = savedThemePreference || parsed.settings.theme || 'system';
        }
        if (!parsed.couple.pairSeed) {
          parsed.couple.pairSeed = `${parsed.couple.inviteCode || 'OURS'}-${parsed.couple.user?.name || 'user'}-${parsed.couple.partner?.name || 'partner'}`.toLowerCase().replace(/\s+/g, '-');
        }
        if (parsed.couple.isLovely === undefined) {
          parsed.couple.isLovely = parsed.couple.subscription === 'premium';
        }

        return syncAppStateForDate(parsed);
      }
    }
  } catch {
    // ignore
  }

  return {
    hasCompletedOnboarding: false,
    couple: {
      id: '',
      pairSeed: '',
      user: { id: '', name: '', avatarColor: '#F6DCE1' },
      partner: { id: '', name: 'Партнёр', avatarColor: '#DDEAF7' },
      inviteCode: '',
      connected: false,
      startDate: '',
      daysTogether: 1,
      isLovely: false,
      lovelyPurchasedAt: undefined,
      subscription: 'free',
    },
    todayMoments: JSON.parse(JSON.stringify(DEFAULT_TODAY_MOMENTS)),
    activeMomentId: DEFAULT_TODAY_MOMENTS[0]?.id || 'moment-today-1',
    history: JSON.parse(JSON.stringify(DEFAULT_HISTORY)),
    settings: {
      notifications: true,
      sounds: true,
      haptic: true,
      theme: savedThemePreference || 'system',
    },
  };
}

export function saveAppState(state: AppState): void {
  try {
    appStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== 'undefined' && window.localStorage && state.settings?.theme) {
      localStorage.setItem('ours_theme_mode_v1', state.settings.theme);
    }
  } catch {
    // ignore
  }
}

export function resetAppToDefault(): AppState {
  try {
    appStorage.removeItem(STORAGE_KEY);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore
  }
  return getInitialAppState();
}

export function resetToOnboarding(): AppState {
  return resetAppToDefault();
}
