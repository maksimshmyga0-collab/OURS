import { OurDayPhoto } from '../../types/models';
import { supabase, supabaseConfig } from '../api/supabaseClient';
import { apiClient } from '../api/apiClient';
import { photoStorageService } from '../storage/storageService';
import { getLocalDateKey } from '../moments/momentTiming';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function normalizeDateKey(momentDate?: string | null, createdAt?: string | null): string {
  if (typeof momentDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(momentDate.trim())) {
    return momentDate.trim();
  }
  if (typeof createdAt === 'string' && createdAt.trim()) {
    try {
      const d = new Date(createdAt);
      if (!isNaN(d.getTime())) {
        return getLocalDateKey(d);
      }
    } catch {
      // fallback below
    }
    const sub = createdAt.trim().substring(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(sub)) {
      return sub;
    }
  }
  return getLocalDateKey();
}

class OurDayService {
  /**
   * Resolves authoritative Supabase user ID without relying on temporary local IDs like 'user_1'
   */
  private async resolveAuthoritativeUserId(fallbackAuthorId?: string): Promise<string> {
    if (supabaseConfig.isConfigured) {
      try {
        const authUserId = await apiClient.ensureAuthenticatedUser();
        if (isValidUuid(authUserId)) {
          return authUserId.trim();
        }
      } catch {
        // Fallback to session check below
      }

      try {
        const { data } = await supabase.auth.getSession();
        const sessionUserId = data?.session?.user?.id;
        if (isValidUuid(sessionUserId)) {
          return sessionUserId.trim();
        }
      } catch {
        // Ignore
      }
    }

    if (isValidUuid(fallbackAuthorId)) {
      return fallbackAuthorId.trim();
    }

    const cachedId = apiClient.getCurrentUserId();
    if (isValidUuid(cachedId)) {
      return cachedId.trim();
    }

    return fallbackAuthorId && fallbackAuthorId !== 'user_1' ? fallbackAuthorId : 'local_user';
  }

  /**
   * Finds or creates the "Наш день" container in public.moments for (pair_id, moment_date)
   * strictly with slot IS NULL and prompt = 'OUR_DAY'.
   */
  private async getOrCreateOurDayContainers(
    pairId: string,
    dateKey: string
  ): Promise<{ primaryContainerId: string; allContainerIds: string[] }> {
    const cleanPairId = pairId.trim();

    const { data: existingRows, error: findErr } = await supabase
      .from('moments')
      .select('id, pair_id, moment_date, slot, prompt, created_at')
      .eq('pair_id', cleanPairId)
      .eq('moment_date', dateKey)
      .is('slot', null)
      .eq('prompt', 'OUR_DAY')
      .order('created_at', { ascending: true });

    if (findErr) {
      console.warn('[OurDayService] Error querying OUR_DAY containers:', findErr.message);
    }

    const validContainers = (existingRows || []).filter(
      (row: any) =>
        isValidUuid(row?.id) &&
        row.slot === null &&
        row.prompt === 'OUR_DAY'
    );

    if (validContainers.length > 0) {
      const ids = validContainers.map((r: any) => r.id);
      return {
        primaryContainerId: ids[0],
        allContainerIds: ids,
      };
    }

    // Create a new OUR_DAY container row in public.moments
    const { data: createdRow, error: createErr } = await supabase
      .from('moments')
      .insert({
        pair_id: cleanPairId,
        moment_date: dateKey,
        slot: null,
        prompt: 'OUR_DAY',
      })
      .select('id, pair_id, moment_date, slot, prompt, created_at')
      .maybeSingle();

    if (!createErr && createdRow && isValidUuid(createdRow.id)) {
      return {
        primaryContainerId: createdRow.id,
        allContainerIds: [createdRow.id],
      };
    }

    // Re-query in case of concurrent creation by partner
    const { data: retryRows } = await supabase
      .from('moments')
      .select('id, pair_id, moment_date, slot, prompt, created_at')
      .eq('pair_id', cleanPairId)
      .eq('moment_date', dateKey)
      .is('slot', null)
      .eq('prompt', 'OUR_DAY')
      .order('created_at', { ascending: true });

    const retryValid = (retryRows || []).filter(
      (row: any) =>
        isValidUuid(row?.id) &&
        row.slot === null &&
        row.prompt === 'OUR_DAY'
    );

    if (retryValid.length > 0) {
      const ids = retryValid.map((r: any) => r.id);
      return {
        primaryContainerId: ids[0],
        allContainerIds: ids,
      };
    }

    throw new Error(createErr?.message || 'Failed to get or create OUR_DAY moment container');
  }

