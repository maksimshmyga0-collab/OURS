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
} from '../../types/index';
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
          displayName: profile.name || profile.display_name || defaultName,
          avatarUrl: profile.avatar_url || null,
          avatarColor: profile.avatar_color || '#F6DCE1',
        };
      }

      if (defaultName) {
        await supabase.from('profiles').upsert(
          {
            id: userId,
            name: defaultName,
          },
          { onConflict: 'id' }
        );
      }
    } catch (err) {
      console.warn('[OURS Profiles] Profile access warning:', err);
    }

    return defaultProfile;
  }

  /**
   * Helper: Build complete CoupleState, Moments, and History from Supabase tables
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
      .select('pair_id, user_id, joined_at')
      .eq('pair_id', pairId);

    const memberList = members || [];
    const memberUserIds = memberList.map((m: any) => m.user_id).filter(Boolean);

    // Fetch member profiles from public.profiles
    let profileRows: any[] = [];
    if (memberUserIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, name, avatar_url, created_at')
        .in('id', memberUserIds);
      profileRows = profs || [];
    }
    const profileMap = new Map<string, any>(profileRows.map((p) => [p.id, p]));

    // Current user profile (Device identity)
    const myProfileRow = profileMap.get(currentUserId);
    const myProfile = {
      id: currentUserId,
      name: myProfileRow?.name || '',
      avatarUrl: myProfileRow?.avatar_url || null,
      avatarColor: '#F6DCE1',
    };

    if (!myProfile.name) {
      const pData = await this.getOrCreateProfile(currentUserId);
      myProfile.name = pData.displayName;
      myProfile.avatarUrl = pData.avatarUrl;
    }

    // Partner profile (the other user in pair_members)
    const partnerMember = memberList.find((m: any) => m.user_id !== currentUserId);
    const partnerUserId = partnerMember?.user_id || '';
    const partnerProfileRow = partnerUserId ? profileMap.get(partnerUserId) : null;

    const partnerProfile = {
      id: partnerUserId,
      name: partnerProfileRow?.name || (partnerUserId ? 'Партнёр' : ''),
      avatarUrl: partnerProfileRow?.avatar_url || null,
      avatarColor: '#DDEAF7',
    };

    if (partnerUserId && !partnerProfile.name) {
      const pData = await this.getOrCreateProfile(partnerUserId, 'Партнёр');
      partnerProfile.name = pData.displayName || 'Партнёр';
      partnerProfile.avatarUrl = pData.avatarUrl;
    }

    const isConnected = Boolean(partnerUserId);
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
      .eq('moment_date', todayKey)
      .order('created_at', { ascending: true });

    // If no moments exist for today, create the 3 moments in Supabase
    if (!rawMoments || rawMoments.length === 0) {
      const newMomentsToInsert = ([1, 2, 3] as const).map((order) => {
        const promptInfo = getPromptForPairMoment(pairId, todayKey, order);
        return {
          pair_id: pairId,
          moment_date: todayKey,
          prompt: promptInfo.prompt,
        };
      });

      try {
        const { data: inserted } = await supabase
          .from('moments')
          .insert(newMomentsToInsert)
          .select();
        rawMoments = inserted || [];
      } catch (err) {
        console.warn('Failed to insert moments:', err);
      }
    }

    // Fallback if offline/uninitialized
    if (!rawMoments || rawMoments.length === 0) {
      rawMoments = ([1, 2, 3] as const).map((order) => {
        const promptInfo = getPromptForPairMoment(pairId, todayKey, order);
        return {
          id: `moment_${pairId}_${todayKey}_${order}`,
          pair_id: pairId,
          moment_date: todayKey,
          prompt: promptInfo.prompt,
          created_at: new Date().toISOString(),
        };
      });
    }

    // 4. Fetch all photos & reactions for all moments of this pair
    const { data: allPairMoments } = await supabase
      .from('moments')
      .select('*')
      .eq('pair_id', pairId)
      .order('created_at', { ascending: true });

    const allPairMomentList = allPairMoments || rawMoments || [];
    const allMomentIds = allPairMomentList.map((m: any) => m.id);

    let allPhotos: any[] = [];
    let allReactions: any[] = [];

    if (allMomentIds.length > 0) {
      try {
        const { data: pData } = await supabase
          .from('photos')
          .select('*')
          .in('moment_id', allMomentIds);
        allPhotos = pData || [];
      } catch {
        // silent
      }

      try {
        const { data: rData } = await supabase
          .from('reactions')
          .select('*')
          .in('moment_id', allMomentIds);
        allReactions = rData || [];
      } catch {
        // silent
      }
    }

    // 5. Assemble formatted Moment objects for today with strict user/partner photo isolation
    const assembledMoments: Moment[] = (rawMoments || []).map((dbM: any, idx: number) => {
      const order = ((idx % 3) + 1) as 1 | 2 | 3;
      const promptInfo = getPromptForPairMoment(pairId, todayKey, order);

      const mPhotos = allPhotos.filter((p) => p.moment_id === dbM.id);
      const mReactions = allReactions.filter((r) => r.moment_id === dbM.id);

      const userPhotoObj = mPhotos.find((p) => p.user_id === currentUserId);
      const partnerPhotoObj = mPhotos.find((p) => p.user_id !== currentUserId);

      const userPhotoUrl = userPhotoObj?.storage_path || userPhotoObj?.image_url || null;
      const partnerPhotoUrl = partnerPhotoObj?.storage_path || partnerPhotoObj?.image_url || null;

      const userReactionObj = mReactions.find((r) => r.user_id === currentUserId);
      const partnerReactionObj = mReactions.find((r) => r.user_id !== currentUserId);

      const photosList: MomentPhoto[] = mPhotos.map((p) => ({
        userId: p.user_id,
        imageUrl: p.storage_path || p.image_url,
        createdAt: p.created_at,
      }));

      // Determine authoritative status
      const hasBoth = Boolean(userPhotoUrl && partnerPhotoUrl);
      const hasUser = Boolean(userPhotoUrl);

      const uEmoji = userReactionObj?.reaction || userReactionObj?.emoji;
      const pEmoji = partnerReactionObj?.reaction || partnerReactionObj?.emoji;
      const hasRealReaction = Boolean((uEmoji && uEmoji !== '✨') || (pEmoji && pEmoji !== '✨'));
      const hasMatchMarker = Boolean(userReactionObj || partnerReactionObj);

      let status = 'EMPTY';
      if (hasBoth) {
        if (hasRealReaction) {
          status = 'REACTED';
        } else if (hasMatchMarker) {
          status = 'REVEALED';
        } else {
          status = 'BOTH_UPLOADED';
        }
      } else if (hasUser) {
        status = 'USER_UPLOADED';
      }

      const userReactClean = uEmoji === '✨' ? null : (uEmoji as ReactionEmoji | null);
      const partnerReactClean = pEmoji === '✨' ? null : (pEmoji as ReactionEmoji | null);

      return {
        id: dbM.id,
        pairId,
        createdBy: currentUserId,
        createdAt: dbM.created_at || new Date().toISOString(),
        dateKey: dbM.moment_date || todayKey,
        imageUrl: userPhotoUrl,
        caption: null,
        order,
        label: `МОМЕНТ ${order}`,
        prompt: dbM.prompt || promptInfo.prompt,
        subtext: promptInfo.subtext || 'Сделайте по одному фото и откройте их вместе.',
        status: status as any,
        themeColor: promptInfo.themeColor || 'pink',
        userPhoto: userPhotoUrl,
        partnerPhoto: partnerPhotoUrl,
        photos: photosList,
        userReaction: userReactClean,
        partnerReaction: partnerReactClean,
        completedAt: dbM.created_at || undefined,
        completedTimestamp: dbM.created_at ? new Date(dbM.created_at).getTime() : undefined,
      };
    });

    // 6. Assemble History Days from all completed moments with real photos
    let historyDays: HistoryDay[] = [];
    try {
      const photosByMoment = new Map<string, any[]>();
      allPhotos.forEach((p: any) => {
        const list = photosByMoment.get(p.moment_id) || [];
        list.push(p);
        photosByMoment.set(p.moment_id, list);
      });

      const reactionsByMoment = new Map<string, any[]>();
      allReactions.forEach((r: any) => {
        const list = reactionsByMoment.get(r.moment_id) || [];
        list.push(r);
        reactionsByMoment.set(r.moment_id, list);
      });

      const dayMap = new Map<string, Moment[]>();

      allPairMomentList.forEach((pm: any, idx: number) => {
        const dKey = pm.moment_date || todayKey;
        const pPhotos = photosByMoment.get(pm.id) || [];
        const pReactions = reactionsByMoment.get(pm.id) || [];

        const uPhoto = pPhotos.find((p) => p.user_id === currentUserId)?.storage_path || null;
        const partPhoto = pPhotos.find((p) => p.user_id !== currentUserId)?.storage_path || null;

        // Moment is eligible for History only if both photos exist AND match/reveal has occurred
        const isMatched = Boolean(uPhoto && partPhoto && pReactions.length > 0);

        if (isMatched) {
          const order = ((idx % 3) + 1) as 1 | 2 | 3;
          const uReact = pReactions.find((r) => r.user_id === currentUserId)?.reaction || null;
          const pReact = pReactions.find((r) => r.user_id !== currentUserId)?.reaction || null;

          const hMoment: Moment = {
            id: pm.id,
            pairId,
            createdBy: currentUserId,
            createdAt: pm.created_at,
            dateKey: dKey,
            imageUrl: uPhoto,
            caption: null,
            order,
            label: `МОМЕНТ ${order}`,
            prompt: pm.prompt,
            subtext: '',
            status: 'COMPLETED',
            themeColor: order === 1 ? 'pink' : order === 2 ? 'peach' : 'blue',
            userPhoto: uPhoto,
            partnerPhoto: partPhoto,
            photos: pPhotos.map((p) => ({
              userId: p.user_id,
              imageUrl: p.storage_path,
              createdAt: p.created_at,
            })),
            userReaction: (uReact === '✨' ? null : uReact) as ReactionEmoji | null,
            partnerReaction: (pReact === '✨' ? null : pReact) as ReactionEmoji | null,
            completedAt: pm.created_at,
          };

          const list = dayMap.get(dKey) || [];
          list.push(hMoment);
          dayMap.set(dKey, list);
        }
      });

      historyDays = Array.from(dayMap.entries())
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .map(([dKey, dayMoments], idx) => ({
          id: `day-${dKey}`,
          dateKey: dKey,
          title: dKey === todayKey ? 'Сегодня' : formatRussianDate(dKey),
          subtitle: `${dayMoments.length} ${
            dayMoments.length === 1 ? 'момент' : dayMoments.length < 5 ? 'момента' : 'моментов'
          }`,
          dateStr: formatRussianDate(dKey),
          moments: dayMoments.sort((a, b) => a.order - b.order),
          isLocked: !isLovely && idx > 2,
        }));
    } catch (err) {
      console.warn('[OURS History] Exception assembling history:', err);
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

    // 1. Update user profile with real name
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
    const profileUpdates: Record<string, any> = {};
    if (updates.name !== undefined) profileUpdates.name = updates.name.trim();
    if (updates.avatarUrl !== undefined) profileUpdates.avatar_url = updates.avatarUrl;

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from('profiles').update(profileUpdates).eq('id', userId);
    }
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
   * Realtime channel subscription for changes to photos, reactions, and pair members
   */
  subscribeToPair(pairId: string, onUpdate: () => void): () => void {
    if (!supabaseConfig.isConfigured || !pairId) {
      return () => {};
    }

    try {
      const channel = supabase
        .channel(`pair-sync-${pairId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'photos' },
          () => {
            onUpdate();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'reactions' },
          () => {
            onUpdate();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pair_members' },
          () => {
            onUpdate();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {};
    }
  }

  /**
   * Upload Photo for a Moment to Supabase Storage + public.photos metadata
   */
  async uploadPhoto(momentId: string, photoData: string): Promise<{ success: boolean; moment?: Moment }> {
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

    const pairId = this.currentPairId || 'pair';

    // 1. Upload to Supabase Storage or process as Data URI
    const storageUrl = await photoStorageService.uploadMomentPhoto(
      pairId,
      momentId,
      userId,
      photoData
    );

    // 2. Upsert photo metadata into public.photos with correct column storage_path
    await supabase.from('photos').upsert(
      {
        moment_id: momentId,
        user_id: userId,
        storage_path: storageUrl,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'moment_id,user_id' }
    );

    if (this.currentPairId) {
      const state = await this.assemblePairData(this.currentPairId, userId);
      const moment = state.moments.find((m) => m.id === momentId);
      return { success: true, moment };
    }

    return { success: true };
  }

  /**
   * Reveal Moment: Persists MATCH event in public.reactions with match indicator '✨'
   * so both devices know the moment has been revealed and MATCH is complete!
   */
  async revealMoment(momentId: string): Promise<{ success: boolean; moment?: Moment }> {
    const userId = await this.ensureAuthenticatedUser();
    if (!this.currentPairId) {
      const { data: membership } = await supabase
        .from('pair_members')
        .select('pair_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (membership?.pair_id) this.currentPairId = membership.pair_id;
    }

    // Persist match marker in public.reactions
    await supabase.from('reactions').upsert(
      {
        moment_id: momentId,
        user_id: userId,
        reaction: '✨',
        created_at: new Date().toISOString(),
      },
      { onConflict: 'moment_id,user_id' }
    );

    if (this.currentPairId) {
      const state = await this.assemblePairData(this.currentPairId, userId);
      const moment = state.moments.find((m) => m.id === momentId);
      return { success: true, moment };
    }

    return { success: true };
  }

  /**
   * Submit Reaction in public.reactions
   */
  async submitReaction(momentId: string, emoji: ReactionEmoji): Promise<{ success: boolean; moment?: Moment }> {
    const userId = await this.ensureAuthenticatedUser();
    if (!this.currentPairId) {
      const { data: membership } = await supabase
        .from('pair_members')
        .select('pair_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (membership?.pair_id) this.currentPairId = membership.pair_id;
    }

    await supabase.from('reactions').upsert(
      {
        moment_id: momentId,
        user_id: userId,
        reaction: emoji,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'moment_id,user_id' }
    );

    if (this.currentPairId) {
      const state = await this.assemblePairData(this.currentPairId, userId);
      const moment = state.moments.find((m) => m.id === momentId);
      return { success: true, moment };
    }

    return { success: true };
  }

  /**
   * Complete Moment in public.moments
   */
  async completeMoment(momentId: string): Promise<{ success: boolean; moment?: Moment }> {
    const userId = await this.ensureAuthenticatedUser();
    if (!this.currentPairId) {
      const { data: membership } = await supabase
        .from('pair_members')
        .select('pair_id')
        .eq('user_id', userId)
        .limit(1)
        .maybeSingle();
      if (membership?.pair_id) this.currentPairId = membership.pair_id;
    }

    // Ensure a reaction row exists so it is permanently counted as completed & included in History
    const { data: existingReaction } = await supabase
      .from('reactions')
      .select('reaction')
      .eq('moment_id', momentId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingReaction) {
      await supabase.from('reactions').upsert(
        {
          moment_id: momentId,
          user_id: userId,
          reaction: '❤️',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'moment_id,user_id' }
      );
    }

    if (this.currentPairId) {
      const state = await this.assemblePairData(this.currentPairId, userId);
      const moment = state.moments.find((m) => m.id === momentId);
      return { success: true, moment };
    }

    return { success: true };
  }

  /**
   * One-time LOVELY purchase in public.pairs
   */
  async purchaseLovely(): Promise<boolean> {
    if (!this.currentPairId) return false;
    const purchasedAt = new Date().toISOString();
    await supabase
      .from('pairs')
      .update({
        is_lovely: true,
        lovely_purchased_at: purchasedAt,
        subscription: 'premium',
      })
      .eq('id', this.currentPairId);
    return true;
  }

  /**
   * Reset LOVELY status for testing in public.pairs
   */
  async resetLovely(): Promise<boolean> {
    if (!this.currentPairId) return false;
    await supabase
      .from('pairs')
      .update({
        is_lovely: false,
        lovely_purchased_at: null,
        subscription: 'free',
      })
      .eq('id', this.currentPairId);
    return true;
  }
}

export const apiClient = new ApiClient();
