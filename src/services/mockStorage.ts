import { CoupleState, HistoryDay, Moment, AppSettings } from '../types';
import { PRESET_PHOTOS } from './samplePhotos';
import { appStorage } from './storage/keyValueStorage';
import {
  syncAppStateForDate,
  getLocalDateKey,
  createFreshDayMoments,
} from './moments/momentTiming';

const STORAGE_KEY = 'ours_app_state_v1';
const ONBOARDING_KEY = 'ours_onboarding_completed_v1';

export interface AppState {
  hasCompletedOnboarding: boolean;
  couple: CoupleState;
  todayMoments: Moment[];
  activeMomentId: string;
  history: HistoryDay[];
  settings: AppSettings;
}

const DEFAULT_TODAY_MOMENTS: Moment[] = createFreshDayMoments('OURS-4821', getLocalDateKey());


const DEFAULT_HISTORY: HistoryDay[] = [
  {
    id: 'hist-yesterday',
    title: 'Вчера',
    subtitle: '2 момента',
    dateStr: '22 сентября 2026',
    isLocked: false,
    moments: [
      {
        id: 'hist-y-1',
        pairId: 'pair-default-1',
        createdBy: 'user-a-default',
        createdAt: '2026-09-22T09:24:00.000Z',
        dateKey: '2026-09-22',
        imageUrl: PRESET_PHOTOS[0].url,
        caption: null,
        order: 1,
        label: 'МОМЕНТ 1',
        prompt: 'Твой первый кофе или чай сегодня?',
        subtext: 'Открыто вместе',
        status: 'COMPLETED',
        themeColor: 'blue',
        userPhoto: PRESET_PHOTOS[0].url,
        partnerPhoto: PRESET_PHOTOS[3].url,
        photos: [
          { userId: 'user-a-default', imageUrl: PRESET_PHOTOS[0].url, createdAt: '2026-09-22T09:20:00.000Z' },
          { userId: 'user-b-default', imageUrl: PRESET_PHOTOS[3].url, createdAt: '2026-09-22T09:24:00.000Z' },
        ],
        userReaction: '😍',
        partnerReaction: '❤️',
        completedAt: 'Вчера, 09:24',
      },
      {
        id: 'hist-y-2',
        pairId: 'pair-default-1',
        createdBy: 'user-a-default',
        createdAt: '2026-09-22T19:40:00.000Z',
        dateKey: '2026-09-22',
        imageUrl: PRESET_PHOTOS[1].url,
        caption: null,
        order: 2,
        label: 'МОМЕНТ 2',
        prompt: 'Что было самым красивым по дороге домой?',
        subtext: 'Открыто вместе',
        status: 'COMPLETED',
        themeColor: 'pink',
        userPhoto: PRESET_PHOTOS[1].url,
        partnerPhoto: PRESET_PHOTOS[2].url,
        photos: [
          { userId: 'user-a-default', imageUrl: PRESET_PHOTOS[1].url, createdAt: '2026-09-22T19:35:00.000Z' },
          { userId: 'user-b-default', imageUrl: PRESET_PHOTOS[2].url, createdAt: '2026-09-22T19:40:00.000Z' },
        ],
        userReaction: '🫶',

        partnerReaction: '🥹',
        completedAt: 'Вчера, 19:40',
      },
    ],
  },
  {
    id: 'hist-20-sep',
    title: '20 сентября',
    subtitle: '3 момента',
    dateStr: '20 сентября 2026',
    isLocked: false,
    moments: [
      {
        id: 'hist-20-1',
        pairId: 'pair-default-1',
        createdBy: 'user-a-default',
        createdAt: '2026-09-20T11:15:00.000Z',
        dateKey: '2026-09-20',
        imageUrl: PRESET_PHOTOS[2].url,
        caption: null,
        order: 1,
        label: 'МОМЕНТ 1',
        prompt: 'Вид из твоего окна прямо сейчас',
        subtext: 'Открыто вместе',
        status: 'COMPLETED',
        themeColor: 'blue',
        userPhoto: PRESET_PHOTOS[2].url,
        partnerPhoto: PRESET_PHOTOS[1].url,
        userReaction: '❤️',
        partnerReaction: '❤️',
        completedAt: '20 сентября, 11:15',
      },
      {
        id: 'hist-20-2',
        pairId: 'pair-default-1',
        createdBy: 'user-a-default',
        createdAt: '2026-09-20T15:30:00.000Z',
        dateKey: '2026-09-20',
        imageUrl: PRESET_PHOTOS[3].url,
        caption: null,
        order: 2,
        label: 'МОМЕНТ 2',
        prompt: 'Что ты сейчас слушаешь или читаешь?',
        subtext: 'Открыто вместе',
        status: 'COMPLETED',
        themeColor: 'pink',
        userPhoto: PRESET_PHOTOS[3].url,
        partnerPhoto: PRESET_PHOTOS[0].url,
        userReaction: '🥹',
        partnerReaction: '😂',
        completedAt: '20 сентября, 15:30',
      },
      {
        id: 'hist-20-3',
        pairId: 'pair-default-1',
        createdBy: 'user-a-default',
        createdAt: '2026-09-20T22:04:00.000Z',
        dateKey: '2026-09-20',
        imageUrl: PRESET_PHOTOS[1].url,
        caption: null,
        order: 3,
        label: 'МОМЕНТ 3',
        prompt: 'Маленькая радость сегодняшнего вечера',
        subtext: 'Открыто вместе',
        status: 'COMPLETED',
        themeColor: 'peach',
        userPhoto: PRESET_PHOTOS[1].url,
        partnerPhoto: PRESET_PHOTOS[2].url,
        userReaction: '🫶',
        partnerReaction: '😍',
        completedAt: '20 сентября, 22:04',
      },
    ],
  },
  {
    id: 'hist-18-sep',
    title: '18 сентября',
    subtitle: '3 момента',
    dateStr: '18 сентября 2026',
    isLocked: false,
    moments: [
      {
        id: 'hist-18-1',
        pairId: 'pair-default-1',
        createdBy: 'user-a-default',
        createdAt: '2026-09-18T10:45:00.000Z',
        dateKey: '2026-09-18',
        imageUrl: PRESET_PHOTOS[0].url,
        caption: null,
        order: 1,
        label: 'МОМЕНТ 1',
        prompt: 'Завтрак выходного дня',
        subtext: 'Открыто вместе',
        status: 'COMPLETED',
        themeColor: 'blue',
        userPhoto: PRESET_PHOTOS[0].url,
        partnerPhoto: PRESET_PHOTOS[3].url,
        userReaction: '😍',
        partnerReaction: '🫶',
        completedAt: '18 сентября, 10:45',
      },
      {
        id: 'hist-18-2',
        pairId: 'pair-default-1',
        createdBy: 'user-a-default',
        createdAt: '2026-09-18T16:10:00.000Z',
        dateKey: '2026-09-18',
        imageUrl: PRESET_PHOTOS[3].url,
        caption: null,
        order: 2,
        label: 'МОМЕНТ 2',
        prompt: 'Уютная деталь вокруг тебя',
        subtext: 'Открыто вместе',
        status: 'COMPLETED',
        themeColor: 'pink',
        userPhoto: PRESET_PHOTOS[3].url,
        partnerPhoto: PRESET_PHOTOS[1].url,
        userReaction: '❤️',
        partnerReaction: '🥹',
        completedAt: '18 сентября, 16:10',
      },
      {
        id: 'hist-18-3',
        pairId: 'pair-default-1',
        createdBy: 'user-a-default',
        createdAt: '2026-09-18T23:12:00.000Z',
        dateKey: '2026-09-18',
        imageUrl: PRESET_PHOTOS[2].url,
        caption: null,
        order: 3,
        label: 'МОМЕНТ 3',
        prompt: 'О чём ты подумал перед сном?',
        subtext: 'Открыто вместе',
        status: 'COMPLETED',
        themeColor: 'peach',
        userPhoto: PRESET_PHOTOS[2].url,
        partnerPhoto: PRESET_PHOTOS[0].url,
        userReaction: '🥹',
        partnerReaction: '❤️',
        completedAt: '18 сентября, 23:12',
      },
    ],
  },
  {
    id: 'hist-14-sep',
    title: '14 сентября',
    subtitle: '3 момента',
    dateStr: '14 сентября 2026',
    isLocked: true, // More than 7 days ago - requires Premium
    moments: [
      {
        id: 'hist-14-1',
        pairId: 'pair-default-1',
        createdBy: 'user-a-default',
        createdAt: '2026-09-14T12:00:00.000Z',
        dateKey: '2026-09-14',
        imageUrl: PRESET_PHOTOS[1].url,
        caption: null,
        order: 1,
        label: 'МОМЕНТ 1',
        prompt: 'Наш первый день в OURS',
        subtext: 'Архивировано',
        status: 'COMPLETED',
        themeColor: 'blue',
        userPhoto: PRESET_PHOTOS[1].url,
        partnerPhoto: PRESET_PHOTOS[2].url,
        userReaction: '❤️',
        partnerReaction: '❤️',
        completedAt: '14 сентября, 12:00',
      },
    ],
  },
];

