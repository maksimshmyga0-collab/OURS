import { CoupleState, HistoryDay, Moment, AppSettings } from '../types';
import { appStorage } from './storage/keyValueStorage';
import {
  syncAppStateForDate,
  getLocalDateKey,
  createFreshDayMoments,
} from './moments/momentTiming';

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
          parsed.settings = { notifications: true, sounds: true, haptic: true, theme: 'system' };
        } else if (!parsed.settings.theme) {
          parsed.settings.theme = 'system';
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
      theme: 'system',
    },
  };
}

export function saveAppState(state: AppState): void {
  try {
    appStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

export function createDemoAppState(): AppState {
  const demoMoments = createFreshDayMoments('OURS-4821', getLocalDateKey());
  return {
    hasCompletedOnboarding: true,
    couple: {
      id: 'pair-demo-1',
      pairSeed: 'ours-4821-anya-max',
      user: { id: 'usr-demo-a', name: 'Аня', avatarColor: '#F6DCE1' },
      partner: { id: 'usr-demo-b', name: 'Макс', avatarColor: '#DDEAF7' },
      inviteCode: 'OURS-4821',
      connected: true,
      startDate: '12 сентября 2026',
      daysTogether: 12,
      isLovely: false,
      lovelyPurchasedAt: undefined,
      subscription: 'free',
    },
    todayMoments: demoMoments,
    activeMomentId: demoMoments[0]?.id || 'moment-today-1',
    history: [],
    settings: {
      notifications: true,
      sounds: true,
      haptic: true,
      theme: 'system',
    },
  };
}

export function resetAppToDefault(): AppState {
  try {
    appStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return getInitialAppState();
}

export function resetToOnboarding(): AppState {
  return resetAppToDefault();
}
