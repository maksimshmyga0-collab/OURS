/**
 * OURS Supabase Client API Service
 * Real Supabase backend integration for Auth, Profiles, Pairs, Moments, Photos, Reactions, and History.
 */

import { supabase, supabaseConfig } from './supabaseClient';
import { env } from '../config/env';
import { photoStorageService } from '../storage/storageService';
import { appStorage } from '../storage/keyValueStorage';
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
import {
  recordAccumulatedStarDates,
  recordAccumulatedStarRecords,
  StarEvent,
  isMomentMatched,
} from '../sky/skyService';

let lastClockSync = 0;
async function syncServerClock(): Promise<void> {
  if (!supabaseConfig.isConfigured) return;
  if (Date.now() - lastClockSync < 180000) return;
  lastClockSync = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const start = Date.now();
    const res = await fetch(`${supabaseConfig.url}/rest/v1/`, {
      method: 'HEAD',
      headers: { apikey: supabaseConfig.anonKey },
      signal: controller.signal,
    });
    clearTimeout(timer);
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
  private historyInflight: Map<string, Promise<HistoryDay[]>> = new Map();
  private authLockPromise: Promise<string> | null = null;
  private cachedPartnerNames: Map<string, string> = new Map();

  constructor() {
    try {
      supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user?.id) {
          this.currentUserId = session.user.id;
        } else if (event === 'SIGNED_OUT') {
          this.currentUserId = null;
          this.currentPairId = null;
          this.historyCache.clear();
          this.historyInflight.clear();
        }
      });
    } catch {
      // Safe fallback if auth state change listener is unavailable
    }
  }

  /**
   * Helper: Resolves backend API base URL (supports absolute URL in native Capacitor APK or relative in web)
   */
  private getApiBaseUrl(): string {
    const configured = env.apiUrl;
    if (configured && typeof configured === 'string') {
      return configured.replace(/\/+$/, '');
    }
    return '';
  }

  /**
   * Cache or retrieve known partner name for this pair to prevent fallback degradation
   */
  getKnownPartnerName(pairId: string): string | null {
    return this.cachedPartnerNames.get(pairId) || null;
  }

  setKnownPartnerName(pairId: string, name: string): void {
    if (name && name.trim() && name.trim() !== 'Партнёр') {
      this.cachedPartnerNames.set(pairId, name.trim());
    }
  }

  /**
   * Return in-memory cached history without issuing any network requests
   */
  getCachedHistory(pairId?: string): HistoryDay[] | null {
    const targetPairId = pairId || this.currentPairId;
    if (!targetPairId) return null;
    const cached = this.historyCache.get(targetPairId);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }
    return null;
  }

  /**
   * Invalidate history cache on data mutations
   */
  invalidateHistoryCache(pairId?: string): void {
    if (pairId) {
      this.historyCache.delete(pairId);
      this.historyInflight.delete(pairId);
    } else {
      this.historyCache.clear();
      this.historyInflight.clear();
    }
  }

  /**
   * Helper: Get current active Supabase access token for authenticated API requests
   */
  async getAuthToken(): Promise<string | null> {
    try {
      const { data } = await supabase.auth.getSession();
      return data?.session?.access_token || null;
    } catch {
      return null;
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
   * Helper: Ensures valid anonymous Supabase authentication and returns real auth user ID.
   * Completely eliminates fake UUIDs, enforces single-flight locking, and handles token refresh.
   */
  async ensureAuthenticatedUser(): Promise<string> {
    // 1. If we have a cached user ID, verify the Supabase session is still active
    if (this.currentUserId) {
      try {
        const { data: currentSession } = await supabase.auth.getSession();
        if (currentSession?.session?.user?.id === this.currentUserId) {
          const expiresAt = currentSession.session.expires_at;
          // If token has at least 60 seconds of validity remaining, return cached ID
          if (!expiresAt || (expiresAt * 1000) > (Date.now() + 60000)) {
            return this.currentUserId;
          }
        }
      } catch {
        // Fall through to performEnsureAuth
      }
    }

    // 2. Single-flight lock: deduplicate concurrent authentication requests
    if (this.authLockPromise) {
      return this.authLockPromise;
    }

    this.authLockPromise = this.performEnsureAuth().finally(() => {
      this.authLockPromise = null;
    });

    return this.authLockPromise;
  }

  private async performEnsureAuth(): Promise<string> {
    try {
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      let session = sessionData?.session;

      // Check if session token needs refresh
      if (session) {
        const expiresAt = session.expires_at;
        if (expiresAt && (expiresAt * 1000) <= (Date.now() + 60000)) {
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
          if (!refreshErr && refreshed.session) {
            session = refreshed.session;
          } else {
            console.warn('[OURS Auth] Token refresh failed or session expired. Re-authenticating anonymously:', refreshErr?.message);
            session = null;
          }
        }
      }

      let user: any = session?.user;

      if (!user || sessionErr) {
        const signInPromise = supabase.auth.signInAnonymously();
        let timeoutId: any;
        const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('Auth request timeout')), 6000);
        });

        const { data: signInData, error: signInError } = await Promise.race([signInPromise, timeoutPromise]).finally(() => {
          clearTimeout(timeoutId);
        });

        if (signInError) {
          console.error('[OURS Auth] Anonymous sign in failed:', signInError.message);
          throw new Error(`Ошибка авторизации: ${signInError.message}`);
        }
        user = signInData?.user;
      }

      if (user?.id) {
        this.currentUserId = user.id;
        return user.id;
      }

      throw new Error('[OURS Auth] Не удалось получить валидный идентификатор пользователя');
    } catch (err: any) {
      console.error('[OURS Auth] Exception in performEnsureAuth:', err);
      throw err;
    }
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

    let partnerName = partnerProfileRow?.name?.trim() || '';
    let partnerAvatar = partnerProfileRow?.avatar_url || null;

    if (partnerUserId && !partnerName) {
      const pData = await this.getOrCreateProfile(partnerUserId, '');
      if (pData.displayName) {
        partnerName = pData.displayName;
        partnerAvatar = pData.avatarUrl;
      }
    }

    // Preservation: if partnerName is still empty, check if we have a locally cached known partner name
    if (!partnerName && this.cachedPartnerNames.has(pairId)) {
      partnerName = this.cachedPartnerNames.get(pairId) || '';
    }

    if (partnerName && partnerName !== 'Партнёр') {
      this.cachedPartnerNames.set(pairId, partnerName);
    }

    const partnerProfile = {
      id: partnerUserId,
      name: partnerName || (partnerUserId ? 'Партнёр' : ''),
      avatarUrl: partnerAvatar,
      avatarColor: '#DDEAF7',
    };

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

      const rawUserPhoto = userPhotoObj?.storage_path || userPhotoObj?.image_url || null;
      const rawPartnerPhoto = partnerPhotoObj?.storage_path || partnerPhotoObj?.image_url || null;

      // Filter out invalid/unrenderable local blob URLs that cannot cross device boundaries
      const sanitizePhotoUrl = (url: string | null | undefined): string | null => {
        if (!url || typeof url !== 'string') return null;
        if (url.startsWith('blob:')) return null;
        return url;
      };

      const userPhotoUrl = sanitizePhotoUrl(rawUserPhoto);
      const partnerPhotoUrl = sanitizePhotoUrl(rawPartnerPhoto);

      const userReactionObj = mReactions.find((r: any) => r.user_id === currentUserId);
      const partnerReactionObj = mReactions.find((r: any) => r.user_id !== currentUserId);

      const photosList: MomentPhoto[] = mPhotos
        .filter((p: any) => {
          const u = p.storage_path || p.image_url;
          return u && typeof u === 'string' && !u.startsWith('blob:');
        })
        .map((p: any) => ({
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
   * Fetch complete history for the pair with in-memory caching and in-flight request deduplication
   */
  async fetchHistory(pairId?: string, forceRefresh: boolean = false): Promise<HistoryDay[]> {
    const targetPairId = pairId || this.currentPairId;
    if (!targetPairId || !supabaseConfig.isConfigured) {
      return [];
    }

    if (!forceRefresh) {
      const cached = this.historyCache.get(targetPairId);
      if (cached && Date.now() - cached.timestamp < 60000) {
        return cached.data;
      }
      const existingInflight = this.historyInflight.get(targetPairId);
      if (existingInflight) {
        return existingInflight;
      }
    }

    const fetchPromise = (async () => {
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
          this.historyCache.set(targetPairId, { data: [], timestamp: Date.now() });
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

          const uPhotoObj = pPhotos.find((p) => p.user_id === userId);
          const partPhotoObj = pPhotos.find((p) => p.user_id !== userId);

          const sanitizeHistUrl = (u: string | null | undefined): string | null => {
            if (!u || typeof u !== 'string' || u.startsWith('blob:')) return null;
            return u;
          };

          const uPhoto = sanitizeHistUrl(uPhotoObj?.storage_path || uPhotoObj?.image_url);
          const partPhoto = sanitizeHistUrl(partPhotoObj?.storage_path || partPhotoObj?.image_url);

          const isDateMoment = Boolean(
            (typeof pm.id === 'string' && pm.id.startsWith('date-')) ||
            (typeof pm.prompt === 'string' && pm.prompt.startsWith('Свидание')) ||
            pm.is_date === true
          );
          const isMatched = Boolean(uPhoto && partPhoto && pReactions.length > 0);
          const validPhotos = pPhotos.filter((p) => {
            const url = p.storage_path || p.image_url;
            return url && typeof url === 'string' && !url.startsWith('blob:');
          });

          if (isMatched || (isDateMoment && validPhotos.length > 0)) {
            const order = isDateMoment ? 1 : (((idx % 3) + 1) as 1 | 2 | 3);
            const uReact = pReactions.find((r) => r.user_id === userId)?.reaction || null;
            const pReact = pReactions.find((r) => r.user_id !== userId)?.reaction || null;
            const fallbackPhoto = validPhotos[0]?.storage_path || validPhotos[0]?.image_url || null;

            const hMoment: Moment = {
              id: pm.id,
              pairId: targetPairId,
              createdBy: pm.creator_user_id || userId,
              createdAt: pm.created_at,
              dateKey: dKey,
              imageUrl: uPhoto || partPhoto || fallbackPhoto,
              caption: null,
              order,
              label: isDateMoment ? 'СВИДАНИЕ' : `МОМЕНТ ${order}`,
              prompt: pm.prompt,
              subtext: isDateMoment ? 'Воспоминание свидания' : '',
              status: 'COMPLETED',
              themeColor: isDateMoment ? 'pink' : order === 1 ? 'pink' : order === 2 ? 'peach' : 'blue',
              userPhoto: uPhoto,
              partnerPhoto: partPhoto,
              photos: validPhotos.map((p) => ({
                userId: p.user_id,
                imageUrl: p.storage_path || p.image_url,
                createdAt: p.created_at,
              })),
              userReaction: (uReact === '✨' ? null : uReact) as ReactionEmoji | null,
              partnerReaction: (pReact === '✨' ? null : pReact) as ReactionEmoji | null,
              completedAt: pm.created_at,
              isDate: isDateMoment,
            };

            const list = dayMap.get(dKey) || [];
            list.push(hMoment);
            dayMap.set(dKey, list);
          }
        });

        // Merge offline / locally persisted date moments if any
        try {
          const rawLocalDates = appStorage.getItem(`ours_local_date_moments_${targetPairId}`);
          if (typeof rawLocalDates === 'string' && rawLocalDates) {
            const localMoments: Moment[] = JSON.parse(rawLocalDates);
            if (Array.isArray(localMoments)) {
              localMoments.forEach((lm) => {
                const dKey = lm.dateKey || todayKey;
                const existingList = dayMap.get(dKey) || [];
                if (!existingList.some((m) => m.id === lm.id)) {
                  existingList.push(lm);
                  dayMap.set(dKey, existingList);
                }
              });
            }
          }
        } catch {}

        // Persist all authentic star events into the independent accumulative star registry
        const starEventsToRecord: StarEvent[] = [];
        for (const [dKey, dayMoments] of dayMap.entries()) {
          const hasMatch = dayMoments.some((m) => !m.isDate && isMomentMatched(m));
          if (hasMatch) {
            starEventsToRecord.push({
              id: `match_${dKey}`,
              dateKey: dKey,
              starType: 'moment',
              title: 'Касание',
            });
          }
          for (const m of dayMoments) {
            if (m.isDate) {
              starEventsToRecord.push({
                id: `date_${m.id || dKey}`,
                dateKey: dKey,
                starType: 'date',
                momentId: m.id,
                title: m.prompt || 'Свидание',
                createdAt: m.createdAt,
              });
            }
          }
        }
        if (starEventsToRecord.length > 0) {
          recordAccumulatedStarRecords(targetPairId, starEventsToRecord);
        }
        const matchedHistoryDates = Array.from(dayMap.keys()).filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(k));
        if (matchedHistoryDates.length > 0) {
          recordAccumulatedStarDates(targetPairId, matchedHistoryDates);
        }

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

            // Sort moments: regular daily moments by order (1, 2, 3), followed by date moments
            const sortedMoments = [...dayMoments].sort((a, b) => {
              if (a.isDate && !b.isDate) return 1;
              if (!a.isDate && b.isDate) return -1;
              return a.order - b.order;
            });

            // For Free users, omit high-res photo URLs on locked older days to enforce privacy & data limitation on wire
            const sanitizedMoments = isLocked
              ? sortedMoments.map((m) => ({
                  ...m,
                  imageUrl: null,
                  userPhoto: null,
                  partnerPhoto: null,
                  photos: [],
                }))
              : sortedMoments;

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
      } finally {
        this.historyInflight.delete(targetPairId);
      }
    })();

    this.historyInflight.set(targetPairId, fetchPromise);
    return fetchPromise;
  }

  /**
   * Initializes or restores Supabase user session and pair state (non-blocking offline-safe)
   */
  async initSession(): Promise<SessionResponse> {
    syncServerClock().catch(() => {});

    let userId: string;
    try {
      userId = await this.ensureAuthenticatedUser();
    } catch (authErr: any) {
      console.warn('[OURS Session] Auth unavailable (offline or network timeout):', authErr?.message || authErr);
      return {
        success: false,
        user: {
          id: this.currentUserId || '',
          displayName: '',
          avatarUrl: null,
          avatarColor: '#F6DCE1',
          currentPairId: this.currentPairId || null,
          createdAt: new Date().toISOString(),
        },
        token: this.currentUserId || '',
        isNewUser: false,
        hasCompletedOnboarding: false,
        pair: null,
        moments: [],
        history: [],
        error: 'Network unavailable',
      };
    }

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
    this.invalidateHistoryCache(pairId);

    const assembled = await this.assemblePairData(pairId, userId);

    if (assembled.pair.partner.name && assembled.pair.partner.name !== 'Партнёр') {
      this.cachedPartnerNames.set(pairId, assembled.pair.partner.name);
    }

    return {
      success: true,
      pair: assembled.pair,
      moments: assembled.moments,
      history: assembled.history,
    };
  }

  /**
   * Get current user's personal code from Supabase RPC get_my_personal_code
   */
  async getMyPersonalCode(): Promise<{ personalCode: string | null; error: string | null }> {
    console.log('[OURS PersonalCode] load started');
    try {
      // Check current Supabase session and user ID
      const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
      const sessionUser = sessionData?.session?.user;
      const sessionUserId = sessionUser?.id || null;
      const currentUserId = this.currentUserId;

      console.log('[OURS PersonalCode] session check:', {
        hasSession: Boolean(sessionData?.session),
        sessionUserId,
        apiClientUserId: currentUserId,
        isMatch: Boolean(sessionUserId && sessionUserId === currentUserId),
        sessionError: sessionErr?.message || null,
      });

      // Ensure user is authenticated if session is missing
      if (!sessionUserId) {
        await this.ensureAuthenticatedUser();
      }

      console.log('[OURS PersonalCode] before RPC');
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_my_personal_code');
      console.log('[OURS PersonalCode] after RPC');
      console.log('[OURS PersonalCode] data:', rpcData);
      console.log('[OURS PersonalCode] error:', rpcError);

      if (rpcError) {
        return {
          personalCode: null,
          error: rpcError.message || 'Ошибка RPC get_my_personal_code',
        };
      }

      const cleanCode = typeof rpcData === 'string'
        ? rpcData
        : (rpcData as any)?.personal_code || null;

      return {
        personalCode: cleanCode,
        error: cleanCode ? null : 'Личный код не найден',
      };
    } catch (err: any) {
      console.error('[OURS PersonalCode] error:', err);
      return {
        personalCode: null,
        error: err?.message || 'Непредвиденная ошибка при получении кода',
      };
    } finally {
      console.log('[OURS PersonalCode] load finished');
    }
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

    if (!storageUrl || storageUrl.startsWith('blob:')) {
      console.warn('[OURS uploadPhoto] Aborting: storageUrl is invalid or local blob URL:', storageUrl);
      return { success: false };
    }

    // 2. Upsert photo metadata into public.photos with correct column storage_path
    const { error: upsertErr } = await supabase.from('photos').upsert(
      {
        moment_id: momentId,
        user_id: userId,
        storage_path: storageUrl,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'moment_id,user_id' }
    );

    if (upsertErr) {
      console.error('[OURS uploadPhoto] Failed to save photo to public.photos:', upsertErr);
      return { success: false };
    }

    // Instant Realtime broadcast across pair channel
    this.broadcastPairUpdate(pairId, { action: 'photo_uploaded', momentId, userId });
    this.invalidateHistoryCache(pairId);

    try {
      const { data: mPhotos } = await supabase
        .from('photos')
        .select('storage_path, image_url, user_id, created_at')
        .eq('moment_id', momentId);

      const partnerPhotoObj = mPhotos?.find((p: any) => p.user_id !== userId);
      const rawPartnerUrl = partnerPhotoObj?.storage_path || partnerPhotoObj?.image_url || null;
      const partnerPhotoUrl = (rawPartnerUrl && !rawPartnerUrl.startsWith('blob:')) ? rawPartnerUrl : null;

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
   * Fetch photos for a specific date moment (by momentId = date-{invitation.id})
   */
  async fetchDatePhotos(momentId: string): Promise<MomentPhoto[]> {
    if (!momentId) return [];

    let cachedList: MomentPhoto[] = [];
    try {
      const stored = appStorage.getItem(`ours_date_photos_${momentId}`);
      if (typeof stored === 'string' && stored) {
        cachedList = JSON.parse(stored);
      }
    } catch {}

    if (supabaseConfig.isConfigured) {
      try {
        const { data: dbPhotos } = await supabase
          .from('photos')
          .select('storage_path, image_url, user_id, created_at')
          .eq('moment_id', momentId)
          .order('created_at', { ascending: true });

        if (Array.isArray(dbPhotos) && dbPhotos.length > 0) {
          const mapped: MomentPhoto[] = dbPhotos
            .filter((p: any) => {
              const url = p.storage_path || p.image_url;
              return url && typeof url === 'string' && !url.startsWith('blob:');
            })
            .map((p: any) => ({
              userId: p.user_id,
              imageUrl: p.storage_path || p.image_url,
              createdAt: p.created_at,
            }));

          try {
            appStorage.setItem(`ours_date_photos_${momentId}`, JSON.stringify(mapped));
          } catch {}

          return mapped;
        }
      } catch (err) {
        console.warn('[OURS Date] Error fetching date photos from Supabase:', err);
      }
    }

    return cachedList;
  }

  /**
   * Upload Photo for an accepted Date Invitation:
   * 1. Creates/ensures historic moment in public.moments with id = date-{invitation.id}
   * 2. Uploads photo via photoStorageService.uploadMomentPhoto()
   * 3. Upserts photo record into public.photos linked to moment_id
   * 4. Enforces max 1 photo per user for this date moment (max 2 total for pair)
   * 5. Grants 1 persistent star into the sky for this date
   * 6. Realtime broadcasts across pair channel and invalidates history cache
   */
  async uploadDatePhoto(params: {
    momentId: string;
    photoData: string;
    pairId?: string;
    dateTitle?: string;
    dateDescription?: string;
    overrideUserId?: string;
  }): Promise<{ success: boolean; photos: MomentPhoto[]; momentId: string; photoUrl: string }> {
    const { momentId, photoData, dateTitle, dateDescription, overrideUserId } = params;
    let userId = overrideUserId;
    if (!userId) {
      try {
        userId = await this.ensureAuthenticatedUser();
      } catch {
        userId = this.currentUserId || 'user';
      }
    }

    let pairId = (params.pairId || this.currentPairId || '').trim();
    if (!pairId) {
      try {
        const { data: membership } = await supabase
          .from('pair_members')
          .select('pair_id')
          .eq('user_id', userId)
          .order('joined_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (membership?.pair_id) {
          pairId = membership.pair_id;
          this.currentPairId = membership.pair_id;
        }
      } catch {}
    }

    if (!pairId) {
      pairId = this.currentPairId || 'pair';
    } else {
      this.currentPairId = pairId;
    }

    const todayKey = getLocalDateKey();

    // 1. Upload photo through photoStorageService
    const storageUrl = await photoStorageService.uploadMomentPhoto(
      pairId,
      momentId,
      userId,
      photoData
    );

    if (!storageUrl || storageUrl.startsWith('blob:')) {
      console.warn('[OURS uploadDatePhoto] Aborting: storageUrl is invalid or local blob URL:', storageUrl);
      return { success: false, photos: [], momentId, photoUrl: '' };
    }

    // 2. Ensure moment row exists in public.moments
    if (supabaseConfig.isConfigured) {
      try {
        await supabase.from('moments').upsert(
          {
            id: momentId,
            pair_id: pairId,
            moment_date: todayKey,
            prompt: dateTitle ? `Свидание: ${dateTitle}` : 'Свидание',
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (err) {
        console.warn('[OURS Date] Could not upsert moments row:', err);
      }
    }

    // 3. Upsert photo metadata into public.photos (enforces max 1 per user on conflict)
    if (supabaseConfig.isConfigured) {
      try {
        const { error: photoUpsertErr } = await supabase.from('photos').upsert(
          {
            moment_id: momentId,
            user_id: userId,
            storage_path: storageUrl,
            image_url: storageUrl,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'moment_id,user_id' }
        );

        if (photoUpsertErr) {
          console.error('[OURS Date] Failed to upsert photos row:', photoUpsertErr);
          return { success: false, photos: [], momentId, photoUrl: '' };
        }
      } catch (err) {
        console.warn('[OURS Date] Could not upsert photos row:', err);
        return { success: false, photos: [], momentId, photoUrl: '' };
      }
    }

    // 4. Update local storage cache for instant UI feedback
    let updatedPhotos: MomentPhoto[] = [];
    try {
      const stored = appStorage.getItem(`ours_date_photos_${momentId}`);
      const list: MomentPhoto[] = typeof stored === 'string' && stored ? JSON.parse(stored) : [];
      const filtered = list.filter((p) => p.userId !== userId);
      filtered.push({
        userId,
        imageUrl: storageUrl,
        createdAt: new Date().toISOString(),
      });
      updatedPhotos = filtered.slice(0, 2);
      appStorage.setItem(`ours_date_photos_${momentId}`, JSON.stringify(updatedPhotos));
    } catch {
      updatedPhotos = [{ userId, imageUrl: storageUrl, createdAt: new Date().toISOString() }];
    }

    // 5. Update local history cache for this pair
    try {
      const rawLocalDates = appStorage.getItem(`ours_local_date_moments_${pairId}`);
      const localMoments: Moment[] = typeof rawLocalDates === 'string' && rawLocalDates ? JSON.parse(rawLocalDates) : [];
      const existingIdx = localMoments.findIndex((m) => m.id === momentId);
      const newMoment: Moment = {
        id: momentId,
        pairId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
        dateKey: todayKey,
        imageUrl: storageUrl,
        caption: null,
        order: 1,
        label: 'СВИДАНИЕ',
        prompt: dateTitle ? `Свидание: ${dateTitle}` : 'Свидание',
        subtext: dateDescription || 'Воспоминание свидания',
        status: 'COMPLETED',
        themeColor: 'pink',
        userPhoto: storageUrl,
        partnerPhoto: updatedPhotos.find((p) => p.userId !== userId)?.imageUrl || null,
        photos: updatedPhotos,
        userReaction: null,
        partnerReaction: null,
        completedAt: new Date().toISOString(),
        isDate: true,
      };

      if (existingIdx >= 0) {
        localMoments[existingIdx] = {
          ...localMoments[existingIdx],
          ...newMoment,
          photos: updatedPhotos,
        };
      } else {
        localMoments.push(newMoment);
      }
      appStorage.setItem(`ours_local_date_moments_${pairId}`, JSON.stringify(localMoments));
    } catch {}

    // 6. Monotonically record Big Star ✨ in sky registry for this pair
    try {
      recordAccumulatedStarRecords(pairId, [
        {
          id: `date_${momentId}`,
          dateKey: todayKey,
          starType: 'date',
          momentId,
          title: dateTitle || 'Свидание',
          createdAt: new Date().toISOString(),
        },
      ]);
      recordAccumulatedStarDates(pairId, [todayKey]);
    } catch {}

    // 7. Broadcast Realtime across pair channel and invalidate caches
    this.broadcastPairUpdate(pairId, { action: 'date_photo_uploaded', momentId, userId, pairId });
    this.invalidateHistoryCache(pairId);

    // 8. If Supabase configured, re-fetch authoritative photos list
    if (supabaseConfig.isConfigured) {
      try {
        const { data: dbPhotos } = await supabase
          .from('photos')
          .select('storage_path, image_url, user_id, created_at')
          .eq('moment_id', momentId)
          .order('created_at', { ascending: true });

        if (Array.isArray(dbPhotos) && dbPhotos.length > 0) {
          updatedPhotos = dbPhotos.map((p: any) => ({
            userId: p.user_id,
            imageUrl: p.storage_path || p.image_url,
            createdAt: p.created_at,
          }));
          appStorage.setItem(`ours_date_photos_${momentId}`, JSON.stringify(updatedPhotos));
        }
      } catch {}
    }

    return {
      success: true,
      photos: updatedPhotos,
      momentId,
      photoUrl: storageUrl,
    };
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
      const baseUrl = this.getApiBaseUrl();
      const session = (await supabase.auth.getSession()).data?.session;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      const res = await fetch(`${baseUrl}/api/yookassa/create-payment`, {
        method: 'POST',
        headers,
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
      const baseUrl = this.getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/yookassa/check-status/${encodeURIComponent(paymentId)}`);
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
   * Fetch active date invitation for pair from persistent Supabase database
   */
  async fetchDateInvitation(pairId: string): Promise<any> {
    if (!pairId) return null;
    const cleanPairId = pairId.trim();

    // 1. Primary: Direct query to Supabase date_invitations table with Pair Isolation RLS
    try {
      const { data, error } = await supabase
        .from('date_invitations')
        .select('*')
        .eq('pair_id', cleanPairId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          pairId: data.pair_id,
          senderUserId: data.creator_user_id,
          senderName: data.sender_name,
          recipientUserId: data.recipient_user_id,
          recipientName: data.recipient_name,
          idea: data.idea,
          status: data.status,
          readByRecipient: data.read_by_recipient,
          createdAt: data.created_at,
          respondedAt: data.responded_at,
        };
      }
    } catch {
      // Fall through to moments table fallback
    }

    // 2. Compatibility fallback: moments table in Supabase (moment_date = '1970-01-01')
    try {
      const { data: dbMoments, error } = await supabase
        .from('moments')
        .select('*')
        .eq('pair_id', cleanPairId)
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
              return { ...parsed, pairId: cleanPairId, dbMomentId: row.id };
            }
          } catch (e) {
            console.warn('[OURS Date] JSON parse error from Supabase moment:', e);
          }
        }
      }
    } catch (dbErr) {
      // silent catch
    }

    return null;
  }

  /**
   * Send a new date invitation, persist to Supabase database, and broadcast realtime to partner
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

    const userId = await this.ensureAuthenticatedUser();
    const cleanPairId = payload.pairId.trim();
    const invId = payload.id || `inv-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const invitationData = {
      id: invId,
      pairId: cleanPairId,
      senderUserId: userId,
      senderName: payload.senderName || 'Ты',
      recipientUserId: payload.recipientUserId || '',
      recipientName: payload.recipientName || 'Партнёр',
      idea: payload.idea,
      status: 'pending',
      readByRecipient: false,
      createdAt: nowIso,
    };

    let savedToTable = false;

    // 1. Persist directly to Supabase date_invitations table
    try {
      const { error } = await supabase
        .from('date_invitations')
        .insert({
          id: invId,
          pair_id: cleanPairId,
          creator_user_id: userId,
          sender_name: invitationData.senderName,
          recipient_user_id: invitationData.recipientUserId || null,
          recipient_name: invitationData.recipientName,
          idea: invitationData.idea,
          status: 'pending',
          read_by_recipient: false,
          created_at: nowIso,
          updated_at: nowIso,
        });

      if (!error) {
        savedToTable = true;
      }
    } catch {
      savedToTable = false;
    }

    // 2. Compatibility fallback: Supabase moments table
    if (!savedToTable) {
      try {
        await supabase
          .from('moments')
          .delete()
          .eq('pair_id', cleanPairId)
          .eq('moment_date', '1970-01-01');

        await supabase.from('moments').insert({
          pair_id: cleanPairId,
          moment_date: '1970-01-01',
          prompt: `DATE_INVITATION:${JSON.stringify(invitationData)}`,
        });
      } catch (dbErr) {
        console.warn('[OURS Date] Error saving invitation to Supabase fallback:', dbErr);
      }
    }

    // 3. Broadcast instant Realtime notification to partner
    this.broadcastPairUpdate(cleanPairId, {
      action: 'date_invitation_created',
      invitation: invitationData,
    });

    return invitationData;
  }

  /**
   * Mark date invitation as read by recipient in Supabase
   */
  async markDateInvitationAsRead(pairId: string): Promise<any> {
    if (!pairId) return null;
    const cleanPairId = pairId.trim();

    // 1. Update in date_invitations table
    try {
      await supabase
        .from('date_invitations')
        .update({ read_by_recipient: true, updated_at: new Date().toISOString() })
        .eq('pair_id', cleanPairId);
    } catch {}

    // 2. Update in moments table fallback
    try {
      const { data: rows } = await supabase
        .from('moments')
        .select('*')
        .eq('pair_id', cleanPairId)
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
      // Best-effort
    }

    // 3. Broadcast Realtime
    this.broadcastPairUpdate(cleanPairId, { action: 'date_invitation_read' });
    return true;
  }

  /**
   * Respond to date invitation (accepted / declined) in Supabase
   */
  async respondToDateInvitation(pairId: string, status: 'accepted' | 'declined'): Promise<any> {
    if (!pairId || (status !== 'accepted' && status !== 'declined')) return null;
    const cleanPairId = pairId.trim();
    const respondedAt = new Date().toISOString();
    let updatedInvitation: any = null;

    // 1. Update in Supabase date_invitations table
    try {
      const { data, error } = await supabase
        .from('date_invitations')
        .update({
          status,
          read_by_recipient: true,
          responded_at: respondedAt,
          updated_at: respondedAt,
        })
        .eq('pair_id', cleanPairId)
        .select('*')
        .maybeSingle();

      if (!error && data) {
        updatedInvitation = {
          id: data.id,
          pairId: data.pair_id,
          senderUserId: data.creator_user_id,
          senderName: data.sender_name,
          recipientUserId: data.recipient_user_id,
          recipientName: data.recipient_name,
          idea: data.idea,
          status: data.status,
          readByRecipient: data.read_by_recipient,
          createdAt: data.created_at,
          respondedAt: data.responded_at,
        };
      }
    } catch {}

    // 2. Update in moments table fallback
    try {
      const { data: rows } = await supabase
        .from('moments')
        .select('*')
        .eq('pair_id', cleanPairId)
        .eq('moment_date', '1970-01-01')
        .order('created_at', { ascending: false })
        .limit(1);

      if (rows && rows.length > 0) {
        const row = rows[0];
        if (row.prompt && row.prompt.startsWith('DATE_INVITATION:')) {
          const parsed = JSON.parse(row.prompt.replace('DATE_INVITATION:', ''));
          parsed.status = status;
          parsed.readByRecipient = true;
          parsed.respondedAt = respondedAt;
          if (!updatedInvitation) {
            updatedInvitation = parsed;
          }

          await supabase
            .from('moments')
            .update({
              prompt: `DATE_INVITATION:${JSON.stringify(parsed)}`,
            })
            .eq('id', row.id);
        }
      }
    } catch (dbErr) {
      // Best-effort
    }

    // 3. Broadcast Realtime
    this.broadcastPairUpdate(cleanPairId, {
      action: 'date_invitation_responded',
      status,
      invitation: updatedInvitation,
    });

    return updatedInvitation;
  }

  /**
   * Clear date invitation for pair in Supabase
   */
  async clearDateInvitation(pairId: string): Promise<boolean> {
    if (!pairId) return false;
    const cleanPairId = pairId.trim();

    // 1. Delete from date_invitations table
    try {
      await supabase
        .from('date_invitations')
        .delete()
        .eq('pair_id', cleanPairId);
    } catch {}

    // 2. Delete from moments table fallback
    try {
      await supabase
        .from('moments')
        .delete()
        .eq('pair_id', cleanPairId)
        .eq('moment_date', '1970-01-01');
    } catch (dbErr) {
      // Best-effort
    }

    // 3. Broadcast Realtime
    this.broadcastPairUpdate(cleanPairId, { action: 'date_invitation_cleared' });
    return true;
  }
}

export const apiClient = new ApiClient();

if (typeof window !== 'undefined') {
  (window as any).apiClient = apiClient;
}
