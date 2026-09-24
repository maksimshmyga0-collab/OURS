/**
 * OURS Client API Service
 * Handles anonymous session tokens and communications with the server.
 */

import { CoupleState, Moment, HistoryDay, ReactionEmoji } from '../../types';

const SESSION_TOKEN_KEY = 'ours_auth_session_token_v2';

export interface UserSessionData {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarColor: string;
  currentPairId: string | null;
  createdAt: string;
}

export interface SessionResponse {
  success: boolean;
  user: UserSessionData;
  token: string;
  isNewUser: boolean;
  hasCompletedOnboarding: boolean;
  pair: CoupleState | null;
  moments: Moment[];
  history: HistoryDay[];
  error?: string;
}

export interface PairResponse {
  success: boolean;
  pair: CoupleState | null;
  moments: Moment[];
  history: HistoryDay[];
  error?: string;
}

export class ApiClient {
  private token: string | null = null;

  constructor() {
    this.token = this.getStoredToken();
  }

  private getStoredToken(): string | null {
    try {
      return localStorage.getItem(SESSION_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  private setStoredToken(token: string | null) {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem(SESSION_TOKEN_KEY, token);
      } else {
        localStorage.removeItem(SESSION_TOKEN_KEY);
      }
    } catch {
      // ignore
    }
  }

  private async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['x-session-token'] = this.token;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `Request failed with status ${response.status}`);
    }

    return data as T;
  }

  /**
   * Initializes or restores session
   */
  async initSession(): Promise<SessionResponse> {
    const res = await this.request<SessionResponse>('/api/auth/session', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    if (res.token) {
      this.setStoredToken(res.token);
    }

    return res;
  }

  /**
   * Create a new pair
   */
  async createPair(userName: string, customInviteCode?: string): Promise<PairResponse> {
    return this.request<PairResponse>('/api/pairs/create', {
      method: 'POST',
      body: JSON.stringify({ userName, customInviteCode }),
    });
  }

  /**
   * Join an existing pair by code
   */
  async joinPair(userName: string, inviteCode: string): Promise<PairResponse> {
    return this.request<PairResponse>('/api/pairs/join', {
      method: 'POST',
      body: JSON.stringify({ userName, inviteCode }),
    });
  }

  /**
   * Update profile
   */
  async updateProfile(updates: { name?: string; avatarUrl?: string | null; avatarColor?: string }) {
    return this.request('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  /**
   * Fetch current pair state (for live sync)
   */
  async fetchPairState(): Promise<PairResponse> {
    return this.request<PairResponse>('/api/pairs/current', {
      method: 'GET',
    });
  }

  /**
   * Upload photo for a moment
   */
  async uploadPhoto(momentId: string, photoUrl: string): Promise<{ success: boolean; moment: Moment }> {
    return this.request(`/api/moments/${momentId}/photo`, {
      method: 'POST',
      body: JSON.stringify({ photoUrl }),
    });
  }

  /**
   * Reveal moment
   */
  async revealMoment(momentId: string): Promise<{ success: boolean; moment: Moment }> {
    return this.request(`/api/moments/${momentId}/reveal`, {
      method: 'POST',
    });
  }

  /**
   * Submit reaction
   */
  async submitReaction(momentId: string, emoji: ReactionEmoji): Promise<{ success: boolean; moment: Moment }> {
    return this.request(`/api/moments/${momentId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  }

  /**
   * Complete moment
   */
  async completeMoment(momentId: string): Promise<{ success: boolean; moment: Moment }> {
    return this.request(`/api/moments/${momentId}/complete`, {
      method: 'POST',
    });
  }

  /**
   * Purchase Lovely for Pair
   */
  async purchaseLovely(): Promise<{ success: boolean; isLovely: boolean; lovelyPurchasedAt?: string }> {
    return this.request('/api/pairs/lovely', {
      method: 'POST',
    });
  }

  /**
   * Reset Lovely for Pair
   */
  async resetLovely(): Promise<{ success: boolean; isLovely: boolean }> {
    return this.request('/api/pairs/reset-lovely', {
      method: 'POST',
    });
  }

  /**
   * Reset User Session (Dev tool)
   */
  async resetUser(): Promise<void> {
    try {
      await this.request('/api/dev/reset-user', { method: 'POST' });
    } catch {
      // ignore
    }
    this.setStoredToken(null);
  }
}

export const apiClient = new ApiClient();
