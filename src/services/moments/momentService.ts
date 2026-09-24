/**
 * Moment Service
 * Core business logic and persistence for daily moments.
 *
 * Enforces authoritative rules:
 * 1. All moments belong to a pairId.
 * 2. Maximum 3 moments per calendar day for a pair.
 *    0 completed -> Moment 1
 *    1 completed -> Moment 1 + Moment 2
 *    2 completed -> Moment 1 + Moment 2 + Moment 3
 *    3 completed -> Daily limit reached, no further moments can be created.
 * 3. Photo storage abstraction: Photos uploaded through StorageService -> imageUrl.
 * 4. Prepared for Supabase Realtime synchronization.
 */

import { Moment, HistoryDay, ReactionEmoji } from '../../types/models';
import { appStorage, IKeyValueStorage } from '../storage/keyValueStorage';
import { photoStorageService, IStorageService } from '../storage/storageService';
import { PRESET_PHOTOS } from '../samplePhotos';

const MOMENTS_STORAGE_KEY_PREFIX = 'ours_moments_pair_';
const HISTORY_STORAGE_KEY_PREFIX = 'ours_history_pair_';

export interface IMomentService {
  getTodayMoments(pairId: string, dateKey?: string): Promise<Moment[]>;
  uploadUserPhoto(
    pairId: string,
    momentId: string,
    photo: File | Blob | string,
    userId: string
  ): Promise<Moment>;
  submitPartnerPhoto(pairId: string, momentId: string, photoUrl: string, partnerId: string): Promise<Moment>;
  submitReaction(
    pairId: string,
    momentId: string,
    emoji: ReactionEmoji,
    userId: string,
    partnerEmoji?: ReactionEmoji
  ): Promise<Moment>;
  completeMoment(pairId: string, momentId: string): Promise<Moment>;
  updateMoment(pairId: string, updated: Moment): Promise<Moment>;
  getHistory(pairId: string): Promise<HistoryDay[]>;
  unlockHistoryWithPremium(pairId: string): Promise<HistoryDay[]>;
  subscribeToMoments(pairId: string, callback: (moments: Moment[]) => void): () => void;
  resetDayMoments(pairId: string): Promise<Moment[]>;
}

export function getTodayDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const INITIAL_TODAY_PROMPTS = [
  {
    order: 1 as const,
    label: 'МОМЕНТ 1',
    prompt: 'Что сегодня заставило тебя улыбнуться?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach' as const,
  },
  {
    order: 2 as const,
    label: 'МОМЕНТ 2',
    prompt: 'Покажи место, где тебе сейчас хорошо.',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'pink' as const,
  },
  {
    order: 3 as const,
    label: 'МОМЕНТ 3',
    prompt: 'Что ты хочешь запомнить из сегодняшнего дня?',
    subtext: 'Сделайте по одному фото и откройте их вместе.',
    themeColor: 'peach' as const,
  },
];

export class AppMomentService implements IMomentService {
  private storage: IKeyValueStorage;
  private photoStorage: IStorageService;
  private listeners: Map<string, Set<(moments: Moment[]) => void>> = new Map();

  constructor(
    storage: IKeyValueStorage = appStorage,
    photoStorage: IStorageService = photoStorageService
  ) {
    this.storage = storage;
    this.photoStorage = photoStorage;
  }

  private getStorageKey(pairId: string): string {
    return `${MOMENTS_STORAGE_KEY_PREFIX}${pairId}`;
  }

  private getHistoryStorageKey(pairId: string): string {
    return `${HISTORY_STORAGE_KEY_PREFIX}${pairId}`;
  }

  private notify(pairId: string, moments: Moment[]) {
    const subs = this.listeners.get(pairId);
    if (subs) {
      subs.forEach((cb) => cb(moments));
    }
  }

