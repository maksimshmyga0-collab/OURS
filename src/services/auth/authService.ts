/**
 * Authentication Service (Supabase Auth)
 * Decouples user authentication and identity from React UI components.
 * Backed by Supabase Anonymous Authentication and public.profiles.
 */

import { User } from '../../types/models';
import { supabase, supabaseConfig } from '../api/supabaseClient';

export interface IAuthService {
  getCurrentUser(): Promise<User | null>;
  signInAnonymously(displayName?: string): Promise<User>;
  updateUserProfile(updates: Partial<User>): Promise<User>;
  signOut(): Promise<void>;
  onAuthStateChange(callback: (user: User | null) => void): () => void;
}

export class AppAuthService implements IAuthService {
  private currentUser: User | null = null;
  private listeners: Set<(user: User | null) => void> = new Set();
  private initialized = false;

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.currentUser));
  }

  async getCurrentUser(): Promise<User | null> {
    if (this.currentUser && this.initialized) {
      return this.currentUser;
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let authUser = sessionData?.session?.user;

      if (!authUser) {
        const { data: signInData } = await supabase.auth.signInAnonymously();
        if (signInData?.user) {
          authUser = signInData.user;
        }
      }

      if (authUser) {
        let displayName = '';
        let avatarUrl: string | null = null;
        let avatarColor = '#F6DCE1';

        if (supabaseConfig.isConfigured) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();

          if (profile) {
            displayName = profile.name || profile.display_name || '';
            avatarUrl = profile.avatar_url || null;
            avatarColor = profile.avatar_color || '#F6DCE1';
          }
        }

        this.currentUser = {
          id: authUser.id,
          displayName,
          avatarUrl,
          avatarColor,
          currentPairId: null,
          createdAt: authUser.created_at || new Date().toISOString(),
        };
        this.initialized = true;
        return this.currentUser;
      }
    } catch (err) {
      console.warn('[OURS AuthService] Session access error:', err);
    }

    this.initialized = true;
    return this.currentUser;
  }

  async signInAnonymously(displayName: string = ''): Promise<User> {
    const { data } = await supabase.auth.signInAnonymously();
    const authUser = data?.user;
    const userId = authUser?.id || `user-${Date.now()}`;

    if (displayName && supabaseConfig.isConfigured) {
      await supabase.from('profiles').upsert(
        {
          id: userId,
          name: displayName,
          avatar_color: '#F6DCE1',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      );
    }

    const user: User = {
      id: userId,
      displayName,
      avatarUrl: null,
      avatarColor: '#F6DCE1',
      currentPairId: null,
      createdAt: new Date().toISOString(),
    };

    this.currentUser = user;
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

    if (supabaseConfig.isConfigured) {
      const dbUpdates: Record<string, any> = {};
      if (updates.displayName !== undefined) dbUpdates.name = updates.displayName;
      if (updates.avatarUrl !== undefined) dbUpdates.avatar_url = updates.avatarUrl;

      if (Object.keys(dbUpdates).length > 0) {
        await supabase.from('profiles').update(dbUpdates).eq('id', user.id);
      }
    }

    this.notifyListeners();
    return updated;
  }

  async signOut(): Promise<void> {
    this.currentUser = null;
    await supabase.auth.signOut();
    this.notifyListeners();
  }

  onAuthStateChange(callback: (user: User | null) => void): () => void {
    this.listeners.add(callback);
    callback(this.currentUser);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        if (!this.currentUser || this.currentUser.id !== session.user.id) {
          await this.getCurrentUser();
          this.notifyListeners();
        }
      } else {
        this.currentUser = null;
        this.notifyListeners();
      }
    });

    return () => {
      this.listeners.delete(callback);
      authListener?.subscription?.unsubscribe();
    };
  }
}

export const authService = new AppAuthService();
