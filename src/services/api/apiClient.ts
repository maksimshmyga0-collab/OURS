/**
 * OURS Supabase Client API Service
 * Real Supabase backend integration for Auth, Profiles, Pairs, Moments, Photos, Reactions, and History.
 */

import { supabase, supabaseConfig } from './supabaseClient';
import { photoStorageService } from '../storage/storageService';
import {
  CoupleState,
  Moment,
  HistoryDay,
  ReactionEmoji,
  MomentPhoto,
} from '../../types';
import {
  getLocalDateKey,
  getPromptForPairMoment,
  formatRussianDate,
} from '../moments/momentTiming';

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

const SAFE_CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generateRandomInviteCode(): string {
  let result = '';
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * SAFE_CODE_CHARS.length);
    result += SAFE_CODE_CHARS[idx];
  }
  return `OURS-${result}`;
}

export class ApiClient {
  private currentUserId: string | null = null;
  private currentPairId: string | null = null;

  /**
   * Helper: Ensures anonymous Supabase authentication and returns real auth user ID
   */
  async ensureAuthenticatedUser(): Promise<string> {
    if (this.currentUserId) {
      return this.currentUserId;
    }

    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      let user = sessionData?.session?.user;

      if (!user || sessionErr) {
        const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
        if (signInError) {
          console.warn('[OURS Auth] Anonymous sign in warning:', signInError.message);
        }
        if (signInData?.user) {
          user = signInData.user;
        }
      }

      if (user?.id) {
        this.currentUserId = user.id;
        return user.id;
      }
    } catch (err) {
      console.warn('[OURS Auth] Exception getting auth session:', err);
    }

