/**
 * Pair Service
 * Handles Pair lifecycle, invite codes, partner linking, and pair status via Supabase.
 * Enforces rule: A pair holds maximum two users (User A & User B).
 * Backed by Supabase public.pairs and public.pair_members tables.
 */

import { Pair, User } from '../../types/models';
import { apiClient } from '../api/apiClient';

export interface IPairService {
  getCurrentPair(userId: string): Promise<Pair | null>;
  createPair(userA: User): Promise<Pair | null>;
  joinPairWithInvite(inviteCode: string, userB: User): Promise<Pair | null>;
  purchaseLovely(pairId: string): Promise<Pair | null>;
  resetLovely(pairId: string): Promise<Pair | null>;
  updateSubscription(pairId: string, tier: 'free' | 'premium'): Promise<Pair | null>;
  subscribeToPair(pairId: string, callback: (pair: Pair) => void): () => void;
}

export class AppPairService implements IPairService {
  private listeners: Set<(pair: Pair) => void> = new Set();

  async getCurrentPair(userId: string): Promise<Pair | null> {
    const res = await apiClient.fetchPairState();
    if (!res.success || !res.pair) {
      return null;
    }
    const p = res.pair;
    const pairObj: Pair = {
      id: p.id || 'pair_default',
      createdAt: new Date().toISOString(),
      inviteCode: p.inviteCode || 'OURS',
      inviteToken: p.inviteCode || 'OURS',
      status: p.connected ? 'active' : 'pending',
      userA: {
        id: p.user.id || userId,
        displayName: p.user.name,
        avatarUrl: p.user.avatarUrl || null,
        avatarColor: p.user.avatarColor,
        currentPairId: p.id || null,
        createdAt: new Date().toISOString(),
      },
      userB: p.partner?.id ? {
        id: p.partner.id,
        displayName: p.partner.name,
        avatarUrl: p.partner.avatarUrl || null,
        avatarColor: p.partner.avatarColor,
        currentPairId: p.id || null,
        createdAt: new Date().toISOString(),
      } : null,
      startDate: p.startDate,
      daysTogether: p.daysTogether,
      isLovely: p.isLovely,
      subscription: p.subscription,
    };

    return pairObj;
  }

  async createPair(userA: User): Promise<Pair | null> {
    const res = await apiClient.createPair(userA.displayName);
    if (!res.success || !res.pair) return null;
    return this.getCurrentPair(userA.id);
  }

  async joinPairWithInvite(inviteCode: string, userB: User): Promise<Pair | null> {
    const res = await apiClient.joinPair(userB.displayName, inviteCode);
    if (!res.success || !res.pair) return null;
    return this.getCurrentPair(userB.id);
  }

  async purchaseLovely(pairId: string): Promise<Pair | null> {
    await apiClient.purchaseLovely(pairId);
    return this.getCurrentPair(pairId);
  }

  async resetLovely(pairId: string): Promise<Pair | null> {
    await apiClient.resetLovely(pairId);
    return this.getCurrentPair(pairId);
  }

  async updateSubscription(pairId: string, tier: 'free' | 'premium'): Promise<Pair | null> {
    if (tier === 'premium') {
      await apiClient.purchaseLovely(pairId);
    } else {
      await apiClient.resetLovely(pairId);
    }
    return this.getCurrentPair(pairId);
  }

  subscribeToPair(_pairId: string, callback: (pair: Pair) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const pairService = new AppPairService();