export function getInitialAppState(): AppState {
  try {
    const stored = appStorage.getItem(STORAGE_KEY);
    if (stored && typeof stored === 'string') {
      const parsed = JSON.parse(stored);
      if (
        parsed &&
        Array.isArray(parsed.todayMoments) &&
        parsed.todayMoments.length > 0 &&
        parsed.couple &&
        parsed.couple.user
      ) {
        return syncAppStateForDate(parsed);
      }
    }
  } catch {
    // ignore
  }

  return {
    hasCompletedOnboarding: true,
    couple: {
      user: { name: 'Аня', avatarColor: '#F6DCE1' },
      partner: { name: 'Макс', avatarColor: '#DDEAF7' },
      inviteCode: 'OURS-4821',
      connected: true,
      startDate: '12 сентября 2026',
      daysTogether: 12,
      subscription: 'free',
    },
    todayMoments: JSON.parse(JSON.stringify(DEFAULT_TODAY_MOMENTS)),
    activeMomentId: DEFAULT_TODAY_MOMENTS[0]?.id || 'moment-today-1',
    history: JSON.parse(JSON.stringify(DEFAULT_HISTORY)),
    settings: {
      notifications: true,
      sounds: true,
      haptic: true,
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

export function resetAppToDefault(): AppState {
  try {
    appStorage.removeItem(STORAGE_KEY);
    appStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // ignore
  }
  const defaultState = getInitialAppState();
  return defaultState;
}

export function resetToOnboarding(): AppState {
  const freshState: AppState = {
    hasCompletedOnboarding: false,
    couple: {
      user: { name: 'Аня', avatarColor: '#F6DCE1' },
      partner: { name: 'Макс', avatarColor: '#DDEAF7' },
      inviteCode: 'OURS-4821',
      connected: true,
      startDate: '12 сентября 2026',
      daysTogether: 1,
      subscription: 'free',
    },
    todayMoments: JSON.parse(JSON.stringify(DEFAULT_TODAY_MOMENTS)),
    activeMomentId: 'moment-today-1',
    history: JSON.parse(JSON.stringify(DEFAULT_HISTORY)),
    settings: {
      notifications: true,
      sounds: true,
      haptic: true,
    },
  };
  saveAppState(freshState);
  return freshState;
}

