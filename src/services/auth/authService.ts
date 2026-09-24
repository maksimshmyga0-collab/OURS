/**
 * Authentication Service
 * Decouples user authentication and identity from React UI components.
 * Prepared for Supabase Auth (Email, Phone OTP, Anonymous, OAuth) or local mock.
 */

import { User } from '../../types/models';
import { appStorage, IKeyValueStorage } from '../storage/keyValueStorage';

const AUTH_USER_KEY = 'ours_auth_user_v1';

export interface IAuthService {
  getCurrentUser(): Promise<User | null>;
  signInAnonymously(displayName?: string): Promise<User>;
  updateUserProfile(updates: Partial<User>): Promise<User>;
  signOut(): Promise<void>;
  onAuthStateChange(callback: (user: User | null) => void): () => void;
}

export class AppAuthService implements IAuthService {
  private storage: IKeyValueStorage;
  private currentUser: User | null = null;
  private listeners: Set<(user: User | null) => void> = new Set();
  private initialized = false;

  constructor(storage: IKeyValueStorage = appStorage) {
    this.storage = storage;
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentUser));
  }

  async getCurrentUser(): Promise<User | null> {
    if (!this.initialized) {
      const stored = await this.storage.getItem(AUTH_USER_KEY);
      if (stored) {
        try {
          this.currentUser = JSON.parse(stored) as User;
        } catch {
          this.currentUser = null;
        }
      }
      this.initialized = true;
    }

    if (!this.currentUser) {
      // Default initial user for seamless first launch
      this.currentUser = {
        id: 'user-a-default',
        displayName: 'Аня',
        avatarUrl: null,
        avatarColor: '#F6DCE1',
        currentPairId: 'pair-default-1',
        createdAt: '2026-09-12T10:00:00.000Z',
      };
      await this.storage.setItem(AUTH_USER_KEY, JSON.stringify(this.currentUser));
    }

    return this.currentUser;
  }

  async signInAnonymously(displayName: string = 'Аня'): Promise<User> {
    const user: User = {
      id: `user-${Date.now()}`,
      displayName,
      avatarUrl: null,
      avatarColor: '#F6DCE1',
      currentPairId: 'pair-default-1',
      createdAt: new Date().toISOString(),
    };
    this.currentUser = user;
    await this.storage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    this.notifyListeners();
    return user;
  }

  async updateUserProfile(updates: Partial<User>): Promise<User> {
    const user = await this.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    const updated: User = { ...user, ...updates };
    this.currentUser = updated;
    await this.storage.setItem(AUTH_USER_KEY, JSON.stringify(updated));
    this.notifyListeners();
    return updated;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    await this.storage.removeItem(AUTH_USER_KEY);
    this.notifyListeners();
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentUser);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const authService = new AppAuthService();
