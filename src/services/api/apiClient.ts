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
  updateServerTimeOffset,
} from '../moments/momentTiming';

let lastClockSync = 0;
async function syncServerClock(): Promise<void> {
  if (!supabaseConfig.isConfigured) return;
  if (Date.now() - lastClockSync < 180000) return;
  lastClockSync = Date.now();
  try {
    const start = Date.now();
    const res = await fetch(`${supabaseConfig.url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: supabaseConfig.anonKey },
    });
    const dateHeader = res.headers.get('date');
    if (dateHeader) {
      const sTime = new Date(dateHeader).getTime();
      const rt = Date.now() - start;
      updateServerTimeOffset(sTime + Math.round(rt / 2));
    }
  } catch {
    // silent fallback
  }
}

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
  private activeChannels: Map<string, any> = new Map();
  private historyCache: Map<string, { data: HistoryDay[]; timestamp: number }> = new Map();

  /**
   * Invalidate history cache on data mutations
   */
  invalidateHistoryCache(pairId?: string): void {
    if (pairId) {
      this.historyCache.delete(pairId);
    } else {
      this.historyCache.clear();
    }
  }

  /**
   * Broadcast instant Realtime event to other pair members on WebSocket channel
   */
  broadcastPairUpdate(pairId: string, payload: any = {}): void {
    try {
      const channel = this.activeChannels.get(pairId);
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'pair_state_change',
          payload: { ...payload, timestamp: Date.now() },
        });
      }
    } catch {
      // Best-effort realtime broadcast
    }
  }

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
   * Helper: Build complete CoupleState and Moments from Supabase tables (fast, startup-optimized)
   */
  private async assemblePairData(
    pairId: string,
    currentUserId: string,
    options: { includeHistory?: boolean; cachedMembers?: any[] } = {}
  ): Promise<{
    pair: CoupleState;
    moments: Moment[];
    history: HistoryDay[];
  }> {
    const todayKey = getLocalDateKey();
    const { includeHistory = false, cachedMembers } = options;

    // 1. Parallel fetch of Pair details, Pair members, and Today's moments (eliminates waterfall)
    const pairRowPromise = supabase
      .from('pairs')
      .select('*')
      .eq('id', pairId)
      .maybeSingle();

    const membersPromise = cachedMembers
      ? Promise.resolve({ data: cachedMembers, error: null })
      : supabase
          .from('pair_members')
          .select('pair_id, user_id, joined_at')
          .eq('pair_id', pairId);

    const todayMomentsPromise = supabase
      .from('moments')
      .select('*')
      .eq('pair_id', pairId)
      .eq('moment_date', todayKey)
      .order('created_at', { ascending: true });

    const [pairRes, membersRes, momentsRes] = await Promise.all([
      pairRowPromise,
      membersPromise,
      todayMomentsPromise,
    ]);

    const pairRow = pairRes.data;
    const inviteCode = pairRow?.code || pairRow?.invite_code || 'OURS';
    const isLovely = Boolean(pairRow?.is_lovely || pairRow?.subscription === 'premium');
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

    const memberList = membersRes.data || [];
    const memberUserIds = memberList.map((m: any) => m.user_id).filter(Boolean);

    let rawMoments = momentsRes.data;

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

    const todayMomentIds = (rawMoments || []).map((m: any) => m.id);

    // 2. Parallel fetch of member profiles, today's photos, and today's reactions
    // ONLY today's photos are fetched here! Eliminates massive 6.4 MB historical photo payload on startup.
    const profilesPromise = memberUserIds.length > 0
      ? supabase.from('profiles').select('id, name, avatar_url, created_at').in('id', memberUserIds)
      : Promise.resolve({ data: [], error: null });

    const photosPromise = todayMomentIds.length > 0
      ? supabase.from('photos').select('*').in('moment_id', todayMomentIds)
      : Promise.resolve({ data: [], error: null });

    const reactionsPromise = todayMomentIds.length > 0
      ? supabase.from('reactions').select('*').in('moment_id', todayMomentIds)
      : Promise.resolve({ data: [], error: null });

    const [profilesRes, photosRes, reactionsRes] = await Promise.all([
      profilesPromise,
      photosPromise,
      reactionsPromise,
    ]);

    const profileRows = profilesRes.data || [];
    const profileMap = new Map<string, any>(profileRows.map((p: any) => [p.id, p]));

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
    const pairSeedVal = `pair_${pairId}`;

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

    const allPhotos = photosRes.data || [];
    const allReactions = reactionsRes.data || [];

    // 3. Assemble formatted Moment objects for today (strictly 3 moments: order 1, 2, 3)
    // De-duplicates parallel moment inserts by grouping candidate IDs per prompt/order
    const assembledMoments: Moment[] = ([1, 2, 3] as const).map((order) => {
      const promptInfo = getPromptForPairMoment(pairId, todayKey, order);

      // Find all database moment rows matching this prompt or order
      const matchingRows = (rawMoments || []).filter((dbM: any) =>
        dbM.prompt === promptInfo.prompt ||
        dbM.id === `moment_${pairId}_${todayKey}_${order}` ||
        dbM.id === `moment-${pairId}-${todayKey}-${order}`
      );

      // All candidate IDs that could have photos/reactions attached
      const candidateIds = matchingRows.map((r: any) => r.id);

      // Prefer the row that already has photos, or the first matching row, or fallback
      const preferredRowWithPhotos = matchingRows.find((r: any) =>
        allPhotos.some((p: any) => p.moment_id === r.id)
      );
      const canonicalDbRow = preferredRowWithPhotos || matchingRows[0] || (rawMoments && rawMoments[order - 1]);
      const canonicalId = canonicalDbRow?.id || `moment_${pairId}_${todayKey}_${order}`;

      // All IDs for this slot (canonical ID + all candidate IDs)
      const slotIds = Array.from(new Set([canonicalId, ...candidateIds].filter(Boolean)));

      const mPhotos = allPhotos.filter((p: any) => slotIds.includes(p.moment_id));
      const mReactions = allReactions.filter((r: any) => slotIds.includes(r.moment_id));

      const userPhotoObj = mPhotos.find((p: any) => p.user_id === currentUserId);
      const partnerPhotoObj = mPhotos.find((p: any) => p.user_id !== currentUserId);

      const userPhotoUrl = userPhotoObj?.storage_path || userPhotoObj?.image_url || null;
      const partnerPhotoUrl = partnerPhotoObj?.storage_path || partnerPhotoObj?.image_url || null;

      const userReactionObj = mReactions.find((r: any) => r.user_id === currentUserId);
      const partnerReactionObj = mReactions.find((r: any) => r.user_id !== currentUserId);

      const photosList: MomentPhoto[] = mPhotos.map((p: any) => ({
        userId: p.user_id,
        imageUrl: p.storage_path || p.image_url,
        createdAt: p.created_at,
      }));

      // Determine authoritative status strictly for the CURRENT user
      const hasBoth = Boolean(userPhotoUrl && partnerPhotoUrl);
      const hasUser = Boolean(userPhotoUrl);

      const uEmoji = userReactionObj?.reaction || userReactionObj?.emoji;
      const pEmoji = partnerReactionObj?.reaction || partnerReactionObj?.emoji;

      const userReactClean = uEmoji === '✨' ? null : (uEmoji as ReactionEmoji | null);
      const partnerReactClean = pEmoji === '✨' ? null : (pEmoji as ReactionEmoji | null);

      const hasUserReaction = Boolean(userReactClean);

      // Authoritative shared server timestamp when MATCH occurred for the pair
      let matchTimestamp: number | undefined = undefined;
      if (hasBoth) {
        const photoTimes = mPhotos
          .map((p: any) => (p.created_at ? new Date(p.created_at).getTime() : 0))
          .filter((t: number) => !isNaN(t) && t > 0);

        if (photoTimes.length >= 2) {
          matchTimestamp = Math.max(...photoTimes);
        }
      }

      let status = 'EMPTY';
      if (hasBoth) {
        if (hasUserReaction) {
          // Current user has already chosen their reaction
          status = 'COMPLETED';
        } else if (uEmoji === '✨') {
          // Current user previously clicked touch / revealed
          status = 'REVEALED';
        } else {
          // Both photos exist, waiting for THIS user to click [ КОСНУТЬСЯ ]
          status = 'BOTH_UPLOADED';
        }
      } else if (hasUser) {
        status = 'USER_UPLOADED';
      }

      return {
        id: canonicalId,
        pairId,
        createdBy: currentUserId,
        createdAt: canonicalDbRow?.created_at || new Date().toISOString(),
        dateKey: canonicalDbRow?.moment_date || todayKey,
        imageUrl: userPhotoUrl,
        caption: null,
        order,
        label: `МОМЕНТ ${order}`,
        prompt: canonicalDbRow?.prompt || promptInfo.prompt,
        subtext: promptInfo.subtext || 'Сделайте по одному фото и откройте их вместе.',
        status: status as any,
        themeColor: promptInfo.themeColor || 'pink',
        userPhoto: userPhotoUrl,
        partnerPhoto: partnerPhotoUrl,
        photos: photosList,
        userReaction: userReactClean,
        partnerReaction: partnerReactClean,
        completedAt: matchTimestamp
          ? new Date(matchTimestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
          : undefined,
        completedTimestamp: matchTimestamp,
      };
    });

    let historyDays: HistoryDay[] = [];
    if (includeHistory) {
      historyDays = await this.fetchHistory(pairId);
    }

    return {
      pair: coupleState,
      moments: assembledMoments,
      history: historyDays,
    };
  }

  /**
   * Lazy-fetch complete history for the pair on demand (e.g. when opening History tab or Our Sky modal)
   */
  async fetchHistory(pairId?: string, forceRefresh: boolean = false): Promise<HistoryDay[]> {
    const targetPairId = pairId || this.currentPairId;
    if (!targetPairId || !supabaseConfig.isConfigured) {
      return [];
    }

    if (!forceRefresh) {
      const cached = this.historyCache.get(targetPairId);
      if (cached && Date.now() - cached.timestamp < 45000) {
        return cached.data;
      }
    }

    try {
      const userId = await this.ensureAuthenticatedUser();
      const todayKey = getLocalDateKey();

      // Fetch all historical moments of this pair
      const { data: allPairMoments } = await supabase
        .from('moments')
        .select('*')
        .eq('pair_id', targetPairId)
        .order('created_at', { ascending: true });

      if (!allPairMoments || allPairMoments.length === 0) {
        return [];
      }

      const allMomentIds = allPairMoments.map((m: any) => m.id);

      // Fetch photos, reactions, and pair plan in parallel
      const [photosRes, reactionsRes, pairRes] = await Promise.all([
        supabase.from('photos').select('*').in('moment_id', allMomentIds),
        supabase.from('reactions').select('*').in('moment_id', allMomentIds),
        supabase.from('pairs').select('is_lovely, subscription').eq('id', targetPairId).maybeSingle(),
      ]);

      const allPhotos = photosRes.data || [];
      const allReactions = reactionsRes.data || [];
      const isLovely = Boolean(pairRes.data?.is_lovely || pairRes.data?.subscription === 'premium');

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

      allPairMoments.forEach((pm: any, idx: number) => {
        const dKey = pm.moment_date || todayKey;
        const pPhotos = photosByMoment.get(pm.id) || [];
        const pReactions = reactionsByMoment.get(pm.id) || [];

        const uPhoto = pPhotos.find((p) => p.user_id === userId)?.storage_path || null;
        const partPhoto = pPhotos.find((p) => p.user_id !== userId)?.storage_path || null;

        const isMatched = Boolean(uPhoto && partPhoto && pReactions.length > 0);

        if (isMatched) {
          const order = ((idx % 3) + 1) as 1 | 2 | 3;
          const uReact = pReactions.find((r) => r.user_id === userId)?.reaction || null;
          const pReact = pReactions.find((r) => r.user_id !== userId)?.reaction || null;

          const hMoment: Moment = {
            id: pm.id,
            pairId: targetPairId,
            createdBy: userId,
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

      // Calculate the 7 calendar days boundary (today + previous 6 days = 7 days)
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 6);
      const sevenDaysAgoKey = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;

      const historyDays: HistoryDay[] = Array.from(dayMap.entries())
        .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
        .map(([dKey, dayMoments]) => {
          const isWithinSevenDays = dKey >= sevenDaysAgoKey;
          const isLocked = !isLovely && !isWithinSevenDays;

          // For Free users, omit high-res photo URLs on locked older days to enforce privacy & data limitation on wire
          const sanitizedMoments = isLocked
            ? dayMoments.map((m) => ({
                ...m,
                imageUrl: null,
                userPhoto: null,
                partnerPhoto: null,
                photos: [],
              }))
            : dayMoments.sort((a, b) => a.order - b.order);

          return {
            id: `day-${dKey}`,
            dateKey: dKey,
            title: dKey === todayKey ? 'Сегодня' : formatRussianDate(dKey),
            subtitle: `${dayMoments.length} ${
              dayMoments.length === 1 ? 'момент' : dayMoments.length < 5 ? 'момента' : 'моментов'
            }`,
            dateStr: formatRussianDate(dKey),
            moments: sanitizedMoments,
            isLocked,
          };
        });

      this.historyCache.set(targetPairId, { data: historyDays, timestamp: Date.now() });
      return historyDays;
    } catch (err) {
      console.warn('[OURS History] Exception lazy-loading history:', err);
      return [];
    }
  }

  /**
   * Временная диагностическая проверка RPC get_my_personal_code() для текущей сессии
   */
  async checkPersonalCodeDiagnostic(): Promise<void> {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentAuthUid = sessionData?.session?.user?.id || this.currentUserId;
      console.log('[OURS Diagnostic] Текущий auth.uid():', currentAuthUid);

      const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_personal_code');

      if (rpcError) {
        console.error('[OURS Diagnostic] Ошибка RPC get_my_personal_code():', rpcError);
      } else {
        console.log('[OURS Diagnostic] Результат RPC get_my_personal_code():', rpcData);
      }
    } catch (diagError) {
      console.error('[OURS Diagnostic] Исключение при выполнении get_my_personal_code():', diagError);
    }
  }

  /**
   * Initializes or restores Supabase user session and pair state
   */
  async initSession(): Promise<SessionResponse> {
    syncServerClock().catch(() => {});
    const userId = await this.ensureAuthenticatedUser();

    // Временная диагностика: вызов RPC get_my_personal_code() после успешной инициализации сессии
    this.checkPersonalCodeDiagnostic().catch((err) => {
      console.error('[OURS Diagnostic] Ошибка при запуске диагностики RPC:', err);
    });

    if (!supabaseConfig.isConfigured) {
      const profile = await this.getOrCreateProfile(userId);
      const userSession: UserSessionData = {
        id: userId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        avatarColor: profile.avatarColor,
        currentPairId: null,
        createdAt: new Date().toISOString(),
      };
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

    // Parallelize profile and pair_members query
    try {
      const [profile, membershipRes] = await Promise.all([
        this.getOrCreateProfile(userId),
        supabase
          .from('pair_members')
          .select('pair_id')
          .eq('user_id', userId)
          .order('joined_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      const membership = membershipRes.data;
      const userSession: UserSessionData = {
        id: userId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        avatarColor: profile.avatarColor,
        currentPairId: membership?.pair_id || null,
        createdAt: new Date().toISOString(),
      };

      if (membership?.pair_id && !membershipRes.error) {
        this.currentPairId = membership.pair_id;

        // Startup fast-path: assemble today's data without blocking on full historical photos
        const assembled = await this.assemblePairData(membership.pair_id, userId, { includeHistory: false });
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
    } catch (err) {
      console.warn('[OURS Session] Exception checking pair membership:', err);
      const profile = await this.getOrCreateProfile(userId);
      return {
        success: true,
        user: {
          id: userId,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          avatarColor: profile.avatarColor,
          currentPairId: null,
          createdAt: new Date().toISOString(),
        },
        token: userId,
        isNewUser: !profile.displayName,
        hasCompletedOnboarding: false,
        pair: null,
        moments: [],
        history: [],
      };
    }
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
   * Restore existing user pair membership by personal code via Supabase RPC
   */
  async restoreUserByPersonalCode(personalCode: string): Promise<PairResponse> {
    const userId = await this.ensureAuthenticatedUser();
    const cleanCode = personalCode.trim().toUpperCase();

    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'restore_user_by_personal_code',
      {
        p_personal_code: cleanCode,
      }
    );

    if (rpcError) {
      const errMsg = rpcError.message || '';
      if (errMsg.includes('Personal code not found')) {
        throw new Error('Личный код не найден. Проверьте правильность кода.');
      }
      if (errMsg.includes('User already belongs to a pair')) {
        throw new Error('Вы уже состоите в паре');
      }
      throw new Error(rpcError.message || 'Ошибка восстановления доступа');
    }

    const pairId = Array.isArray(rpcData)
      ? rpcData[0]?.pair_id
      : rpcData?.pair_id;

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
    syncServerClock().catch(() => {});
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

    const assembled = await this.assemblePairData(this.currentPairId, userId, { includeHistory: false });
    return {
      success: true,
      pair: assembled.pair,
      moments: assembled.moments,
      history: assembled.history,
    };
  }

  /**
   * Realtime channel subscription for changes to photos, reactions, moments, and pair members
   */
  subscribeToPair(pairId: string, onUpdate: () => void): () => void {
    if (!supabaseConfig.isConfigured || !pairId) {
      return () => {};
    }

    // Clean up existing subscription for this pair to prevent duplicate listeners
    const existing = this.activeChannels.get(pairId);
    if (existing) {
      this.activeChannels.delete(pairId);
      try {
        supabase.removeChannel(existing);
      } catch {}
    }

    try {
      const channel = supabase
        .channel(`pair-sync-${pairId}`)
        .on(
          'broadcast',
          { event: 'pair_state_change' },
          () => {
            onUpdate();
          }
        )
        .on(
          'broadcast',
          { event: 'date_invitation_change' },
          () => {
            onUpdate();
          }
        )
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
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'moments' },
          () => {
            onUpdate();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'pairs' },
          () => {
            onUpdate();
          }
        )
        .subscribe();

      this.activeChannels.set(pairId, channel);

      return () => {
        this.activeChannels.delete(pairId);
        try {
          supabase.removeChannel(channel);
        } catch {}
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

    // Instant Realtime broadcast across pair channel
    this.broadcastPairUpdate(pairId, { action: 'photo_uploaded', momentId, userId });
    this.invalidateHistoryCache(pairId);

    try {
      const { data: mPhotos } = await supabase
        .from('photos')
        .select('storage_path, image_url, user_id, created_at')
        .eq('moment_id', momentId);

      const partnerPhotoObj = mPhotos?.find((p: any) => p.user_id !== userId);
      const partnerPhotoUrl = partnerPhotoObj?.storage_path || partnerPhotoObj?.image_url || null;

      let matchTs: number | undefined = undefined;
      if (mPhotos && mPhotos.length >= 2) {
        const times = mPhotos.map((p: any) => new Date(p.created_at).getTime()).filter((t: number) => !isNaN(t) && t > 0);
        if (times.length >= 2) {
          matchTs = Math.max(...times);
        }
      }

      return {
        success: true,
        moment: {
          id: momentId,
          userPhoto: storageUrl,
          ...(partnerPhotoUrl ? { partnerPhoto: partnerPhotoUrl, status: 'BOTH_UPLOADED' } : {}),
          completedTimestamp: matchTs,
        } as any,
      };
    } catch {
      return { success: true };
    }
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

    // Instant Realtime broadcast across pair channel
    if (this.currentPairId) {
      this.broadcastPairUpdate(this.currentPairId, { action: 'moment_revealed', momentId, userId });
      this.invalidateHistoryCache(this.currentPairId);
    }

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

    // Instant Realtime broadcast across pair channel
    if (this.currentPairId) {
      this.broadcastPairUpdate(this.currentPairId, { action: 'reaction_submitted', momentId, userId });
      this.invalidateHistoryCache(this.currentPairId);
    }

    if (this.currentPairId) {
      const state = await this.assemblePairData(this.currentPairId, userId);
      const moment = state.moments.find((m) => m.id === momentId);
      return { success: true, moment };
    }

    return { success: true };
  }

  /**
   * Complete Moment in public.moments with user's selected reaction emoji
   */
  async completeMoment(momentId: string, emoji?: ReactionEmoji): Promise<{ success: boolean; moment?: Moment }> {
    return this.submitReaction(momentId, emoji || '❤️');
  }

  /**
   * One-time LOVELY purchase in public.pairs
   */
  async purchaseLovely(pairId?: string): Promise<boolean> {
    const targetPairId = pairId || this.currentPairId;
    if (!targetPairId) return false;
    this.currentPairId = targetPairId;
    const purchasedAt = new Date().toISOString();
    
    if (supabaseConfig.isConfigured) {
      try {
        const { error } = await supabase
          .from('pairs')
          .update({
            is_lovely: true,
            lovely_purchased_at: purchasedAt,
            subscription: 'premium',
          })
          .eq('id', targetPairId);

        if (error) {
          console.warn('[OURS LOVELY] Supabase error updating pair:', error.message);
        }
      } catch (err) {
        console.warn('[OURS LOVELY] Exception updating pair in Supabase:', err);
      }
    }

    this.broadcastPairUpdate(targetPairId, { action: 'lovely_purchased', purchasedAt });
    return true;
  }

  /**
   * Leave the current pair by deleting the user's membership row from public.pair_members
   */
  async leavePair(): Promise<{ success: boolean; error?: string }> {
    const userId = await this.ensureAuthenticatedUser();
    let pairId = this.currentPairId;

    if (!pairId && supabaseConfig.isConfigured) {
      try {
        const { data: member } = await supabase
          .from('pair_members')
          .select('pair_id')
          .eq('user_id', userId)
          .order('joined_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (member?.pair_id) {
          pairId = member.pair_id;
        }
      } catch (err) {
        console.warn('[OURS LeavePair] Error getting membership:', err);
      }
    }

    if (supabaseConfig.isConfigured && pairId) {
      const { error } = await supabase
        .from('pair_members')
        .delete()
        .eq('pair_id', pairId)
        .eq('user_id', userId);

      if (error) {
        console.error('[OURS LeavePair] Error leaving pair:', error);
        throw new Error(error.message || 'Ошибка выхода из пары');
      }
    }

    this.currentPairId = null;
    return { success: true };
  }

  /**
   * Sign out from Supabase Auth and reset in-memory session
   */
  async signOut(): Promise<void> {
    try {
      if (supabaseConfig.isConfigured) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.warn('[OURS Auth] Error signing out from Supabase:', err);
    } finally {
      this.currentUserId = null;
      this.currentPairId = null;
    }
  }

  /**
   * Reset in-memory session references
   */
  clearLocalSession(): void {
    this.currentUserId = null;
    this.currentPairId = null;
  }

  /**
   * Reset LOVELY status in public.pairs
   */
  async resetLovely(pairId?: string): Promise<boolean> {
    const targetPairId = pairId || this.currentPairId;
    if (!targetPairId) return false;
    this.currentPairId = targetPairId;

    if (supabaseConfig.isConfigured) {
      try {
        await supabase
          .from('pairs')
          .update({
            is_lovely: false,
            lovely_purchased_at: null,
            subscription: 'free',
          })
          .eq('id', targetPairId);
      } catch (err) {
        console.warn('[OURS LOVELY] Exception resetting LOVELY:', err);
      }
    }

    this.broadcastPairUpdate(targetPairId, { action: 'lovely_reset' });
    return true;
  }

  /**
   * Request backend to create a YooKassa payment session (199 ₽)
   */
  async createYooKassaPayment(pairId?: string, returnUrl?: string): Promise<{
    success: boolean;
    paymentId?: string;
    confirmationUrl?: string;
    status?: string;
    error?: string;
    message?: string;
  }> {
    const targetPairId = pairId || this.currentPairId;
    if (!targetPairId) {
      return { success: false, error: 'NO_PAIR_ID', message: 'Идентификатор пары не найден' };
    }

    try {
      const res = await fetch('/api/yookassa/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairId: targetPairId, returnUrl }),
      });

      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('[YooKassa Client] Failed to create payment:', err);
      return { success: false, error: 'NETWORK_ERROR', message: err.message || 'Ошибка сети' };
    }
  }

  /**
   * Verify YooKassa payment status with backend
   */
  async checkPaymentStatus(paymentId: string): Promise<{
    success: boolean;
    status: string;
    isLovely: boolean;
    error?: string;
  }> {
    if (!paymentId) {
      return { success: false, status: 'error', isLovely: false, error: 'Payment ID is required' };
    }

    try {
      const res = await fetch(`/api/yookassa/check-status/${encodeURIComponent(paymentId)}`);
      const data = await res.json();
      return data;
    } catch (err: any) {
      console.error('[YooKassa Client] Failed to check status:', err);
      return { success: false, status: 'error', isLovely: false, error: err.message };
    }
  }

  /**
   * Get cached or active current user auth id
   */
  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  /**
   * Fetch active date invitation for pair from Supabase (with backend fallback)
   */
  async fetchDateInvitation(pairId: string): Promise<any> {
    if (!pairId) return null;

    // 1. Primary source of truth: Supabase database
    try {
      const { data: dbMoments, error } = await supabase
        .from('moments')
        .select('*')
        .eq('pair_id', pairId)
        .eq('moment_date', '1970-01-01')
        .order('created_at', { ascending: false })
        .limit(1);

      if (!error && dbMoments && dbMoments.length > 0) {
        const row = dbMoments[0];
        if (row.prompt && row.prompt.startsWith('DATE_INVITATION:')) {
          try {
            const rawJson = row.prompt.replace('DATE_INVITATION:', '');
            const parsed = JSON.parse(rawJson);
            if (parsed && parsed.id) {
              return { ...parsed, pairId, dbMomentId: row.id };
            }
          } catch (e) {
            console.warn('[OURS Date] JSON parse error from Supabase moment:', e);
          }
        }
      }
    } catch (dbErr) {
      console.warn('[OURS Date] Supabase fetch exception:', dbErr);
    }

    // 2. Secondary fallback: Backend API
    try {
      const res = await fetch(`/api/dates/invitation/${encodeURIComponent(pairId)}`);
      const data = await res.json();
      if (data && data.success && data.invitation) {
        return data.invitation;
      }
    } catch (err) {
      console.warn('[OURS Date] Failed to fetch date invitation from backend API:', err);
    }

    return null;
  }

  /**
   * Send a new date invitation, persist to Supabase + backend, and broadcast to partner
   */
  async sendDateInvitation(payload: {
    pairId: string;
    id?: string;
    senderUserId: string;
    senderName: string;
    recipientUserId?: string;
    recipientName: string;
    idea: any;
  }): Promise<any> {
    if (!payload.pairId) return null;

    const invId = payload.id || `inv-${Date.now()}`;
    const invitationData = {
      id: invId,
      pairId: payload.pairId,
      senderUserId: payload.senderUserId || this.currentUserId || '',
      senderName: payload.senderName || 'Ты',
      recipientUserId: payload.recipientUserId || '',
      recipientName: payload.recipientName || 'Партнёр',
      idea: payload.idea,
      status: 'pending',
      readByRecipient: false,
      createdAt: new Date().toISOString(),
    };

    // 1. Persist directly to Supabase
    try {
      // Clean up previous date invitation moments for this pair
      await supabase
        .from('moments')
        .delete()
        .eq('pair_id', payload.pairId)
        .eq('moment_date', '1970-01-01');

      // Insert new date invitation moment
      await supabase.from('moments').insert({
        pair_id: payload.pairId,
        moment_date: '1970-01-01',
        prompt: `DATE_INVITATION:${JSON.stringify(invitationData)}`,
      });
    } catch (dbErr) {
      console.warn('[OURS Date] Supabase insert date invitation exception:', dbErr);
    }

    // 2. Persist to backend server API
    try {
      await fetch('/api/dates/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invitationData),
      });
    } catch (apiErr) {
      console.warn('[OURS Date] Backend API insert date invitation exception:', apiErr);
    }

    // 3. Broadcast instant Realtime notification to partner
    this.broadcastPairUpdate(payload.pairId, {
      action: 'date_invitation_created',
      invitation: invitationData,
    });

    return invitationData;
  }

  /**
   * Mark date invitation as read by recipient in Supabase + backend
   */
  async markDateInvitationAsRead(pairId: string): Promise<any> {
    if (!pairId) return null;

    // 1. Update in Supabase
    try {
      const { data: rows } = await supabase
        .from('moments')
        .select('*')
        .eq('pair_id', pairId)
        .eq('moment_date', '1970-01-01')
        .order('created_at', { ascending: false })
        .limit(1);

      if (rows && rows.length > 0) {
        const row = rows[0];
        if (row.prompt && row.prompt.startsWith('DATE_INVITATION:')) {
          const parsed = JSON.parse(row.prompt.replace('DATE_INVITATION:', ''));
          parsed.readByRecipient = true;
          await supabase
            .from('moments')
            .update({
              prompt: `DATE_INVITATION:${JSON.stringify(parsed)}`,
            })
            .eq('id', row.id);
        }
      }
    } catch (dbErr) {
      console.warn('[OURS Date] Supabase mark read exception:', dbErr);
    }

    // 2. Update in Backend API
    try {
      await fetch(`/api/dates/invitation/${encodeURIComponent(pairId)}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (apiErr) {
      console.warn('[OURS Date] Backend API mark read exception:', apiErr);
    }

    // 3. Broadcast Realtime
    this.broadcastPairUpdate(pairId, { action: 'date_invitation_read' });
    return true;
  }

  /**
   * Respond to date invitation (accepted / declined) in Supabase + backend
   */
  async respondToDateInvitation(pairId: string, status: 'accepted' | 'declined'): Promise<any> {
    if (!pairId) return null;

    let updatedInvitation: any = null;

    // 1. Update in Supabase
    try {
      const { data: rows } = await supabase
        .from('moments')
        .select('*')
        .eq('pair_id', pairId)
        .eq('moment_date', '1970-01-01')
        .order('created_at', { ascending: false })
        .limit(1);

      if (rows && rows.length > 0) {
        const row = rows[0];
        if (row.prompt && row.prompt.startsWith('DATE_INVITATION:')) {
          const parsed = JSON.parse(row.prompt.replace('DATE_INVITATION:', ''));
          parsed.status = status;
          parsed.readByRecipient = true;
          parsed.respondedAt = new Date().toISOString();
          updatedInvitation = parsed;

          await supabase
            .from('moments')
            .update({
              prompt: `DATE_INVITATION:${JSON.stringify(parsed)}`,
            })
            .eq('id', row.id);
        }
      }
    } catch (dbErr) {
      console.warn('[OURS Date] Supabase respond exception:', dbErr);
    }

    // 2. Update in Backend API
    try {
      const res = await fetch(`/api/dates/invitation/${encodeURIComponent(pairId)}/respond`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data && data.success && data.invitation) {
        updatedInvitation = data.invitation;
      }
    } catch (apiErr) {
      console.warn('[OURS Date] Backend API respond exception:', apiErr);
    }

    // 3. Broadcast Realtime
    this.broadcastPairUpdate(pairId, {
      action: 'date_invitation_responded',
      status,
      invitation: updatedInvitation,
    });

    return updatedInvitation;
  }

  /**
   * Clear date invitation for pair in Supabase + backend
   */
  async clearDateInvitation(pairId: string): Promise<boolean> {
    if (!pairId) return false;

    // 1. Delete in Supabase
    try {
      await supabase
        .from('moments')
        .delete()
        .eq('pair_id', pairId)
        .eq('moment_date', '1970-01-01');
    } catch (dbErr) {
      console.warn('[OURS Date] Supabase clear exception:', dbErr);
    }

    // 2. Delete in Backend API
    try {
      await fetch(`/api/dates/invitation/${encodeURIComponent(pairId)}`, {
        method: 'DELETE',
      });
    } catch (apiErr) {
      console.warn('[OURS Date] Backend API clear exception:', apiErr);
    }

    // 3. Broadcast Realtime
    this.broadcastPairUpdate(pairId, { action: 'date_invitation_cleared' });
    return true;
  }
}

export const apiClient = new ApiClient();

if (typeof window !== 'undefined') {
  (window as any).apiClient = apiClient;
}