  /**
   * Authoritative Business Rule Validation:
   * Checks whether a new moment can be created or unlocked for a pair on a given day.
   */
  canCreateNextMoment(moments: Moment[]): {
    allowed: boolean;
    nextOrder?: 1 | 2 | 3;
    reason?: string;
  } {
    const completedCount = moments.filter((m) => m.status === 'COMPLETED').length;

    // Strict Rule: Max 3 moments per calendar day
    if (completedCount >= 3) {
      return {
        allowed: false,
        reason: 'Лимит на сегодня достигнут (максимум 3 момента в день).',
      };
    }

    const nextOrder = (completedCount + 1) as 1 | 2 | 3;
    return {
      allowed: true,
      nextOrder,
    };
  }

  /**
   * Calculates visible moments based on the strict progression rule:
   * 0 completed -> Moment 1
   * 1 completed -> Moment 1 + Moment 2
   * 2 completed -> Moment 1 + Moment 2 + Moment 3
   * 3 completed -> All completed
   */
  getVisibleMoments(moments: Moment[]): Moment[] {
    const completedCount = moments.filter((m) => m.status === 'COMPLETED').length;
    const maxVisibleOrder = Math.min(3, Math.max(1, completedCount + 1));
    return moments
      .filter((m) => m.order <= maxVisibleOrder)
      .sort((a, b) => a.order - b.order);
  }