  /**
   * Save or replace the current user's photo for "Наш день" today.
   * Never modifies or deletes the partner's photo.
   */
  async addPhoto(
    pairId: string,
    authorId: string,
    authorName: string,
    imageUrl: string,
    caption?: string | null
  ): Promise<OurDayPhoto> {
    const todayKey = getLocalDateKey();
    const nowIso = new Date().toISOString();
    const resolvedUserId = await this.resolveAuthoritativeUserId(authorId);
    const cleanPairId = (pairId || '').trim();

    if (supabaseConfig.isConfigured && isValidUuid(cleanPairId) && isValidUuid(resolvedUserId)) {
      const { primaryContainerId, allContainerIds } = await this.getOrCreateOurDayContainers(
        cleanPairId,
        todayKey
      );

      // 1. Upload photo via existing photoStorageService
      const storageUrl = await photoStorageService.uploadMomentPhoto(
        cleanPairId,
        primaryContainerId,
        resolvedUserId,
        imageUrl
      );

      if (!storageUrl || storageUrl.startsWith('blob:')) {
        throw new Error('Failed to upload Our Day photo to storage');
      }

      // 2. Check existing photo rows ONLY for the current user across today's OUR_DAY containers
      const { data: existingUserPhotos } = await supabase
        .from('photos')
        .select('id, moment_id, user_id, created_at')
        .in('moment_id', allContainerIds)
        .eq('user_id', resolvedUserId)
        .order('created_at', { ascending: false });

      let savedPhotoId: string | null = null;
      let savedCreatedAt: string = nowIso;

      if (Array.isArray(existingUserPhotos) && existingUserPhotos.length > 0) {
        const primaryExisting = existingUserPhotos[0];
        const { data: updatedRow, error: updateErr } = await supabase
          .from('photos')
          .update({
            storage_path: storageUrl,
            created_at: nowIso,
          })
          .eq('id', primaryExisting.id)
          .eq('user_id', resolvedUserId)
          .select('id, created_at')
          .maybeSingle();

        if (!updateErr && updatedRow?.id) {
          savedPhotoId = updatedRow.id;
          savedCreatedAt = updatedRow.created_at || nowIso;
        }
      }

      // If no existing row or UPDATE was not permitted by RLS, insert a new row for current user
      if (!savedPhotoId) {
        const { data: insertedRow, error: insertErr } = await supabase
          .from('photos')
          .insert({
            moment_id: primaryContainerId,
            user_id: resolvedUserId,
            storage_path: storageUrl,
            created_at: nowIso,
          })
          .select('id, created_at')
          .maybeSingle();

        if (insertErr) {
          // Fallback: check if row was created concurrently or already exists, then update
          try {
            const { data: fallbackRow } = await supabase
              .from('photos')
              .select('id, created_at')
              .eq('moment_id', primaryContainerId)
              .eq('user_id', resolvedUserId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (fallbackRow?.id) {
              const { data: updatedFallback, error: fallbackUpErr } = await supabase
                .from('photos')
                .update({
                  storage_path: storageUrl,
                  created_at: nowIso,
                })
                .eq('id', fallbackRow.id)
                .select('id, created_at')
                .maybeSingle();

              if (!fallbackUpErr && updatedFallback?.id) {
                savedPhotoId = updatedFallback.id;
                savedCreatedAt = updatedFallback.created_at || nowIso;
              } else {
                savedPhotoId = fallbackRow.id;
                savedCreatedAt = fallbackRow.created_at || nowIso;
              }
            } else {
              throw new Error(insertErr.message || 'Failed to save Our Day photo row');
            }
          } catch (fbErr: any) {
            throw new Error(fbErr?.message || insertErr.message || 'Failed to save Our Day photo row');
          }
        } else {
          savedPhotoId = insertedRow?.id || null;
          savedCreatedAt = insertedRow?.created_at || nowIso;
        }
      }

      // Best-effort cleanup of any older duplicate rows belonging strictly to THIS user in today's OUR_DAY containers
      if (savedPhotoId && Array.isArray(existingUserPhotos) && existingUserPhotos.length > 0) {
        const staleOwnIds = existingUserPhotos
          .map((p: any) => p.id)
          .filter((id: any) => isValidUuid(id) && id !== savedPhotoId);

        if (staleOwnIds.length > 0) {
          try {
            await supabase
              .from('photos')
              .delete()
              .in('id', staleOwnIds)
              .eq('user_id', resolvedUserId);
          } catch {
            // Non-fatal: fetchRemotePhotos deduplicates by newest created_at per (dateKey, user_id)
          }
        }
      }

      // 3. Broadcast realtime update to partner and invalidate history cache
      apiClient.broadcastPairUpdate(cleanPairId, {
        action: 'our_day_updated',
        pairId: cleanPairId,
        userId: resolvedUserId,
        dateKey: todayKey,
      });
      apiClient.invalidateHistoryCache(cleanPairId);

      return {
        id: savedPhotoId || `ourday-${cleanPairId}-${todayKey}-${resolvedUserId}`,
        pairId: cleanPairId,
        authorId: resolvedUserId,
        authorName: authorName || 'Пользователь',
        imageUrl: storageUrl,
        createdAt: savedCreatedAt,
        dateKey: todayKey,
        caption: caption || null,
      };
    }

    // Offline / local fallback
    return {
      id: `ourday-${cleanPairId || 'pair'}-${todayKey}-${resolvedUserId}`,
      pairId: cleanPairId,
      authorId: resolvedUserId,
      authorName: authorName || 'Пользователь',
      imageUrl,
      createdAt: nowIso,
      dateKey: todayKey,
      caption: caption || null,
    };
  }

  /**
   * Save multiple photos at once
   */
  async addMultiplePhotos(
    pairId: string,
    authorId: string,
    authorName: string,
    imageUrls: string[]
  ): Promise<OurDayPhoto[]> {
    const photos: OurDayPhoto[] = [];
    for (const url of imageUrls) {
      const p = await this.addPhoto(pairId, authorId, authorName, url);
      photos.push(p);
    }
    return photos;
  }

  /**
   * Fetch all "Наш день" photos for a pair from Supabase (public.moments + public.photos).
   * Collects photos across all OUR_DAY containers per date and keeps only the newest photo
   * per (dateKey, user_id).
   */
  async fetchRemotePhotos(pairId: string): Promise<OurDayPhoto[]> {
    const cleanPairId = (pairId || '').trim();
    if (!supabaseConfig.isConfigured || !isValidUuid(cleanPairId)) {
      return [];
    }

    try {
      const { data: momentRows, error: momentsErr } = await supabase
        .from('moments')
        .select('id, pair_id, moment_date, slot, prompt, created_at')
        .eq('pair_id', cleanPairId)
        .is('slot', null)
        .eq('prompt', 'OUR_DAY')
        .order('moment_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (momentsErr || !Array.isArray(momentRows) || momentRows.length === 0) {
        return [];
      }

      const containerDateMap = new Map<string, string>();
      const containerIds: string[] = [];

      for (const row of momentRows) {
        if (isValidUuid(row?.id) && row.slot === null && row.prompt === 'OUR_DAY') {
          const dKey = normalizeDateKey(row.moment_date, row.created_at);
          containerDateMap.set(row.id, dKey);
          containerIds.push(row.id);
        }
      }

      if (containerIds.length === 0) {
        return [];
      }

      const photoRows: any[] = [];
      const CHUNK_SIZE = 30;
      for (let i = 0; i < containerIds.length; i += CHUNK_SIZE) {
        const chunk = containerIds.slice(i, i + CHUNK_SIZE);
        const { data: chunkRows, error: chunkErr } = await supabase
          .from('photos')
          .select('id, moment_id, user_id, storage_path, created_at')
          .in('moment_id', chunk)
          .order('created_at', { ascending: false });

        if (!chunkErr && Array.isArray(chunkRows)) {
          photoRows.push(...chunkRows);
        }
      }

      if (photoRows.length === 0) {
        return [];
      }

      // Fetch profile names for photo authors
      const authorIds = Array.from(
        new Set(photoRows.map((p: any) => p?.user_id).filter(isValidUuid))
      );

      const profileNameMap = new Map<string, string>();
      if (authorIds.length > 0) {
        try {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', authorIds);

          if (Array.isArray(profiles)) {
            for (const prof of profiles) {
              if (prof?.id && prof?.name?.trim()) {
                profileNameMap.set(prof.id, prof.name.trim());
              }
            }
          }
        } catch {
          // Non-fatal
        }
      }

      const currentUserId = apiClient.getCurrentUserId();
      const knownPartnerName = apiClient.getKnownPartnerName(cleanPairId);

      // Sort all photos newest-first so the first seen entry for (dateKey, user_id) is the freshest
      const sortedPhotos = [...photoRows].sort((a: any, b: any) => {
        const tA = a?.created_at ? new Date(a.created_at).getTime() : 0;
        const tB = b?.created_at ? new Date(b.created_at).getTime() : 0;
        return tB - tA;
      });

      const seenDateAuthor = new Set<string>();
      const result: OurDayPhoto[] = [];

      for (const row of sortedPhotos) {
        const rawUrl = row?.storage_path || (row as any)?.image_url;
        if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.startsWith('blob:')) {
          continue;
        }
        const authorId = String(row?.user_id || '').trim();
        if (!authorId) {
          continue;
        }

        const dateKey = containerDateMap.get(row.moment_id) || normalizeDateKey(null, row.created_at);
        const dedupeKey = `${dateKey}::${authorId}`;

        if (seenDateAuthor.has(dedupeKey)) {
          continue;
        }
        seenDateAuthor.add(dedupeKey);

        const authorName =
          profileNameMap.get(authorId) ||
          (currentUserId && authorId !== currentUserId && knownPartnerName ? knownPartnerName : 'Партнёр');

        result.push({
          id: row.id || `ourday-${cleanPairId}-${dateKey}-${authorId}`,
          pairId: cleanPairId,
          authorId,
          authorName,
          imageUrl: rawUrl,
          createdAt: row.created_at || new Date().toISOString(),
          dateKey,
          caption: null,
        });
      }

      return result;
    } catch (err) {
      console.warn('[OurDayService] Error fetching remote OUR_DAY photos:', err);
      return [];
    }
  }

  /**
   * Delete a photo by ID (strictly restricted to current user's own photo)
   */
  async deletePhoto(photoId: string, pairId: string): Promise<boolean> {
    const cleanPairId = (pairId || '').trim();
    if (supabaseConfig.isConfigured && isValidUuid(cleanPairId)) {
      try {
        const resolvedUserId = await this.resolveAuthoritativeUserId();
        if (isValidUuid(photoId) && isValidUuid(resolvedUserId)) {
          await supabase
            .from('photos')
            .delete()
            .eq('id', photoId.trim())
            .eq('user_id', resolvedUserId);

          apiClient.broadcastPairUpdate(cleanPairId, {
            action: 'our_day_updated',
            pairId: cleanPairId,
            userId: resolvedUserId,
          });
          apiClient.invalidateHistoryCache(cleanPairId);
        }
      } catch (err) {
        console.warn('[OurDayService] Supabase delete warning:', err);
      }
    }
    return true;
  }
}

export const ourDayService = new OurDayService();