    // Fallback valid UUID if offline or temporary network issue
    const fallbackId = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-' + Math.random().toString(16).substring(2, 14).padEnd(12, '0');
    this.currentUserId = fallbackId;
    return fallbackId;
  }

  /**
   * Helper: Ensure profile row exists in public.profiles
   */
  private async getOrCreateProfile(userId: string, defaultName: string = ''): Promise<{
    displayName: string;
    avatarUrl: string | null;
    avatarColor: string;
  }> {
    const defaultProfile = {
      displayName: defaultName,
      avatarUrl: null,
      avatarColor: '#F6DCE1',
    };

    if (!supabaseConfig.isConfigured) {
      return defaultProfile;
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profile && !error) {
        return {
          displayName: profile.display_name || profile.name || defaultName,
          avatarUrl: profile.avatar_url || null,
          avatarColor: profile.avatar_color || '#F6DCE1',
        };
      }

      // Profile does not exist, insert initial profile row
      await supabase.from('profiles').upsert(
        {
          id: userId,
          name: defaultName,
        },
        { onConflict: 'id' }
      );
    } catch (err) {
      console.warn('[OURS Profiles] Profile access warning:', err);
    }

    return defaultProfile;
  }

  /**
   * Helper: Build complete CoupleState and Moments from Supabase tables
   */
  private async assemblePairData(pairId: string, currentUserId: string): Promise<{
    pair: CoupleState;
    moments: Moment[];
    history: HistoryDay[];
  }> {
    const todayKey = getLocalDateKey();

    // 1. Fetch pair details from public.pairs
    const { data: pairRow } = await supabase
      .from('pairs')
      .select('*')
      .eq('id', pairId)
      .maybeSingle();

    const inviteCode = pairRow?.code || pairRow?.invite_code || 'OURS';
    const isLovely = Boolean(pairRow?.is_lovely);
    const subscription = (pairRow?.subscription || (isLovely ? 'premium' : 'free')) as 'free' | 'premium';
    const lovelyPurchasedAt = pairRow?.lovely_purchased_at || pairRow?.lovelyPurchasedAt || undefined;
    const createdAt = pairRow?.created_at || new Date().toISOString();

    // Calculate days together
    let daysTogether = 1;
    try {
      const diff = Math.floor(
        (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
      );
      daysTogether = Math.max(1, diff + 1);
    } catch {
      daysTogether = 1;
    }

    // 2. Fetch all members from public.pair_members
    const { data: members } = await supabase
      .from('pair_members')
      .select('*, profiles(*)')
      .eq('pair_id', pairId);

    const memberList = members || [];
    const myMember = memberList.find((m: any) => m.user_id === currentUserId);
    const partnerMember = memberList.find((m: any) => m.user_id !== currentUserId);

    // Current user profile
    const myProfileData = await this.getOrCreateProfile(currentUserId);
    const myProfile = {
      id: currentUserId,
      name: myProfileData.displayName,
      avatarUrl: myProfileData.avatarUrl,
      avatarColor: myProfileData.avatarColor || '#F6DCE1',
    };

    // Partner profile
    let partnerProfile = {
      id: partnerMember?.user_id || '',
      name: partnerMember?.profiles?.display_name || partnerMember?.profiles?.name || 'Партнёр',
      avatarUrl: partnerMember?.profiles?.avatar_url || null,
      avatarColor: partnerMember?.profiles?.avatar_color || '#DDEAF7',
    };

    if (partnerMember?.user_id && (!partnerMember.profiles || !partnerMember.profiles.display_name)) {
      const pData = await this.getOrCreateProfile(partnerMember.user_id, 'Партнёр');
      partnerProfile.name = pData.displayName || 'Партнёр';
      partnerProfile.avatarUrl = pData.avatarUrl;
      partnerProfile.avatarColor = pData.avatarColor || '#DDEAF7';
    }

    const isConnected = Boolean(partnerMember?.user_id);
    const pairSeedVal = `${inviteCode}-${myProfile.name}-${partnerProfile.name}`
      .toLowerCase()
      .replace(/\s+/g, '-');

    const coupleState: CoupleState = {
      id: pairId,
      pairSeed: pairSeedVal,
      user: myProfile,
      partner: partnerProfile,
      inviteCode,
      connected: isConnected,
      startDate: formatRussianDate(todayKey),
      daysTogether,
      isLovely,
      lovelyPurchasedAt,
      subscription,
    };

    // 3. Fetch or initialize today's moments from public.moments
    let { data: rawMoments } = await supabase
      .from('moments')
      .select('*')
      .eq('pair_id', pairId)
      .eq('date_key', todayKey)
      .order('order', { ascending: true });

    // If moments table uses `moment_date` or `order_index` column
    if (!rawMoments || rawMoments.length === 0) {
      const { data: altMoments } = await supabase
        .from('moments')
        .select('*')
        .eq('pair_id', pairId)
        .eq('moment_date', todayKey)
        .order('order_index', { ascending: true });
      if (altMoments && altMoments.length > 0) {
        rawMoments = altMoments;
      }
    }

    // If no moments exist for today, create the 3 moments in Supabase
    if (!rawMoments || rawMoments.length === 0) {
      const newMomentsToInsert = ([1, 2, 3] as const).map((order) => {
        const promptInfo = getPromptForPairMoment(pairId, todayKey, order);
        return {
          id: `moment_${pairId}_${todayKey}_${order}`,
          pair_id: pairId,
          date_key: todayKey,
          moment_date: todayKey,
          order: order,
          order_index: order,
          label: `МОМЕНТ ${order}`,
          prompt: promptInfo.prompt,
          subtext: promptInfo.subtext,
          theme_color: promptInfo.themeColor,
          status: 'EMPTY',
          revealed: false,
          created_at: new Date().toISOString(),
        };
      });

      try {
        const { data: inserted } = await supabase
          .from('moments')
          .insert(newMomentsToInsert)
          .select();
        rawMoments = inserted || newMomentsToInsert;
      } catch {
        rawMoments = newMomentsToInsert;
      }
    }

    // 4. Fetch all photos & reactions for today's moments
    const momentIds = (rawMoments || []).map((m: any) => m.id);
    let allPhotos: any[] = [];
    let allReactions: any[] = [];

    if (momentIds.length > 0) {
      try {
        const { data: pData } = await supabase
          .from('photos')
          .select('*')
          .in('moment_id', momentIds);
        allPhotos = pData || [];
      } catch (e) {
        // silent
      }

      try {
        const { data: rData } = await supabase
          .from('reactions')
          .select('*')
          .in('moment_id', momentIds);
        allReactions = rData || [];
      } catch (e) {
        // silent
      }
    }

    // 5. Assemble formatted Moment objects with strict user/partner photo isolation
    const assembledMoments: Moment[] = (rawMoments || []).map((dbM: any) => {
      const order = (dbM.order || dbM.order_index || 1) as 1 | 2 | 3;
      const mPhotos = allPhotos.filter((p) => p.moment_id === dbM.id);
      const mReactions = allReactions.filter((r) => r.moment_id === dbM.id);

      const userPhotoObj = mPhotos.find((p) => p.user_id === currentUserId);
      const partnerPhotoObj = mPhotos.find((p) => p.user_id !== currentUserId);

      const userPhotoUrl = userPhotoObj?.image_url || userPhotoObj?.imageUrl || null;
      const partnerPhotoUrl = partnerPhotoObj?.image_url || partnerPhotoObj?.imageUrl || null;

      const userReactionObj = mReactions.find((r) => r.user_id === currentUserId);
      const partnerReactionObj = mReactions.find((r) => r.user_id !== currentUserId);

      const photosList: MomentPhoto[] = mPhotos.map((p) => ({
        userId: p.user_id,
        imageUrl: p.image_url || p.imageUrl,
        createdAt: p.created_at,
      }));

      // Determine authoritative status
      let status = dbM.status || 'EMPTY';
      const hasBoth = Boolean(userPhotoUrl && partnerPhotoUrl);
      const hasUser = Boolean(userPhotoUrl);

      if (hasBoth) {
        if (status !== 'COMPLETED' && status !== 'REVEALED' && status !== 'REACTED') {
          status = 'BOTH_UPLOADED';
        }
      } else if (hasUser) {
        if (status === 'EMPTY') {
          status = 'USER_UPLOADED';
        }
      }

      return {
        id: dbM.id,
        pairId,
        createdBy: currentUserId,
        createdAt: dbM.created_at || new Date().toISOString(),
        dateKey: dbM.date_key || dbM.moment_date || todayKey,
        imageUrl: userPhotoUrl,
        caption: null,
        order,
        label: dbM.label || `МОМЕНТ ${order}`,
        prompt: dbM.prompt,
        subtext: dbM.subtext || 'Сделайте по одному фото и откройте их вместе.',
        status: status as any,
        themeColor: dbM.theme_color || 'pink',
        userPhoto: userPhotoUrl,
        partnerPhoto: partnerPhotoUrl,
        photos: photosList,
        userReaction: (userReactionObj?.emoji || null) as ReactionEmoji | null,
        partnerReaction: (partnerReactionObj?.emoji || null) as ReactionEmoji | null,
        completedAt: dbM.completed_at || undefined,
        completedTimestamp: dbM.completed_timestamp || (dbM.completed_at ? new Date(dbM.completed_at).getTime() : undefined),
      };
    });

    // 6. Fetch history moments (past days)
    let historyDays: HistoryDay[] = [];
    try {
      const { data: pastMoments } = await supabase
        .from('moments')
        .select('*')
        .eq('pair_id', pairId)
        .neq('date_key', todayKey)
        .order('created_at', { ascending: false });

      if (pastMoments && pastMoments.length > 0) {
        const pastIds = pastMoments.map((m: any) => m.id);
        const { data: pastPhotos } = await supabase
          .from('photos')
          .select('*')
          .in('moment_id', pastIds);

        const photosByMoment = new Map<string, any[]>();
        (pastPhotos || []).forEach((p: any) => {
          const list = photosByMoment.get(p.moment_id) || [];
          list.push(p);
          photosByMoment.set(p.moment_id, list);
        });

        const dayMap = new Map<string, Moment[]>();
        pastMoments.forEach((pm: any) => {
          const dKey = pm.date_key || pm.moment_date || todayKey;
          const pPhotos = photosByMoment.get(pm.id) || [];
          const uPhoto = pPhotos.find((p) => p.user_id === currentUserId)?.image_url || null;
          const pPhoto = pPhotos.find((p) => p.user_id !== currentUserId)?.image_url || null;

          const hMoment: Moment = {
            id: pm.id,
            pairId,
            createdBy: currentUserId,
            createdAt: pm.created_at,
            dateKey: dKey,
            imageUrl: uPhoto,
            caption: null,
            order: pm.order || pm.order_index || 1,
            label: pm.label || `МОМЕНТ ${pm.order || 1}`,
            prompt: pm.prompt,
            subtext: pm.subtext || '',
            status: pm.status || 'COMPLETED',
            themeColor: pm.theme_color || 'peach',
            userPhoto: uPhoto,
            partnerPhoto: pPhoto,
            photos: pPhotos.map((p) => ({
              userId: p.user_id,
              imageUrl: p.image_url,
              createdAt: p.created_at,
            })),
            userReaction: null,
            partnerReaction: null,
          };

          const list = dayMap.get(dKey) || [];
          list.push(hMoment);
          dayMap.set(dKey, list);
        });

        historyDays = Array.from(dayMap.entries()).map(([dKey, dayMoments], idx) => ({
          id: `day-${dKey}`,
          dateKey: dKey,
          title: formatRussianDate(dKey),
          subtitle: `${dayMoments.length} моментов открыто`,
          dateStr: formatRussianDate(dKey),
          moments: dayMoments.sort((a, b) => a.order - b.order),
          isLocked: !isLovely && idx > 2,
        }));
      }
    } catch {
      // silent
    }

    return {
      pair: coupleState,
      moments: assembledMoments,
      history: historyDays,
    };
  }

  /**
   * Initializes or restores Supabase user session and pair state
   */
  async initSession(): Promise<SessionResponse> {
    const userId = await this.ensureAuthenticatedUser();
    const profile = await this.getOrCreateProfile(userId);

    const userSession: UserSessionData = {
      id: userId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarColor: profile.avatarColor,
      currentPairId: null,
      createdAt: new Date().toISOString(),
    };

    if (!supabaseConfig.isConfigured) {
      return {
        success: true,
        user: userSession,
        token: userId,
        isNewUser: !profile.displayName,
        hasCompletedOnboarding: false,
        pair: null,
        moments: [],
        history: [],
      };
    }

    // Check if user is a member of any pair in public.pair_members
    try {
      const { data: membership, error } = await supabase
        .from('pair_members')
        .select('pair_id')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membership?.pair_id && !error) {
        this.currentPairId = membership.pair_id;
        userSession.currentPairId = membership.pair_id;

        const assembled = await this.assemblePairData(membership.pair_id, userId);
        return {
          success: true,
          user: userSession,
          token: userId,
          isNewUser: false,
          hasCompletedOnboarding: true,
          pair: assembled.pair,
          moments: assembled.moments,
          history: assembled.history,
        };
      }
    } catch (err) {
      console.warn('[OURS Session] Exception checking pair membership:', err);
    }

    return {
      success: true,
      user: userSession,
      token: userId,
      isNewUser: !profile.displayName,
      hasCompletedOnboarding: false,
      pair: null,
      moments: [],
      history: [],
    };
  }

  /**
   * Create a new Pair in Supabase
   */
  async createPair(userName: string): Promise<PairResponse> {
    const userId = await this.ensureAuthenticatedUser();
    const cleanName = userName.trim();

    // 1. Update user profile in public.profiles
    await supabase.from('profiles').upsert(
      {
        id: userId,
        name: cleanName,
      },
      { onConflict: 'id' }
    );

    let pairId: string | null = null;
    let inviteCode: string | null = null;

    // 2. Call Supabase RPC 'create_pair'
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_pair');

    if (rpcError) {
      throw new Error(rpcError.message || 'Ошибка создания пары');
    }

    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData;

    if (!rpcRow?.pair_id || !rpcRow?.pair_code) {
      throw new Error('create_pair RPC returned invalid data');
    }

    pairId = rpcRow.pair_id;
    inviteCode = rpcRow.pair_code;

    this.currentPairId = pairId;
    const assembled = await this.assemblePairData(pairId!, userId);
    return {
      success: true,
      pair: assembled.pair,
      moments: assembled.moments,
      history: assembled.history,
    };
  }

  /**
   * Join an existing Pair in Supabase by invite code via RPC
   */
  async joinPair(userName: string, inviteCode: string): Promise<PairResponse> {
    const userId = await this.ensureAuthenticatedUser();
    const cleanName = userName.trim();
    const cleanCode = inviteCode.trim().toUpperCase();

    // 1. Update user profile
    await supabase.from('profiles').upsert(
      {
        id: userId,
        name: cleanName,
      },
      { onConflict: 'id' }
    );

    // 2. Join pair atomically via PostgreSQL RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc('join_pair', {
      invite_code: cleanCode,
    });

    if (rpcError) {
      const errMsg = rpcError.message || '';
      if (errMsg.includes('Pair not found')) {
        throw new Error('Пара с таким кодом не найдена. Проверьте код и попробуйте снова.');
      }
      if (errMsg.includes('Pair is full')) {
        throw new Error('Эта пара уже заполнена');
      }
      throw new Error(rpcError.message || 'Ошибка присоединения к паре');
    }

    let pairId: string | null = null;
    if (Array.isArray(rpcData) && rpcData.length > 0) {
      pairId = rpcData[0].pair_id;
    } else if (rpcData && typeof rpcData === 'object') {
      pairId = (rpcData as any).pair_id;
    }

    if (!pairId) {
      throw new Error('Не удалось получить идентификатор пары');
    }

    this.currentPairId = pairId;
    const assembled = await this.assemblePairData(pairId, userId);
    return {
      success: true,
      pair: assembled.pair,
      moments: assembled.moments,
      history: assembled.history,
    };
  }

  /**
   * Update Profile in public.profiles
   */
  async updateProfile(updates: { name?: string; avatarUrl?: string | null; avatarColor?: string }) {
    const userId = await this.ensureAuthenticatedUser();
    const profileUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (updates.name !== undefined) profileUpdates.display_name = updates.name.trim();
    if (updates.avatarUrl !== undefined) profileUpdates.avatar_url = updates.avatarUrl;
    if (updates.avatarColor !== undefined) profileUpdates.avatar_color = updates.avatarColor;

    await supabase.from('profiles').update(profileUpdates).eq('id', userId);
    return { success: true };
  }

  /**
   * Fetch current Pair state for live polling / real-time multi-device sync
   */
  async fetchPairState(): Promise<PairResponse> {
    const userId = await this.ensureAuthenticatedUser();
    if (!this.currentPairId) {
      const { data: membership } = await supabase
        .from('pair_members')
        .select('pair_id')
        .eq('user_id', userId)
        .order('joined_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membership?.pair_id) {
        this.currentPairId = membership.pair_id;
      }
    }

    if (!this.currentPairId) {
      return { success: false, pair: null, moments: [], history: [] };
    }

    const assembled = await this.assemblePairData(this.currentPairId, userId);
    return {
      success: true,
      pair: assembled.pair,
      moments: assembled.moments,
      history: assembled.history,
    };
  }

  /**
   * Upload Photo for a Moment to Supabase Storage + public.photos metadata
   */
  async uploadPhoto(momentId: string, photoData: string): Promise<{ success: boolean; moment?: Moment }> {
    const userId = await this.ensureAuthenticatedUser();
    const pairId = this.currentPairId || 'pair';

    // 1. Upload to Supabase Storage
    const publicUrl = await photoStorageService.uploadMomentPhoto(
      pairId,
      momentId,
      userId,
      photoData
    );

    // 2. Upsert photo metadata into public.photos
    await supabase.from('photos').upsert(
      {
        moment_id: momentId,
        user_id: userId,
        image_url: publicUrl,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'moment_id,user_id' }
    );

    // 3. Check if partner has uploaded
    const { data: momentPhotos } = await supabase
      .from('photos')
      .select('user_id')
      .eq('moment_id', momentId);

    const hasPartner = (momentPhotos || []).some((p: any) => p.user_id !== userId);
    const newStatus = hasPartner ? 'BOTH_UPLOADED' : 'USER_UPLOADED';

    // Update moment status in public.moments
    await supabase.from('moments').update({ status: newStatus }).eq('id', momentId);

    if (this.currentPairId) {
      const state = await this.assemblePairData(this.currentPairId, userId);
      const moment = state.moments.find((m) => m.id === momentId);
      return { success: true, moment };
    }

    return { success: true };
  }

  /**
   * Reveal Moment in public.moments
   */
  async revealMoment(momentId: string): Promise<{ success: boolean; moment?: Moment }> {
    await supabase
      .from('moments')
      .update({ revealed: true, status: 'REVEALED' })
      .eq('id', momentId);

    return { success: true };
  }

  /**
   * Submit Reaction in public.reactions
   */
  async submitReaction(momentId: string, emoji: ReactionEmoji): Promise<{ success: boolean; moment?: Moment }> {
    const userId = await this.ensureAuthenticatedUser();
    await supabase.from('reactions').upsert(
      {
        moment_id: momentId,
        user_id: userId,
        emoji: emoji,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'moment_id,user_id' }
    );

    await supabase.from('moments').update({ status: 'REACTED' }).eq('id', momentId);
    return { success: true };
  }

  /**
   * Complete Moment in public.moments
   */
  async completeMoment(momentId: string): Promise<{ success: boolean; moment?: Moment }> {
    const nowIso = new Date().toISOString();
    const nowTs = Date.now();

    await supabase
      .from('moments')
      .update({
        status: 'COMPLETED',
        completed_at: nowIso,
        completed_timestamp: nowTs,
      })
      .eq('id', momentId);

    if (this.currentPairId) {
      const userId = await this.ensureAuthenticatedUser();
      const state = await this.assemblePairData(this.currentPairId, userId);
      const moment = state.moments.find((m) => m.id === momentId);
      return { success: true, moment };
    }

    return { success: true };
  }

  /**
   * Purchase Lovely for Pair
   */
  async purchaseLovely(): Promise<{ success: boolean; isLovely: boolean }> {
    if (this.currentPairId) {
      await supabase
        .from('pairs')
        .update({
          is_lovely: true,
          lovely_purchased_at: new Date().toISOString(),
          subscription: 'premium',
        })
        .eq('id', this.currentPairId);
    }
    return { success: true, isLovely: true };
  }

  /**
   * Reset Lovely for Pair
   */
  async resetLovely(): Promise<{ success: boolean; isLovely: boolean }> {
    if (this.currentPairId) {
      await supabase
        .from('pairs')
        .update({
          is_lovely: false,
          subscription: 'free',
        })
        .eq('id', this.currentPairId);
    }
    return { success: true, isLovely: false };
  }

  /**
   * Reset User Session (Dev tool)
   */
  async resetUser(): Promise<void> {
    this.currentUserId = null;
    this.currentPairId = null;
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }
}

export const apiClient = new ApiClient();
