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
  replaceServerStarRecords,
  extractStarDateKey,
  StarEvent,
  isMomentMatched,
} from '../sky/skyService';
import { bootDiagnostics } from '../device/bootDiagnostics';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

export interface ParsedCompositeDailyMomentId {
  pairId?: string;
  dateKey: string;
  order: 1 | 2 | 3;
  slot: 1 | 2 | 3;
}

export function isValidCalendarDateKey(dateKey: unknown): dateKey is string {
  if (typeof dateKey !== 'string') return false;
  const trimmed = dateKey.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false;
  if (trimmed === '1970-01-01') return false;
  const [yStr, mStr, dStr] = trimmed.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (year < 2020 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

export function parseCompositeDailyMomentId(
  momentId: string,
  fallbackPairId?: string
): ParsedCompositeDailyMomentId | null {
  if (!momentId || typeof momentId !== 'string') return null;
  const trimmed = momentId.trim();
  if (trimmed.startsWith('date-') || trimmed.startsWith('date_')) {
    return null;
  }

  const cleanFallbackPairId = isValidUuid(fallbackPairId) ? fallbackPairId.trim() : undefined;

  // Format 1: moment_<pairId>_<YYYY-MM-DD>_<order> or moment-<pairId>-<YYYY-MM-DD>-<order>
  const withPairMatch = trimmed.match(/^moment[_-](.+)[_-](\d{4}-\d{2}-\d{2})[_-]([123])$/i);
  if (withPairMatch) {
    const [, rawPairId, dateKey, rawOrder] = withPairMatch;
    if (!isValidUuid(rawPairId) || !isValidCalendarDateKey(dateKey)) {
      return null;
    }
    const cleanPairId = rawPairId.trim();
    if (cleanFallbackPairId && cleanPairId.toLowerCase() !== cleanFallbackPairId.toLowerCase()) {
      return null;
    }
    const order = Number(rawOrder) as 1 | 2 | 3;
    return {
      pairId: cleanPairId,
      dateKey,
      order,
      slot: order,
    };
  }

  // Format 2: moment_<YYYY-MM-DD>_<order> or moment-<YYYY-MM-DD>-<order>
  const dateOnlyMatch = trimmed.match(/^moment[_-](\d{4}-\d{2}-\d{2})[_-]([123])$/i);
  if (dateOnlyMatch) {
    const [, dateKey, rawOrder] = dateOnlyMatch;
    if (!isValidCalendarDateKey(dateKey)) {
      return null;
    }
    const order = Number(rawOrder) as 1 | 2 | 3;
    return {
      pairId: cleanFallbackPairId,
      dateKey,
      order,
      slot: order,
    };
  }

  // Format 3: moment-today-<order> or moment_today_<order>
  const todayMatch = trimmed.match(/^moment[_-]today[_-]([123])$/i);
  if (todayMatch) {
    const dateKey = getLocalDateKey();
    if (!isValidCalendarDateKey(dateKey)) {
      return null;
    }
    const order = Number(todayMatch[1]) as 1 | 2 | 3;
    return {
      pairId: cleanFallbackPairId,
      dateKey,
      order,
      slot: order,
    };
  }

  return null;
}

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
        bootDiagnostics.logStage('AUTH_READY', 'Supabase anonymous user authenticated');
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

    // Calculate calendar days together (creation day is day 1 together)
    let daysTogether = 1;
    try {
      const createdDate = new Date(createdAt);
      if (!isNaN(createdDate.getTime())) {
        const now = new Date();
        const startMidnight = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
        const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffDays = Math.round((todayMidnight.getTime() - startMidnight.getTime()) / (1000 * 60 * 60 * 24));
        daysTogether = Math.max(1, diffDays + 1);
      }
    } catch {
      daysTogether = 1;
    }

    const memberList = membersRes.data || [];
    const memberUserIds = memberList.map((m: any) => m.user_id).filter(Boolean);

    let rawMoments = momentsRes.data || [];

    // Check which daily slots (1, 2, 3) already exist in public.moments for today
    const existingSlots = new Set<1 | 2 | 3>(
      (rawMoments || [])
        .map((m: any) => m?.slot)
        .filter((s: any): s is 1 | 2 | 3 => s === 1 || s === 2 || s === 3)
    );
    const missingSlots = ([1, 2, 3] as const).filter((slot) => !existingSlots.has(slot));

    // Idempotently create missing daily slots (1, 2, 3) via upsert on (pair_id, moment_date, slot).
    // Does not send `id` or `created_at` so existing moment rows are never overwritten with new UUIDs/timestamps.
    if (missingSlots.length > 0 && isValidUuid(pairId)) {
      const slotsToUpsert = missingSlots.map((slot) => {
        const promptInfo = getPromptForPairMoment(pairId, todayKey, slot);
        return {
          pair_id: pairId,
          moment_date: todayKey,
          slot,
          prompt: promptInfo.prompt,
        };
      });

      try {
        const { data: upsertedRows, error: upsertErr } = await supabase
          .from('moments')
          .upsert(slotsToUpsert, { onConflict: 'pair_id,moment_date,slot' })
          .select('*');

        if (!upsertErr && Array.isArray(upsertedRows) && upsertedRows.length > 0) {
          const mergedById = new Map<string, any>();
          for (const m of rawMoments) {
            if (m?.id) mergedById.set(m.id, m);
          }
          for (const m of upsertedRows) {
            if (m?.id) mergedById.set(m.id, m);
          }
          rawMoments = Array.from(mergedById.values());
        } else if (upsertErr) {
          console.warn('[OURS Moments] Failed to upsert daily moment slots:', upsertErr.message || upsertErr);
        }
      } catch (err) {
        console.warn('[OURS Moments] Exception upserting daily moment slots:', err);
      }
    }

    // Fallback if offline/uninitialized
    if (!rawMoments || rawMoments.length === 0) {
      rawMoments = ([1, 2, 3] as const).map((slot) => {
        const promptInfo = getPromptForPairMoment(pairId, todayKey, slot);
        return {
          id: `moment_${pairId}_${todayKey}_${slot}`,
          pair_id: pairId,
          moment_date: todayKey,
          slot,
          prompt: promptInfo.prompt,
          created_at: new Date().toISOString(),
        };
      });
    }

    const slottedMomentIds = (rawMoments || [])
      .filter((m: any) => isValidUuid(m?.id) && (m?.slot === 1 || m?.slot === 2 || m?.slot === 3))
      .map((m: any) => m.id);
    const todayMomentIds = Array.from(new Set(slottedMomentIds));

    // 2. Parallel fetch of member profiles, today's photos, and today's reactions
    // ONLY valid UUIDs of slotted daily moments are passed to .in('moment_id', ...) to prevent 22P02 errors and legacy NULL-slot cross-contamination.
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
      createdAt,
      isLovely,
      lovelyPurchasedAt,
      subscription,
    };

    const allPhotos = photosRes.data || [];
    const allReactions = reactionsRes.data || [];

    // 3. Assemble formatted Moment objects for today (strictly 3 moments: slot = 1, 2, 3)
    // Enforces 1-to-1 slot matching via `dbM.slot === slot` and ensures one UUID is never assigned to two slots.
    const assignedSlotUuids = new Set<string>();

    const assembledMoments: Moment[] = ([1, 2, 3] as const).map((order) => {
      const slot = order;
      const promptInfo = getPromptForPairMoment(pairId, todayKey, slot);
      const localCompositeId = `moment_${pairId}_${todayKey}_${slot}`;

      // Match strictly by explicit slot (1, 2, 3) or exact local composite ID for this slot.
      // Never matches by non-unique prompt, never guesses by array index, and never maps slot IS NULL rows.
      const matchingRows = (rawMoments || []).filter((dbM: any) => {
        if (!dbM || dbM.prompt === 'OUR_DAY' || String(dbM.prompt || '').startsWith('DATE_INVITATION:')) return false;
        if (dbM.slot === slot) {
          if (isValidUuid(dbM.id) && assignedSlotUuids.has(dbM.id)) {
            return false;
          }
          return true;
        }
        return (
          dbM.id === localCompositeId ||
          dbM.id === `moment-${pairId}-${todayKey}-${slot}`
        );
      });

      // Prefer the row for this slot that already has photos, or the first matching row for this slot
      const preferredRowWithPhotos = matchingRows.find((r: any) =>
        allPhotos.some((p: any) => p.moment_id === r.id)
      );
      const canonicalDbRow = preferredRowWithPhotos || matchingRows[0] || null;
      const candidateUuid = canonicalDbRow?.id;
      const canonicalId =
        candidateUuid && (!isValidUuid(candidateUuid) || !assignedSlotUuids.has(candidateUuid))
          ? candidateUuid
          : localCompositeId;

      if (isValidUuid(canonicalId)) {
        assignedSlotUuids.add(canonicalId);
      }

      const candidateIds = matchingRows
        .map((r: any) => r.id)
        .filter((id: any) => typeof id === 'string' && (!isValidUuid(id) || id === canonicalId));

      // All candidate IDs for this specific slot
      const slotCandidateVariations = [
        localCompositeId,
        `moment-${pairId}-${todayKey}-${slot}`,
        `moment_${todayKey}_${slot}`,
        `moment-${todayKey}-${slot}`,
      ];
      const slotIds = Array.from(new Set([canonicalId, ...candidateIds, ...slotCandidateVariations].filter(Boolean)));

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
        label: 'КАСАНИЕ',
        prompt: 'Касание',
        subtext: promptInfo.subtext || '',
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
        const { data: allPairMoments, error: momentsError } = await supabase
          .from('moments')
          .select('*')
          .eq('pair_id', targetPairId)
          .order('created_at', { ascending: true });

        if (momentsError) {
          console.warn('[OURS History] Error fetching moments:', momentsError);
          return this.historyCache.get(targetPairId)?.data || [];
        }

        if (!allPairMoments || allPairMoments.length === 0) {
          replaceServerStarRecords(targetPairId, [], todayKey);
          this.historyCache.set(targetPairId, { data: [], timestamp: Date.now() });
          return [];
        }

        const allMomentIds = allPairMoments.map((m: any) => m?.id).filter(isValidUuid);

        // Fetch photos, reactions, pair plan, and date invitations in parallel
        const [photosRes, reactionsRes, pairRes, dateInvsRes] = await Promise.all([
          allMomentIds.length > 0
            ? supabase.from('photos').select('*').in('moment_id', allMomentIds)
            : Promise.resolve({ data: [], error: null }),
          allMomentIds.length > 0
            ? supabase.from('reactions').select('*').in('moment_id', allMomentIds)
            : Promise.resolve({ data: [], error: null }),
          supabase.from('pairs').select('is_lovely, subscription').eq('id', targetPairId).maybeSingle(),
          supabase.from('date_invitations').select('*').eq('pair_id', targetPairId).eq('status', 'completed'),
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

        const sanitizeHistUrl = (u: string | null | undefined): string | null => {
          if (!u || typeof u !== 'string' || u.startsWith('blob:')) return null;
          return u;
        };

        const dayMap = new Map<string, Moment[]>();
        const ourDayMomentsByDate = new Map<string, any[]>();
        const completedFallbackDateInvs: any[] = [];

        allPairMoments.forEach((pm: any, idx: number) => {
          if (!pm) return;

          if (pm.prompt === 'OUR_DAY') {
            const dKey = extractStarDateKey(pm.moment_date, pm.created_at) || todayKey;
            const list = ourDayMomentsByDate.get(dKey) || [];
            list.push(pm);
            ourDayMomentsByDate.set(dKey, list);
            return;
          }

          if (String(pm.prompt || '').startsWith('DATE_INVITATION:')) {
            try {
              const rawJson = String(pm.prompt).replace('DATE_INVITATION:', '');
              const parsed = JSON.parse(rawJson);
              if (parsed && parsed.status === 'completed' && (parsed.photoUrl || parsed.photo_url)) {
                completedFallbackDateInvs.push(parsed);
              }
            } catch {
              // ignore malformed fallback json
            }
            return;
          }

          const dKey = extractStarDateKey(pm.moment_date, pm.created_at) || todayKey;
          const pPhotos = photosByMoment.get(pm.id) || [];
          const pReactions = reactionsByMoment.get(pm.id) || [];

          const uPhotoObj = pPhotos.find((p) => p.user_id === userId);
          const partPhotoObj = pPhotos.find((p) => p.user_id !== userId);

          const uPhoto = sanitizeHistUrl(uPhotoObj?.storage_path || uPhotoObj?.image_url);
          const partPhoto = sanitizeHistUrl(partPhotoObj?.storage_path || partPhotoObj?.image_url);

          const isDateMoment = Boolean(
            (typeof pm.id === 'string' && pm.id.startsWith('date-')) ||
            (typeof pm.prompt === 'string' && pm.prompt.startsWith('Свидание')) ||
            pm.is_date === true
          );
          const validPhotos = pPhotos.filter((p) => {
            const url = p.storage_path || p.image_url;
            return url && typeof url === 'string' && !url.startsWith('blob:');
          });
          const hasBothPhotos = Boolean(uPhoto && partPhoto);
          const hasTwoDistinctPhotos =
            validPhotos.length >= 2 &&
            new Set(validPhotos.map((p) => p.user_id).filter(Boolean)).size >= 2;
          const isMatched = Boolean(hasBothPhotos || hasTwoDistinctPhotos);

          if (isMatched || (isDateMoment && validPhotos.length > 0)) {
            const explicitSlot = pm.slot === 1 || pm.slot === 2 || pm.slot === 3 ? (pm.slot as 1 | 2 | 3) : null;
            const order = isDateMoment ? 1 : (explicitSlot || (((idx % 3) + 1) as 1 | 2 | 3));
            const uReact = pReactions.find((r) => r.user_id === userId)?.reaction || null;
            const pReact = pReactions.find((r) => r.user_id !== userId)?.reaction || null;
            const fallbackPhoto = validPhotos[0]?.storage_path || validPhotos[0]?.image_url || null;

            const existingList = dayMap.get(dKey) || [];
            // Deduplicate Date moments on the same day
            if (isDateMoment && existingList.some((m) => Boolean(m.isDate))) {
              return;
            }

            const hMoment: Moment = {
              id: pm.id,
              pairId: targetPairId,
              createdBy: pm.creator_user_id || userId,
              createdAt: pm.created_at,
              dateKey: dKey,
              imageUrl: uPhoto || partPhoto || fallbackPhoto,
              caption: null,
              order,
              label: isDateMoment ? 'СВИДАНИЕ' : 'КАСАНИЕ',
              prompt: pm.prompt ? pm.prompt.replace(/\s*\d+$/, '') : 'Касание',
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

            existingList.push(hMoment);
            dayMap.set(dKey, existingList);
          }
        });

        // Track matched "Наш день" (OUR_DAY) dates (2 distinct partner photos) for stars & duoMomentsCount
        // without injecting synthetic moments into dayMap (HistoryScreen builds OUR_DAY cards from ourDayPhotos)
        const matchedOurDayDates = new Set<string>();
        for (const [dKey, ourDayRows] of ourDayMomentsByDate.entries()) {
          const latestPhotoByUser = new Map<string, any>();
          for (const row of ourDayRows) {
            const pPhotos = photosByMoment.get(row.id) || [];
            for (const p of pPhotos) {
              const url = sanitizeHistUrl(p?.storage_path || p?.image_url);
              const uid = p?.user_id;
              if (!url || !uid) continue;
              const prev = latestPhotoByUser.get(uid);
              const tNew = p.created_at ? new Date(p.created_at).getTime() : 0;
              const tOld = prev?.created_at ? new Date(prev.created_at).getTime() : 0;
              if (!prev || tNew >= tOld) {
                latestPhotoByUser.set(uid, { ...p, cleanUrl: url });
              }
            }
          }

          if (latestPhotoByUser.size >= 2) {
            matchedOurDayDates.add(dKey);
          }
        }

        // Merge date invitation photo reports from date_invitations table and DATE_INVITATION fallback rows
        const allCompletedDateInvs = [
          ...(Array.isArray(dateInvsRes.data) ? dateInvsRes.data : []),
          ...completedFallbackDateInvs,
        ];

        allCompletedDateInvs.forEach((dInv: any) => {
          const photoUrl = sanitizeHistUrl(dInv.photo_url || dInv.photoUrl);
          if (photoUrl) {
            const dateIso =
              dInv.completed_at ||
              dInv.completedAt ||
              dInv.updated_at ||
              dInv.responded_at ||
              dInv.respondedAt ||
              dInv.created_at ||
              dInv.createdAt ||
              new Date().toISOString();
            const dKey =
              extractStarDateKey(dInv.date_key || dInv.dateKey, dateIso) || todayKey;
            const dMomentId = dInv.momentId || dInv.moment_id || `date-${dInv.id}`;

            const existingList = dayMap.get(dKey) || [];
            const existingIdx = existingList.findIndex(
              (m) =>
                m.id === dMomentId ||
                Boolean(m.isDate)
            );

            if (existingIdx < 0) {
              const dateMoment: Moment = {
                id: dMomentId,
                pairId: targetPairId,
                createdBy: dInv.creator_user_id || dInv.senderUserId || userId,
                createdAt: dateIso,
                dateKey: dKey,
                imageUrl: photoUrl,
                caption: null,
                order: 1,
                label: 'СВИДАНИЕ',
                prompt: dInv.idea?.title ? `Свидание: ${dInv.idea.title}` : 'Свидание',
                subtext: dInv.idea?.description || 'Воспоминание свидания',
                status: 'COMPLETED',
                themeColor: 'pink',
                userPhoto: photoUrl,
                partnerPhoto: null,
                photos: [
                  {
                    userId: dInv.creator_user_id || dInv.senderUserId || userId,
                    imageUrl: photoUrl,
                    createdAt: dateIso,
                  },
                ],
                userReaction: null,
                partnerReaction: null,
                completedAt: dateIso,
                isDate: true,
              };
              existingList.push(dateMoment);
              dayMap.set(dKey, existingList);
            }
          }
        });

        // Merge offline / locally persisted date moments if any
        try {
          const rawLocalDates = appStorage.getItem(`ours_local_date_moments_${targetPairId}`);
          if (typeof rawLocalDates === 'string' && rawLocalDates) {
            const localMoments: Moment[] = JSON.parse(rawLocalDates);
            if (Array.isArray(localMoments)) {
              localMoments.forEach((lm) => {
                const dKey = extractStarDateKey(lm.dateKey, lm.completedAt || lm.createdAt) || todayKey;
                const existingList = dayMap.get(dKey) || [];
                const existingIdx = existingList.findIndex(
                  (m) => m.id === lm.id || (Boolean(m.isDate) && Boolean(lm.isDate))
                );
                if (existingIdx >= 0) {
                  const existingM = existingList[existingIdx];
                  const mergedPhotos = [...(existingM.photos || [])];
                  (lm.photos || []).forEach((lp) => {
                    if (lp && lp.imageUrl && !mergedPhotos.some((cp) => cp.userId === lp.userId || cp.imageUrl === lp.imageUrl)) {
                      mergedPhotos.push(lp);
                    }
                  });
                  const uP = mergedPhotos.find((p) => p.userId === userId)?.imageUrl || existingM.userPhoto || lm.userPhoto;
                  const pP = mergedPhotos.find((p) => p.userId !== userId)?.imageUrl || existingM.partnerPhoto || lm.partnerPhoto;
                  existingList[existingIdx] = {
                    ...existingM,
                    userPhoto: uP,
                    partnerPhoto: pP,
                    photos: mergedPhotos,
                    imageUrl: uP || pP || existingM.imageUrl,
                  };
                } else {
                  existingList.push({ ...lm, dateKey: dKey });
                  dayMap.set(dKey, existingList);
                }
              });
            }
          }
        } catch {}

        // Reconcile all authentic star events into the star registry (without turning date-only days into 'moment' stars)
        const starEventsToRecord: StarEvent[] = [];
        const recordedMatchDays = new Set<string>();
        for (const [dKey, dayMoments] of dayMap.entries()) {
          const hasMatch =
            dayMoments.some((m) => !m.isDate && isMomentMatched(m)) ||
            matchedOurDayDates.has(dKey);
          if (hasMatch) {
            recordedMatchDays.add(dKey);
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
                id: `date_${dKey}`,
                dateKey: dKey,
                starType: 'date',
                momentId: m.id,
                title: m.prompt || 'Свидание',
                createdAt: m.createdAt,
              });
            }
          }
        }
        for (const dKey of matchedOurDayDates) {
          if (!recordedMatchDays.has(dKey)) {
            recordedMatchDays.add(dKey);
            starEventsToRecord.push({
              id: `match_${dKey}`,
              dateKey: dKey,
              starType: 'moment',
              title: 'Касание',
            });
          }
        }
        if (!photosRes.error) {
          replaceServerStarRecords(targetPairId, starEventsToRecord, todayKey);
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

            const duoTouchesCount = sortedMoments.filter((m) => !m.isDate && isMomentMatched(m)).length;
            const duoMomentsCount = duoTouchesCount + (matchedOurDayDates.has(dKey) ? 1 : 0);
            const hasDateCompleted = sortedMoments.some((m) => Boolean(m.isDate));

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
              duoMomentsCount,
              hasDateCompleted,
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

      if (membershipRes.error) {
        console.warn('[OURS Session] Error querying pair membership:', membershipRes.error.message);
        const userSession: UserSessionData = {
          id: userId,
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          avatarColor: profile.avatarColor,
          currentPairId: this.currentPairId || null,
          createdAt: new Date().toISOString(),
        };
        return {
          success: false,
          user: userSession,
          token: userId,
          isNewUser: false,
          hasCompletedOnboarding: false,
          pair: null,
          moments: [],
          history: [],
          error: membershipRes.error.message || 'Error querying pair membership',
        };
      }

      const membership = membershipRes.data;
      const userSession: UserSessionData = {
        id: userId,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        avatarColor: profile.avatarColor,
        currentPairId: membership?.pair_id || null,
        createdAt: new Date().toISOString(),
      };

      if (membership?.pair_id) {
        this.currentPairId = membership.pair_id;
        bootDiagnostics.logStage('PAIR_RESOLVED', 'Pair membership resolved');

        // Startup fast-path: assemble today's data without blocking on full historical photos
        const assembled = await this.assemblePairData(membership.pair_id, userId, { includeHistory: false });
        bootDiagnostics.logStage('STATE_LOADED', 'Couple state and moments assembled');
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

      // Explicit server confirmation: query succeeded with zero errors, and user has no pair
      bootDiagnostics.logStage('PAIR_RESOLVED', 'No active pair membership');
      bootDiagnostics.logStage('STATE_LOADED', 'Onboarding state ready');
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
    } catch (err: any) {
      bootDiagnostics.logError('STATE_LOADED', err);
      console.warn('[OURS Session] Exception checking pair membership:', err);
      return {
        success: false,
        user: {
          id: userId,
          displayName: '',
          avatarUrl: null,
          avatarColor: '#F6DCE1',
          currentPairId: this.currentPairId || null,
          createdAt: new Date().toISOString(),
        },
        token: userId,
        isNewUser: false,
        hasCompletedOnboarding: false,
        pair: null,
        moments: [],
        history: [],
        error: err?.message || 'Exception checking pair membership',
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
   * Resolves a momentId (either an existing UUID or a composite daily moment ID moment_<pairId>_<date>_<slot>)
   * to an unambiguous canonical server UUID from public.moments with a verified `slot` (1, 2, or 3).
   *
   * Rules enforced:
   * 1. Never returns a composite string fallback. Returns { uuid: null, reason } if unresolved.
   * 2. Never resolves `date-*` / `date_*` or date moments through this daily moment mechanism.
   * 3. Never redirects legacy UUIDs with `slot IS NULL` to slot 1 automatically; returns a diagnosable error.
   * 4. Before creating a missing slot via upsert, checks for legacy ambiguous (`slot IS NULL`) rows and validates pair/date.
   */
  async resolveCanonicalMomentUuid(
    pairId: string | null | undefined,
    momentId: string
  ): Promise<{ uuid: string | null; slot?: 1 | 2 | 3; reason?: string }> {
    if (!momentId || typeof momentId !== 'string') {
      return { uuid: null, reason: 'EMPTY_MOMENT_ID' };
    }

    const trimmed = momentId.trim();
    if (trimmed.startsWith('date-') || trimmed.startsWith('date_')) {
      return { uuid: null, reason: 'DATE_MOMENT_ID_NOT_DAILY' };
    }

    if (!supabaseConfig.isConfigured) {
      return { uuid: null, reason: 'SUPABASE_NOT_CONFIGURED' };
    }

    // Case 1: Caller passed a UUID. Verify the row exists in public.moments and has an explicit slot (1, 2, or 3).
    // Never auto-redirect a legacy UUID with slot IS NULL to slot 1.
    if (isValidUuid(trimmed)) {
      try {
        const { data: momentRow, error: momentErr } = await supabase
          .from('moments')
          .select('id, pair_id, moment_date, slot, prompt, created_at')
          .eq('id', trimmed)
          .maybeSingle();

        if (momentErr) {
          return { uuid: null, reason: `MOMENT_UUID_QUERY_ERROR: ${momentErr.message}` };
        }

        if (!momentRow) {
          return { uuid: null, reason: `MOMENT_UUID_NOT_FOUND: ${trimmed}` };
        }

        const promptStr = String(momentRow.prompt || '');
        if (promptStr.startsWith('DATE_INVITATION:') || promptStr.startsWith('Свидание')) {
          return { uuid: null, reason: 'DATE_MOMENT_UUID_NOT_DAILY' };
        }

        const expectedPairId = (pairId || this.currentPairId || '').trim();
        if (isValidUuid(expectedPairId) && momentRow.pair_id !== expectedPairId) {
          return {
            uuid: null,
            reason: `MOMENT_PAIR_MISMATCH: moment belongs to pair ${momentRow.pair_id}, expected ${expectedPairId}`,
          };
        }

        if (momentRow.slot !== 1 && momentRow.slot !== 2 && momentRow.slot !== 3) {
          console.warn(
            `[OURS AmbiguousMoment] Refusing legacy moment UUID "${trimmed}" because slot is ${momentRow.slot ?? 'NULL'}. Automatic redirection to slot 1 is prohibited.`
          );
          return {
            uuid: null,
            reason: `LEGACY_MOMENT_UUID_NULL_SLOT: moment ${trimmed} has slot IS NULL and cannot be redirected automatically`,
          };
        }

        return { uuid: momentRow.id, slot: momentRow.slot };
      } catch (err: any) {
        return { uuid: null, reason: `MOMENT_UUID_VERIFY_EXCEPTION: ${err?.message || String(err)}` };
      }
    }

    // Case 2: Caller passed a composite daily moment ID (e.g. moment_<pairId>_<YYYY-MM-DD>_<slot>)
    const parsed = parseCompositeDailyMomentId(trimmed, pairId || this.currentPairId || undefined);
    if (!parsed) {
      return { uuid: null, reason: 'UNRECOGNIZED_COMPOSITE_MOMENT_ID' };
    }

    if (!isValidCalendarDateKey(parsed.dateKey)) {
      return { uuid: null, reason: `INVALID_MOMENT_DATE: ${parsed.dateKey}` };
    }

    let targetPairId = (parsed.pairId || pairId || this.currentPairId || '').trim();
    if (!isValidUuid(targetPairId)) {
      try {
        const userId = await this.ensureAuthenticatedUser();
        const { data: membership } = await supabase
          .from('pair_members')
          .select('pair_id')
          .eq('user_id', userId)
          .order('joined_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (membership?.pair_id && isValidUuid(membership.pair_id)) {
          targetPairId = membership.pair_id;
          this.currentPairId = membership.pair_id;
        }
      } catch {
        // Handled below
      }
    }

    if (!isValidUuid(targetPairId)) {
      return { uuid: null, reason: 'INVALID_PAIR_UUID' };
    }

    const slot = parsed.slot;

    try {
      const { data: dbMoments, error: momentsErr } = await supabase
        .from('moments')
        .select('id, pair_id, moment_date, slot, prompt, created_at')
        .eq('pair_id', targetPairId)
        .eq('moment_date', parsed.dateKey)
        .order('created_at', { ascending: true });

      if (momentsErr || !dbMoments) {
        return { uuid: null, reason: `MOMENTS_QUERY_ERROR: ${momentsErr?.message || 'null'}` };
      }

      const validDailyRows = dbMoments.filter(
        (m: any) =>
          isValidUuid(m?.id) &&
          !String(m?.prompt || '').startsWith('DATE_INVITATION:') &&
          !String(m?.prompt || '').startsWith('Свидание') &&
          m?.is_date !== true
      );

      // 1. Match strictly by explicit slot (1, 2, 3)
      const slotMatches = validDailyRows.filter((dbM: any) => dbM.slot === slot);
      if (slotMatches.length === 1) {
        return { uuid: slotMatches[0].id, slot };
      }
      if (slotMatches.length > 1) {
        console.warn(
          `[OURS AmbiguousMoment] Found ${slotMatches.length} duplicate rows for slot ${slot} (pair=${targetPairId}, date=${parsed.dateKey}).`
        );
        return {
          uuid: null,
          reason: `AMBIGUOUS_DUPLICATE_SLOT_ROWS: ${slotMatches.length} rows found for slot ${slot}`,
        };
      }

      // 2. Slot does not exist yet: ignore legacy rows with `slot IS NULL` (never map them to slot 1..3),
      // and proceed to create the clean slotted row (pair_id, moment_date, slot) consistently with assemblePairData.
      const legacyNullSlotRows = validDailyRows.filter(
        (dbM: any) => dbM.slot === null || dbM.slot === undefined
      );
      if (legacyNullSlotRows.length > 0) {
        console.info(
          `[OURS Moments] Ignoring ${legacyNullSlotRows.length} legacy row(s) with slot IS NULL for (pair=${targetPairId}, date=${parsed.dateKey}); creating explicit slot ${slot}.`
        );
      }

      // 3. Validate that the pair exists in public.pairs before creating the missing slot
      const { data: pairExists, error: pairErr } = await supabase
        .from('pairs')
        .select('id')
        .eq('id', targetPairId)
        .maybeSingle();

      if (pairErr || !pairExists?.id) {
        return {
          uuid: null,
          reason: `INVALID_OR_MISSING_PAIR: ${pairErr?.message || targetPairId}`,
        };
      }

      // 4. Idempotently create the missing slot via upsert on (pair_id, moment_date, slot)
      const promptInfo = getPromptForPairMoment(targetPairId, parsed.dateKey, slot);
      const { data: upsertedRow, error: upsertErr } = await supabase
        .from('moments')
        .upsert(
          {
            pair_id: targetPairId,
            moment_date: parsed.dateKey,
            slot,
            prompt: promptInfo.prompt,
          },
          { onConflict: 'pair_id,moment_date,slot' }
        )
        .select('id, slot')
        .maybeSingle();

      if (upsertErr || !upsertedRow?.id || !isValidUuid(upsertedRow.id)) {
        return {
          uuid: null,
          reason: `SLOT_UPSERT_ERROR: ${upsertErr?.message || 'No valid UUID returned'}`,
        };
      }

      return { uuid: upsertedRow.id, slot };
    } catch (err: any) {
      return { uuid: null, reason: `RESOLUTION_EXCEPTION: ${err?.message || String(err)}` };
    }
  }

  /**
   * Upload Photo for a Moment to Supabase Storage + public.photos metadata
   */
  async uploadPhoto(momentId: string, photoData: string): Promise<{ success: boolean; moment?: Moment; error?: string }> {
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

    // Always resolve & validate momentId through resolveCanonicalMomentUuid (validates both composite IDs and UUIDs, rejecting slot IS NULL)
    let targetMomentUuid: string | null = null;
    if (supabaseConfig.isConfigured) {
      const resolved = await this.resolveCanonicalMomentUuid(pairId, momentId);
      if (!resolved.uuid || !isValidUuid(resolved.uuid)) {
        console.warn(
          `[OURS uploadPhoto] Stopping DB write: momentId "${momentId}" could not be unambiguously resolved to a slotted UUID (${resolved.reason}). Photo remains in queue for retry.`
        );
        return { success: false, error: resolved.reason || 'UNRESOLVED_MOMENT_UUID' };
      }
      targetMomentUuid = resolved.uuid;
    } else if (isValidUuid(momentId)) {
      targetMomentUuid = momentId.trim();
    }

    const effectiveMomentId = targetMomentUuid || momentId;

    // 1. Upload to Supabase Storage or process as Data URI
    const storageUrl = await photoStorageService.uploadMomentPhoto(
      pairId,
      effectiveMomentId,
      userId,
      photoData
    );

    if (!storageUrl || storageUrl.startsWith('blob:')) {
      console.warn('[OURS uploadPhoto] Aborting: storageUrl is invalid or local blob URL:', storageUrl);
      return { success: false, error: 'INVALID_STORAGE_URL' };
    }

    // 2. Upsert photo metadata into public.photos using strictly validated UUID and existing schema columns
    let upsertErr: any = null;
    if (supabaseConfig.isConfigured && targetMomentUuid) {
      try {
        const { data: existingPhoto, error: selectErr } = await supabase
          .from('photos')
          .select('id')
          .eq('moment_id', targetMomentUuid)
          .eq('user_id', userId)
          .maybeSingle();

        if (selectErr) {
          upsertErr = selectErr;
        } else if (existingPhoto?.id) {
          const { error } = await supabase
            .from('photos')
            .update({
              storage_path: storageUrl,
              created_at: new Date().toISOString(),
            })
            .eq('id', existingPhoto.id);
          upsertErr = error;
        } else {
          const { error } = await supabase
            .from('photos')
            .insert({
              moment_id: targetMomentUuid,
              user_id: userId,
              storage_path: storageUrl,
              created_at: new Date().toISOString(),
            });
          upsertErr = error;
        }
      } catch (e) {
        upsertErr = e;
      }
    }

    if (upsertErr) {
      console.error('[OURS uploadPhoto] Error saving photo row:', upsertErr);
      return { success: false, error: upsertErr?.message || String(upsertErr) };
    }

    // Instant Realtime broadcast across pair channel
    this.broadcastPairUpdate(pairId, { action: 'photo_uploaded', momentId: effectiveMomentId, userId });
    this.invalidateHistoryCache(pairId);

    try {
      if (!targetMomentUuid) {
        return { success: true };
      }

      const { data: mPhotos } = await supabase
        .from('photos')
        .select('storage_path, user_id, created_at')
        .eq('moment_id', targetMomentUuid);

      const partnerPhotoObj = mPhotos?.find((p: any) => p.user_id !== userId);
      const rawPartnerUrl = partnerPhotoObj?.storage_path || null;
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
          id: targetMomentUuid,
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

    // Only query public.photos.moment_id if momentId is a valid UUID
    if (supabaseConfig.isConfigured && isValidUuid(momentId)) {
      try {
        const { data: dbPhotos } = await supabase
          .from('photos')
          .select('storage_path, user_id, created_at')
          .eq('moment_id', momentId.trim())
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
   * Preserves the independent date invitation lifecycle without creating regular daily moments
   * and without passing non-UUID strings into UUID columns.
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
    let authUserId: string | null = null;
    try {
      authUserId = await this.ensureAuthenticatedUser();
    } catch {
      authUserId = this.currentUserId || null;
    }
    const userId =
      authUserId && isValidUuid(authUserId)
        ? authUserId
        : overrideUserId && isValidUuid(overrideUserId)
          ? overrideUserId
          : authUserId || overrideUserId || this.currentUserId || 'user';

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

    // 2 & 3. Resolve or create a valid UUID row in public.moments (slot IS NULL) and save photo in public.photos
    let resolvedMomentUuid: string | null = isValidUuid(momentId) ? momentId.trim() : null;
    const datePrompt = dateTitle ? `Свидание: ${dateTitle}` : 'Свидание';
    const nowIso = new Date().toISOString();

    if (supabaseConfig.isConfigured && isValidUuid(pairId)) {
      if (!resolvedMomentUuid) {
        try {
          const { data: existingDateMoments } = await supabase
            .from('moments')
            .select('id, prompt')
            .eq('pair_id', pairId)
            .eq('moment_date', todayKey)
            .is('slot', null)
            .order('created_at', { ascending: false });

          const matchingDateRow = (existingDateMoments || []).find(
            (r: any) =>
              isValidUuid(r?.id) &&
              typeof r.prompt === 'string' &&
              r.prompt.startsWith('Свидание')
          );

          if (matchingDateRow?.id) {
            resolvedMomentUuid = matchingDateRow.id;
          } else {
            const { data: insertedDateRow } = await supabase
              .from('moments')
              .insert({
                pair_id: pairId,
                moment_date: todayKey,
                slot: null,
                prompt: datePrompt,
              })
              .select('id')
              .maybeSingle();

            if (insertedDateRow?.id && isValidUuid(insertedDateRow.id)) {
              resolvedMomentUuid = insertedDateRow.id;
            }
          }
        } catch (err) {
          console.warn('[OURS Date] Exception resolving/creating date moment UUID:', err);
        }
      } else {
        try {
          const momentRow = {
            id: resolvedMomentUuid,
            pair_id: pairId,
            moment_date: todayKey,
            slot: null,
            prompt: datePrompt,
          };

          const { error: mErr } = await supabase
            .from('moments')
            .upsert(momentRow, { onConflict: 'id', ignoreDuplicates: true });

          if (mErr) {
            await supabase.from('moments').insert(momentRow);
          }
        } catch (err) {
          console.warn('[OURS Date] Exception checking/inserting moments row:', err);
        }
      }

      if (resolvedMomentUuid && isValidUuid(resolvedMomentUuid) && isValidUuid(userId)) {
        try {
          const { data: existingPhotos } = await supabase
            .from('photos')
            .select('id')
            .eq('moment_id', resolvedMomentUuid)
            .eq('user_id', userId);

          const existingIds = Array.isArray(existingPhotos)
            ? existingPhotos.map((p: any) => p?.id).filter(Boolean)
            : [];

          const { error: insertErr } = await supabase.from('photos').insert({
            moment_id: resolvedMomentUuid,
            user_id: userId,
            storage_path: storageUrl,
            created_at: nowIso,
          });

          if (!insertErr && existingIds.length > 0) {
            await supabase
              .from('photos')
              .delete()
              .in('id', existingIds)
              .eq('user_id', userId);
          }
        } catch (err) {
          console.warn('[OURS Date] Exception saving photos row:', err);
        }
      }
    }

    // 4. Persist completed status and photo_url on date_invitations table AND DATE_INVITATION fallback in public.moments
    if (supabaseConfig.isConfigured && isValidUuid(pairId)) {
      try {
        await supabase
          .from('date_invitations')
          .update({
            status: 'completed',
            photo_url: storageUrl,
            completed_at: nowIso,
            updated_at: nowIso,
          })
          .eq('pair_id', pairId);
      } catch (err) {
        console.warn('[OURS Date] Could not update date_invitations status:', err);
      }

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
          if (row.prompt && String(row.prompt).startsWith('DATE_INVITATION:')) {
            const parsed = JSON.parse(String(row.prompt).replace('DATE_INVITATION:', ''));
            parsed.status = 'completed';
            parsed.photoUrl = storageUrl;
            parsed.completedAt = nowIso;
            parsed.dateKey = todayKey;
            parsed.momentId = momentId;
            await supabase
              .from('moments')
              .update({
                prompt: `DATE_INVITATION:${JSON.stringify(parsed)}`,
              })
              .eq('id', row.id);
          }
        }
      } catch {
        // Best-effort fallback update
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
        createdAt: nowIso,
      });
      updatedPhotos = filtered.slice(0, 2);
      appStorage.setItem(`ours_date_photos_${momentId}`, JSON.stringify(updatedPhotos));
    } catch {
      updatedPhotos = [{ userId, imageUrl: storageUrl, createdAt: nowIso }];
    }

    // 5. Update local history cache for this pair
    try {
      const rawLocalDates = appStorage.getItem(`ours_local_date_moments_${pairId}`);
      const localMoments: Moment[] = typeof rawLocalDates === 'string' && rawLocalDates ? JSON.parse(rawLocalDates) : [];
      const existingIdx = localMoments.findIndex(
        (m) => m.id === momentId || (resolvedMomentUuid && m.id === resolvedMomentUuid) || (Boolean(m.isDate) && m.dateKey === todayKey)
      );
      const newMoment: Moment = {
        id: momentId,
        pairId,
        createdBy: userId,
        createdAt: nowIso,
        dateKey: todayKey,
        imageUrl: storageUrl,
        caption: null,
        order: 1,
        label: 'СВИДАНИЕ',
        prompt: datePrompt,
        subtext: dateDescription || 'Воспоминание свидания',
        status: 'COMPLETED',
        themeColor: 'pink',
        userPhoto: storageUrl,
        partnerPhoto: updatedPhotos.find((p) => p.userId !== userId)?.imageUrl || null,
        photos: updatedPhotos,
        userReaction: null,
        partnerReaction: null,
        completedAt: nowIso,
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

    // 6. Monotonically record Big Star ✨ in sky registry for this pair using canonical date_${todayKey} ID
    try {
      recordAccumulatedStarRecords(pairId, [
        {
          id: `date_${todayKey}`,
          dateKey: todayKey,
          starType: 'date',
          momentId,
          title: dateTitle || 'Свидание',
          createdAt: nowIso,
        },
      ]);
    } catch {}

    // 7. Broadcast Realtime across pair channel and invalidate caches
    this.broadcastPairUpdate(pairId, { action: 'date_photo_uploaded', momentId, userId, pairId });
    this.invalidateHistoryCache(pairId);

    // 8. If Supabase configured and we have a valid UUID, re-fetch authoritative photos list
    const queryUuid = resolvedMomentUuid || (isValidUuid(momentId) ? momentId.trim() : null);
    if (supabaseConfig.isConfigured && queryUuid) {
      try {
        const { data: dbPhotos } = await supabase
          .from('photos')
          .select('storage_path, user_id, created_at')
          .eq('moment_id', queryUuid)
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
  async revealMoment(momentId: string): Promise<{ success: boolean; moment?: Moment; error?: string }> {
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

    let targetMomentUuid: string | null = null;
    if (supabaseConfig.isConfigured) {
      const resolved = await this.resolveCanonicalMomentUuid(this.currentPairId, momentId);
      if (!resolved.uuid || !isValidUuid(resolved.uuid)) {
        console.warn(
          `[OURS revealMoment] Stopping reactions write: momentId "${momentId}" could not be unambiguously resolved to a slotted UUID (${resolved.reason}).`
        );
        return { success: false, error: resolved.reason || 'UNRESOLVED_MOMENT_UUID' };
      }
      targetMomentUuid = resolved.uuid;
    } else if (isValidUuid(momentId)) {
      targetMomentUuid = momentId.trim();
    }

    if (supabaseConfig.isConfigured) {
      if (!targetMomentUuid) {
        return { success: false, error: 'INVALID_MOMENT_UUID' };
      }

      const { error: upsertErr } = await supabase.from('reactions').upsert(
        {
          moment_id: targetMomentUuid,
          user_id: userId,
          reaction: '✨',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'moment_id,user_id' }
      );

      if (upsertErr) {
        console.error('[OURS revealMoment] Error saving reaction row:', upsertErr);
        return { success: false, error: upsertErr.message };
      }
    }

    const effectiveMomentId = targetMomentUuid || momentId;

    // Instant Realtime broadcast across pair channel
    if (this.currentPairId) {
      this.broadcastPairUpdate(this.currentPairId, { action: 'moment_revealed', momentId: effectiveMomentId, userId });
      this.invalidateHistoryCache(this.currentPairId);
    }

    if (this.currentPairId) {
      const state = await this.assemblePairData(this.currentPairId, userId);
      const moment = state.moments.find((m) => m.id === effectiveMomentId || m.id === momentId);
      return { success: true, moment };
    }

    return { success: true };
  }

  /**
   * Submit Reaction in public.reactions
   */
  async submitReaction(momentId: string, emoji: ReactionEmoji): Promise<{ success: boolean; moment?: Moment; error?: string }> {
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

    let targetMomentUuid: string | null = null;
    if (supabaseConfig.isConfigured) {
      const resolved = await this.resolveCanonicalMomentUuid(this.currentPairId, momentId);
      if (!resolved.uuid || !isValidUuid(resolved.uuid)) {
        console.warn(
          `[OURS submitReaction] Stopping reactions write: momentId "${momentId}" could not be unambiguously resolved to a slotted UUID (${resolved.reason}).`
        );
        return { success: false, error: resolved.reason || 'UNRESOLVED_MOMENT_UUID' };
      }
      targetMomentUuid = resolved.uuid;
    } else if (isValidUuid(momentId)) {
      targetMomentUuid = momentId.trim();
    }

    if (supabaseConfig.isConfigured) {
      if (!targetMomentUuid) {
        return { success: false, error: 'INVALID_MOMENT_UUID' };
      }

      const { error: upsertErr } = await supabase.from('reactions').upsert(
        {
          moment_id: targetMomentUuid,
          user_id: userId,
          reaction: emoji,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'moment_id,user_id' }
      );

      if (upsertErr) {
        console.error('[OURS submitReaction] Error saving reaction row:', upsertErr);
        return { success: false, error: upsertErr.message };
      }
    }

    const effectiveMomentId = targetMomentUuid || momentId;

    // Instant Realtime broadcast across pair channel
    if (this.currentPairId) {
      this.broadcastPairUpdate(this.currentPairId, { action: 'reaction_submitted', momentId: effectiveMomentId, userId });
      this.invalidateHistoryCache(this.currentPairId);
    }

    if (this.currentPairId) {
      const state = await this.assemblePairData(this.currentPairId, userId);
      const moment = state.moments.find((m) => m.id === effectiveMomentId || m.id === momentId);
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
          completedAt: data.completed_at || data.completedAt,
          photoUrl: data.photo_url || data.photoUrl,
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
