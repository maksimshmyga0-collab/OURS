/**
 * OURS Local Client State Storage
 * Caches UI preferences and active state.
 */

import { CoupleState, HistoryDay, Moment, AppSettings, ThemeMode, OurDayPhoto } from '../../types';
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
  ourDayPhotos: OurDayPhoto[];
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
      if (parsed && typeof parsed === 'object') {
        const cleanUser = {
          id: parsed.couple?.user?.id || '',
          name: parsed.couple?.user?.name || '',
          avatarUrl: parsed.couple?.user?.avatarUrl || null,
          avatarColor: parsed.couple?.user?.avatarColor || '#F6DCE1',
        };

        const cleanPartner = {
          id: parsed.couple?.partner?.id || '',
          name: parsed.couple?.partner?.name || 'Партнёр',
          avatarUrl: parsed.couple?.partner?.avatarUrl || null,
          avatarColor: parsed.couple?.partner?.avatarColor || '#DDEAF7',
        };

        const cleanCouple: CoupleState = {
          id: parsed.couple?.id || '',
          pairSeed: parsed.couple?.pairSeed || `${parsed.couple?.inviteCode || 'OURS'}-${cleanUser.name || 'user'}-${cleanPartner.name || 'partner'}`.toLowerCase().replace(/\s+/g, '-'),
          user: cleanUser,
          partner: cleanPartner,
          inviteCode: parsed.couple?.inviteCode || '',
          connected: Boolean(parsed.couple?.connected),
          startDate: parsed.couple?.startDate || '',
          daysTogether: parsed.couple?.daysTogether || 1,
          isLovely: Boolean(parsed.couple?.isLovely || parsed.couple?.subscription === 'premium'),
          lovelyPurchasedAt: parsed.couple?.lovelyPurchasedAt,
          subscription: parsed.couple?.subscription || 'free',
        };

        const cleanMoments: Moment[] = Array.isArray(parsed.todayMoments)
          ? parsed.todayMoments.filter(Boolean).map((m: any) => ({
              ...m,
              photos: Array.isArray(m.photos) ? m.photos.filter(Boolean) : [],
            }))
          : JSON.parse(JSON.stringify(DEFAULT_TODAY_MOMENTS));

        const cleanHistory: HistoryDay[] = Array.isArray(parsed.history)
          ? parsed.history
              .filter((d: any) => d && d.id && !d.id.startsWith('day-hist-') && !d.id.startsWith('hist-'))
              .map((d: any) => ({
                ...d,
                moments: Array.isArray(d.moments) ? d.moments.filter(Boolean) : [],
              }))
          : [];

        const cleanOurDayPhotos: OurDayPhoto[] = [];

        const cleanSettings: AppSettings = {
          notifications: parsed.settings?.notifications ?? true,
          sounds: parsed.settings?.sounds ?? true,
          haptic: parsed.settings?.haptic ?? true,
          theme: 'dark',
        };

        const sanitizedState: AppState = {
          hasCompletedOnboarding: Boolean(parsed.hasCompletedOnboarding && cleanCouple.id),
          couple: cleanCouple,
          todayMoments: cleanMoments.length > 0 ? cleanMoments : JSON.parse(JSON.stringify(DEFAULT_TODAY_MOMENTS)),
          activeMomentId: parsed.activeMomentId || cleanMoments[0]?.id || 'moment-today-1',
          history: cleanHistory,
          ourDayPhotos: cleanOurDayPhotos,
          settings: cleanSettings,
        };

        return syncAppStateForDate(sanitizedState);
      }
    }
  } catch (err) {
    console.warn('[OURS Storage] Failed to parse cached app state:', err);
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
    ourDayPhotos: [],
    settings: {
      notifications: true,
      sounds: true,
      haptic: true,
      theme: 'dark',
    },
  };
}

export function saveAppState(state: AppState): void {
  try {
    if (state.settings) {
      state.settings.theme = 'dark';
    }
    appStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('ours_theme_mode_v1', 'dark');
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