  async getTodayMoments(pairId: string, dateKey: string = getTodayDateKey()): Promise<Moment[]> {
    const key = this.getStorageKey(pairId);
    const stored = await this.storage.getItem(key);

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Moment[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // If stored moments belong to the current dateKey
          if (parsed[0].dateKey === dateKey) {
            return parsed;
          }
        }
      } catch {
        // fallback
      }
    }

    // Initialize fresh moments for this dateKey
    const freshMoments: Moment[] = INITIAL_TODAY_PROMPTS.map((item, idx) => ({
      id: `moment-${pairId}-${dateKey}-${idx + 1}`,
      pairId,
      createdBy: 'user-a-default',
      createdAt: new Date().toISOString(),
      dateKey,
      imageUrl: null,
      caption: null,
      status: 'EMPTY',
      order: item.order,
      label: item.label,
      prompt: item.prompt,
      subtext: item.subtext,
      themeColor: item.themeColor,
      userPhoto: null,
      partnerPhoto: null,
      userReaction: null,
      partnerReaction: null,
    }));

    await this.storage.setItem(key, JSON.stringify(freshMoments));
    return freshMoments;
  }

  async uploadUserPhoto(
    pairId: string,
    momentId: string,
    photo: File | Blob | string,
    userId: string
  ): Promise<Moment> {
    const moments = await this.getTodayMoments(pairId);
    const target = moments.find((m) => m.id === momentId);

    if (!target) {
      throw new Error(`Moment ${momentId} not found in pair ${pairId}`);
    }

    // Business check: order must be <= 3
    if (target.order > 3) {
      throw new Error('Moment limit exceeded. Only 3 moments per day are allowed.');
    }

    // Upload through StorageService
    const storedUrl = await this.photoStorage.uploadMomentPhoto(pairId, momentId, photo);

    const isPartnerAlreadyUploaded = Boolean(target.partnerPhoto);
    const newStatus = isPartnerAlreadyUploaded ? 'BOTH_UPLOADED' : 'USER_UPLOADED';

    const updated: Moment = {
      ...target,
      createdBy: userId,
      imageUrl: storedUrl,
      userPhoto: storedUrl,
      status: newStatus,
    };

    return this.updateMoment(pairId, updated);
  }

  async submitPartnerPhoto(
    pairId: string,
    momentId: string,
    photoUrl: string,
    partnerId: string
  ): Promise<Moment> {
    const moments = await this.getTodayMoments(pairId);
    const target = moments.find((m) => m.id === momentId);

    if (!target) {
      throw new Error(`Moment ${momentId} not found`);
    }

    const newStatus = target.userPhoto ? 'BOTH_UPLOADED' : 'EMPTY';
    const updated: Moment = {
      ...target,
      partnerPhoto: photoUrl,
      status: newStatus,
      createdBy: target.createdBy || partnerId,
    };

    return this.updateMoment(pairId, updated);
  }

  async submitReaction(
    pairId: string,
    momentId: string,
    emoji: ReactionEmoji,
    _userId: string,
    partnerEmoji?: ReactionEmoji
  ): Promise<Moment> {
    const moments = await this.getTodayMoments(pairId);
    const target = moments.find((m) => m.id === momentId);

    if (!target) {
      throw new Error(`Moment ${momentId} not found`);
    }

    const updated: Moment = {
      ...target,
      userReaction: emoji,
      partnerReaction: target.partnerReaction || partnerEmoji || '❤️',
      status: 'REACTED',
    };

    return this.updateMoment(pairId, updated);
  }

  async completeMoment(pairId: string, momentId: string): Promise<Moment> {
    const moments = await this.getTodayMoments(pairId);
    const target = moments.find((m) => m.id === momentId);

    if (!target) {
      throw new Error(`Moment ${momentId} not found`);
    }

    // Validate that completing does not violate rules
    const updated: Moment = {
      ...target,
      status: 'COMPLETED',
      completedAt: new Date().toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    return this.updateMoment(pairId, updated);
  }

  async updateMoment(pairId: string, updated: Moment): Promise<Moment> {
    const moments = await this.getTodayMoments(pairId);
    const nextMoments = moments.map((m) => (m.id === updated.id ? updated : m));

    await this.storage.setItem(this.getStorageKey(pairId), JSON.stringify(nextMoments));
    this.notify(pairId, nextMoments);
    return updated;
  }

  async resetDayMoments(pairId: string): Promise<Moment[]> {
    const dateKey = getTodayDateKey();
    const freshMoments: Moment[] = INITIAL_TODAY_PROMPTS.map((item, idx) => ({
      id: `moment-${pairId}-${dateKey}-${idx + 1}`,
      pairId,
      createdBy: 'user-a-default',
      createdAt: new Date().toISOString(),
      dateKey,
      imageUrl: null,
      caption: null,
      status: 'EMPTY',
      order: item.order,
      label: item.label,
      prompt: item.prompt,
      subtext: item.subtext,
      themeColor: item.themeColor,
      userPhoto: null,
      partnerPhoto: null,
      userReaction: null,
      partnerReaction: null,
    }));

    await this.storage.setItem(this.getStorageKey(pairId), JSON.stringify(freshMoments));
    this.notify(pairId, freshMoments);
    return freshMoments;
  }

  async getHistory(pairId: string): Promise<HistoryDay[]> {
    const key = this.getHistoryStorageKey(pairId);
    const stored = await this.storage.getItem(key);
    if (stored) {
      try {
        return JSON.parse(stored) as HistoryDay[];
      } catch {
        // fallback
      }
    }

    const defaultHistory: HistoryDay[] = [
      {
        id: 'hist-yesterday',
        title: 'Вчера',
        subtitle: '2 момента',
        dateStr: '22 сентября 2026',
        isLocked: false,
        moments: [
          {
            id: 'hist-y-1',
            pairId,
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
            userReaction: '😍',
            partnerReaction: '❤️',
            completedAt: 'Вчера, 09:24',
          },
          {
            id: 'hist-y-2',
            pairId,
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
            pairId,
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
            pairId,
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
            pairId,
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
            pairId,
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
            pairId,
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
            pairId,
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
        isLocked: true, // Requires Premium (older than 7 days)
        moments: [
          {
            id: 'hist-14-1',
            pairId,
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

    await this.storage.setItem(key, JSON.stringify(defaultHistory));
    return defaultHistory;
  }

  async unlockHistoryWithPremium(pairId: string): Promise<HistoryDay[]> {
    const history = await this.getHistory(pairId);
    const unlocked = history.map((item) => ({ ...item, isLocked: false }));
    await this.storage.setItem(this.getHistoryStorageKey(pairId), JSON.stringify(unlocked));
    return unlocked;
  }

  subscribeToMoments(pairId: string, callback: (moments: Moment[]) => void): () => void {
    if (!this.listeners.has(pairId)) {
      this.listeners.set(pairId, new Set());
    }
    const pairSubs = this.listeners.get(pairId)!;
    pairSubs.add(callback);

    // Initial emit
    this.getTodayMoments(pairId).then((m) => callback(m));

    return () => {
      pairSubs.delete(callback);
    };
  }
}

export const momentService = new AppMomentService();
