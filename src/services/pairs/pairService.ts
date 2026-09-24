/**
 * Pair Service
 * Handles Pair lifecycle, invite codes, partner linking, and pair status.
 * Enforces rule: A pair holds maximum two users (User A & User B).
 * Prepares for Supabase public.pairs table.
 */

import { Pair, User } from '../../types/models';
import { appStorage, IKeyValueStorage } from '../storage/keyValueStorage';

const PAIR_STORAGE_KEY = 'ours_current_pair_v1';

export interface IPairService {
  getCurrentPair(userId: string): Promise<Pair>;
  createPair(userA: User): Promise<Pair>;
  joinPairWithInvite(inviteCode: string, userB: User): Promise<Pair>;
  updateSubscription(pairId: string, tier: 'free' | 'premium'): Promise<Pair>;
  subscribeToPair(pairId: string, callback: (pair: Pair) => void): () => void;
}

export class AppPairService implements IPairService {
  private storage: IKeyValueStorage;
  private currentPair: Pair | null = null;
  private listeners: Set<(pair: Pair) => void> = new Set();

  constructor(storage: IKeyValueStorage = appStorage) {
    this.storage = storage;
  }

  private notify() {
    if (this.currentPair) {
      this.listeners.forEach((cb) => cb(this.currentPair!));
    }
  }

  async getCurrentPair(_userId: string): Promise<Pair> {
    if (this.currentPair) {
      return this.currentPair;
    }

    const stored = await this.storage.getItem(PAIR_STORAGE_KEY);
    if (stored) {
      try {
        this.currentPair = JSON.parse(stored) as Pair;
        return this.currentPair;
      } catch {
        // fallback
      }
    }

    // Default pair state
    const defaultPair: Pair = {
      id: 'pair-default-1',
      createdAt: '2026-09-12T10:00:00.000Z',
      inviteCode: 'OURS-4821',
      inviteToken: 'token_ours_4821',
      status: 'active',
      userA: {
        id: 'user-a-default',
        displayName: 'Аня',
        avatarUrl: null,
        avatarColor: '#F6DCE1',
        currentPairId: 'pair-default-1',
        createdAt: '2026-09-12T10:00:00.000Z',
      },
      userB: {
        id: 'user-b-default',
        displayName: 'Макс',
        avatarUrl: null,
        avatarColor: '#DDEAF7',
        currentPairId: 'pair-default-1',
        createdAt: '2026-09-12T10:00:00.000Z',
      },
      startDate: '12 сентября 2026',
      daysTogether: 12,
      subscription: 'free',
    };

    this.currentPair = defaultPair;
    await this.storage.setItem(PAIR_STORAGE_KEY, JSON.stringify(defaultPair));
    return defaultPair;
  }

  async createPair(userA: User): Promise<Pair> {
    const randomCode = `OURS-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPair: Pair = {
      id: `pair-${Date.now()}`,
      createdAt: new Date().toISOString(),
      inviteCode: randomCode,
      inviteToken: `token_${Date.now()}`,
      status: 'pending',
      userA,
      userB: null,
      startDate: new Date().toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      daysTogether: 1,
      subscription: 'free',
    };

    this.currentPair = newPair;
    await this.storage.setItem(PAIR_STORAGE_KEY, JSON.stringify(newPair));
    this.notify();
    return newPair;
  }

  async joinPairWithInvite(_inviteCode: string, userB: User): Promise<Pair> {
    if (!this.currentPair) {
      await this.getCurrentPair(userB.id);
    }

    if (!this.currentPair) {
      throw new Error('Pair not found');
    }

    // Connect userB as partner
    const updated: Pair = {
      ...this.currentPair,
      userB,
      status: 'active',
    };

    this.currentPair = updated;
    await this.storage.setItem(PAIR_STORAGE_KEY, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  async updateSubscription(pairId: string, tier: 'free' | 'premium'): Promise<Pair> {
    const pair = await this.getCurrentPair('current');
    if (pair.id !== pairId) {
      pair.id = pairId;
    }
    const updated: Pair = {
      ...pair,
      subscription: tier,
    };
    this.currentPair = updated;
    await this.storage.setItem(PAIR_STORAGE_KEY, JSON.stringify(updated));
    this.notify();
    return updated;
  }

  subscribeToPair(_pairId: string, callback: (pair: Pair) => void): () => void {
    this.listeners.add(callback);
    if (this.currentPair) {
      callback(this.currentPair);
    }
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const pairService = new AppPairService();
