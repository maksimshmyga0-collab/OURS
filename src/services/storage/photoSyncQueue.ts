/**
 * Photo Sync Queue for OURS
 * Guarantees offline resilience and reliable background uploads for Moments and Date photos.
 * Uses IndexedDB for durable local persistence of pending photo upload tasks.
 */

import { photoStorageService } from './storageService';
import { supabase, supabaseConfig } from '../api/supabaseClient';
import { apiClient, isValidUuid } from '../api/apiClient';
import { appStorage } from './keyValueStorage';
import { getInitialAppState, saveAppState } from './appStateStorage';
import { dateInvitationService } from '../dates/dateInvitationService';
import { MomentPhoto } from '../../types';

export interface PendingUploadTask {
  id: string;
  type: 'moment' | 'date';
  momentId: string;
  pairId: string;
  userId: string;
  photoData: string; // Base64 Data URI
  dateTitle?: string;
  dateDescription?: string;
  retryCount: number;
  status: 'pending' | 'uploading' | 'failed' | 'completed';
  createdAt: number;
  updatedAt: number;
  lastError?: string;
}

const DB_NAME = 'ours_photo_queue_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_photos';
const MAX_RETRIES = 15;

class PhotoSyncQueue {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private isProcessing = false;
  private fallbackMemoryQueue: PendingUploadTask[] = [];

  constructor() {
    this.initAutoSync();
  }

  /**
   * Initializes IndexedDB database
   */
  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not supported'));
        return;
      }

      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);

        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('status', 'status', { unique: false });
            store.createIndex('type_moment_user', ['type', 'momentId', 'userId'], { unique: false });
          }
        };

        req.onsuccess = () => {
          resolve(req.result);
        };

        req.onerror = () => {
          console.warn('[OURS SyncQueue] Failed to open IndexedDB, using fallback:', req.error);
          reject(req.error);
        };
      } catch (err) {
        console.warn('[OURS SyncQueue] Exception opening IndexedDB:', err);
        reject(err);
      }
    });

    return this.dbPromise;
  }

  /**
   * Save or update a task in IndexedDB (or fallback memory queue)
   */
  private async saveTask(task: PendingUploadTask): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(task);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      const idx = this.fallbackMemoryQueue.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        this.fallbackMemoryQueue[idx] = task;
      } else {
        this.fallbackMemoryQueue.push(task);
      }
    }
  }

  /**
   * Remove a task from storage once successfully uploaded
   */
  private async removeTask(id: string): Promise<void> {
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      this.fallbackMemoryQueue = this.fallbackMemoryQueue.filter((t) => t.id !== id);
    }
  }

  /**
   * Fetch all non-completed tasks stored in IndexedDB (including 'pending', 'uploading', and 'failed' after MAX_RETRIES)
   * Ensures tasks never vanish even after reaching MAX_RETRIES.
   */
  async getAllStoredTasks(): Promise<PendingUploadTask[]> {
    try {
      const db = await this.getDB();
      const tasks = await new Promise<PendingUploadTask[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      return tasks.filter((t) => t.status !== 'completed');
    } catch {
      return this.fallbackMemoryQueue.filter((t) => t.status !== 'completed');
    }
  }

  private isAmbiguousLegacyError(errorMsg?: string): boolean {
    if (!errorMsg) return false;
    return (
      errorMsg.includes('LEGACY_MOMENT_UUID_NULL_SLOT') ||
      errorMsg.includes('AMBIGUOUS_DUPLICATE_SLOT_ROWS')
    );
  }

  /**
   * Fetch all tasks eligible for background processing right now.
   * Tasks that reached MAX_RETRIES ('failed') are NOT deleted: they remain in storage
   * and retry with a cooldown backoff so they never vanish permanently.
   * Tasks blocked by LEGACY_MOMENT_UUID_NULL_SLOT use a 5-minute cooldown instead of 15s polling.
   */
  async getAllPendingTasks(): Promise<PendingUploadTask[]> {
    const allStored = await this.getAllStoredTasks();
    const now = Date.now();
    return allStored.filter((t) => {
      if (this.isAmbiguousLegacyError(t.lastError)) {
        return now - (t.updatedAt || 0) >= 300000; // 5-minute cooldown for unslotted legacy UUID tasks
      }
      if (t.retryCount < MAX_RETRIES) return true;
      // After MAX_RETRIES, task stays preserved in queue and retries after 60s backoff
      return now - (t.updatedAt || 0) >= 60000;
    });
  }

  /**
   * Reset retry status on 'failed' tasks when connectivity is explicitly restored
   */
  async resetFailedTasksForRetry(): Promise<void> {
    const allStored = await this.getAllStoredTasks();
    const now = Date.now();
    for (const task of allStored) {
      if (this.isAmbiguousLegacyError(task.lastError) && now - (task.updatedAt || 0) < 300000) {
        continue;
      }
      if (task.status === 'failed' || task.retryCount >= MAX_RETRIES) {
        task.status = 'pending';
        task.retryCount = 0;
        task.updatedAt = now;
        await this.saveTask(task);
      }
    }
  }

  /**
   * Enqueue a pending photo for background upload and synchronization
   */
  async enqueue(
    input: Omit<PendingUploadTask, 'id' | 'createdAt' | 'updatedAt' | 'retryCount' | 'status'>
  ): Promise<PendingUploadTask> {
    if (!input.photoData || !input.photoData.startsWith('data:')) {
      // Don't enqueue if photo is already an external HTTP URL or empty
      return {
        id: `ignored_${Date.now()}`,
        ...input,
        retryCount: 0,
        status: 'completed',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    }

    // Search across all stored tasks (including 'failed' tasks that hit MAX_RETRIES) to prevent duplicates
    const allTasks = await this.getAllStoredTasks();
    const existing = allTasks.find(
      (t) => t.type === input.type && t.momentId === input.momentId && t.userId === input.userId
    );

    const now = Date.now();
    const task: PendingUploadTask = existing
      ? {
          ...existing,
          photoData: input.photoData,
          pairId: input.pairId || existing.pairId,
          dateTitle: input.dateTitle || existing.dateTitle,
          dateDescription: input.dateDescription || existing.dateDescription,
          retryCount: 0, // reset retries for new attempt
          status: 'pending',
          updatedAt: now,
        }
      : {
          id: `${input.type}_${input.momentId}_${input.userId || 'user'}_${now}`,
          type: input.type,
          momentId: input.momentId,
          pairId: input.pairId,
          userId: input.userId,
          photoData: input.photoData,
          dateTitle: input.dateTitle,
          dateDescription: input.dateDescription,
          retryCount: 0,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        };

    await this.saveTask(task);
    console.log(`[OURS SyncQueue] Enqueued ${task.type} photo for moment ${task.momentId}`);

    // Trigger immediate background sync
    this.processQueue();
    return task;
  }

  /**
   * Process all pending photo upload tasks in background
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isProcessing = true;

    try {
      const tasks = await this.getAllPendingTasks();
      if (tasks.length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log(`[OURS SyncQueue] Processing ${tasks.length} pending photo upload(s)...`);

      for (const task of tasks) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.warn('[OURS SyncQueue] Connection lost during processing, pausing queue');
          break;
        }

        task.status = 'uploading';
        task.updatedAt = Date.now();
        await this.saveTask(task);

        try {
          if (task.type === 'moment') {
            await this.processMomentUpload(task);
          } else if (task.type === 'date') {
            await this.processDateUpload(task);
          }
        } catch (err: any) {
          const errorMsg = err?.message || String(err);
          console.error(`[OURS SyncQueue] Error processing task ${task.id}:`, err);
          task.retryCount += 1;
          task.lastError = errorMsg;
          task.status =
            task.retryCount >= MAX_RETRIES || this.isAmbiguousLegacyError(errorMsg)
              ? 'failed'
              : 'pending';
          task.updatedAt = Date.now();
          await this.saveTask(task);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Upload moment photo to Supabase Storage & sync database + appState.
   * Preserves all original task fields (momentId, pairId, userId, type, photoData) if UUID resolution
   * or database write fails, keeping the task in queue for retry without data loss.
   */
  private async processMomentUpload(task: PendingUploadTask): Promise<void> {
    const originalMomentId = task.momentId;

    if (!originalMomentId || originalMomentId.trim().startsWith('date-') || originalMomentId.trim().startsWith('date_')) {
      throw new Error(`Invalid daily moment ID "${originalMomentId}". Task preserved in queue.`);
    }

    // 1. Resolve canonical server UUID BEFORE attempting database write.
    // Validates both composite IDs and existing UUIDs (rejecting legacy UUIDs with slot IS NULL).
    // Never falls back to a composite string if resolution fails or is ambiguous.
    let targetMomentUuid: string | null = null;
    if (supabaseConfig.isConfigured) {
      const resolved = await apiClient.resolveCanonicalMomentUuid(task.pairId, originalMomentId);
      if (!resolved.uuid || !isValidUuid(resolved.uuid)) {
        throw new Error(
          `Cannot resolve canonical moment UUID for "${originalMomentId}" (${resolved.reason || 'UNRESOLVED'}). Task preserved in queue.`
        );
      }
      targetMomentUuid = resolved.uuid;
    } else if (isValidUuid(originalMomentId)) {
      targetMomentUuid = originalMomentId.trim();
    }

    if (supabaseConfig.isConfigured && (!targetMomentUuid || !isValidUuid(targetMomentUuid))) {
      throw new Error(`Invalid moment UUID for "${originalMomentId}". Task preserved in queue.`);
    }

    const effectiveMomentId = targetMomentUuid || originalMomentId;

    // 2. Upload photo binary to Supabase Storage
    const storageUrl = await photoStorageService.uploadMomentPhoto(
      task.pairId,
      effectiveMomentId,
      task.userId,
      task.photoData
    );

    // If storageUrl is still a base64 Data URI or blob, upload was not completed on server/storage bucket
    if (!storageUrl || !storageUrl.startsWith('http')) {
      throw new Error('Upload returned non-HTTP URL (offline or storage error)');
    }

    // 3. Save photo record to public.photos table in Supabase using strictly validated UUID
    if (supabaseConfig.isConfigured && targetMomentUuid) {
      const { error: upsertErr } = await supabase.from('photos').upsert(
        {
          moment_id: targetMomentUuid,
          user_id: task.userId,
          storage_path: storageUrl,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'moment_id,user_id' }
      );

      if (upsertErr) {
        throw new Error(`public.photos upsert error (${upsertErr.code || 'ERR'}): ${upsertErr.message}`);
      }
    }

    // 4. Update local appState storage by replacing Data URI with permanent CDN URL
    this.updateLocalAppStateMomentPhoto(originalMomentId, targetMomentUuid, task.userId, storageUrl);

    // 5. Notify active React views and broadcast realtime update to partner
    this.notifyPhotoSynced({
      type: 'moment',
      momentId: effectiveMomentId,
      userId: task.userId,
      photoUrl: storageUrl,
    });

    if (originalMomentId !== effectiveMomentId) {
      this.notifyPhotoSynced({
        type: 'moment',
        momentId: originalMomentId,
        userId: task.userId,
        photoUrl: storageUrl,
      });
    }

    if (task.pairId) {
      apiClient.broadcastPairUpdate(task.pairId, {
        action: 'photo_uploaded',
        momentId: effectiveMomentId,
        userId: task.userId,
      });
      apiClient.invalidateHistoryCache(task.pairId);
    }

    // 6. Successfully finished! Remove from queue
    await this.removeTask(task.id);
    console.log(`[OURS SyncQueue] Successfully synced moment photo ${effectiveMomentId} -> ${storageUrl}`);
  }

  /**
   * Upload date photo to Supabase Storage & sync public.photos + dateInvitationService.
   * Never creates regular daily moments for date tasks and never passes non-UUID date IDs into UUID columns.
   */
  private async processDateUpload(task: PendingUploadTask): Promise<void> {
    const storageUrl = await photoStorageService.uploadMomentPhoto(
      task.pairId,
      task.momentId,
      task.userId,
      task.photoData
    );

    if (!storageUrl || !storageUrl.startsWith('http')) {
      throw new Error('Upload returned non-HTTP URL for date photo');
    }

    // Only write to public.moments / public.photos if task.momentId and task.pairId are valid UUIDs
    if (supabaseConfig.isConfigured && isValidUuid(task.momentId) && isValidUuid(task.pairId)) {
      const todayKey = new Date().toISOString().slice(0, 10);
      const cleanMomentUuid = task.momentId.trim();

      const { error: mErr } = await supabase.from('moments').upsert(
        {
          id: cleanMomentUuid,
          pair_id: task.pairId.trim(),
          moment_date: todayKey,
          prompt: task.dateTitle ? `Свидание: ${task.dateTitle}` : 'Свидание',
        },
        { onConflict: 'id', ignoreDuplicates: true }
      );

      if (mErr) {
        throw new Error(`Date moment upsert error (${mErr.code || 'ERR'}): ${mErr.message}`);
      }

      const { error: pErr } = await supabase.from('photos').upsert(
        {
          moment_id: cleanMomentUuid,
          user_id: task.userId,
          storage_path: storageUrl,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'moment_id,user_id' }
      );

      if (pErr) {
        throw new Error(`Date photo upsert error (${pErr.code || 'ERR'}): ${pErr.message}`);
      }
    }

    // Update local date photos cache
    this.updateLocalDatePhotos(task.momentId, task.userId, storageUrl);

    // Update date invitation state if active
    const activeInv = dateInvitationService.getInvitation();
    if (activeInv && (activeInv.momentId === task.momentId || `date-${activeInv.id}` === task.momentId)) {
      dateInvitationService.completeDateWithPhoto(
        activeInv.id,
        storageUrl,
        task.momentId,
        task.pairId
      );
    }

    // Notify active React views
    this.notifyPhotoSynced({
      type: 'date',
      momentId: task.momentId,
      userId: task.userId,
      photoUrl: storageUrl,
    });

    // Remove from queue
    await this.removeTask(task.id);
    console.log(`[OURS SyncQueue] Successfully synced date photo ${task.momentId} -> ${storageUrl}`);
  }

  /**
   * Replace Data URI in local appState with permanent CDN HTTP URL
   */
  private updateLocalAppStateMomentPhoto(
    originalMomentId: string,
    resolvedMomentUuid: string | null,
    userId: string,
    photoUrl: string
  ): void {
    try {
      const appState = getInitialAppState();
      let updated = false;

      if (Array.isArray(appState.todayMoments)) {
        appState.todayMoments = appState.todayMoments.map((m) => {
          if (m.id === originalMomentId || (resolvedMomentUuid && m.id === resolvedMomentUuid)) {
            updated = true;
            const currentUserId = appState.couple?.user?.id;
            const isCurrentUser = !currentUserId || currentUserId === userId;

            return {
              ...m,
              id: resolvedMomentUuid || m.id,
              ...(isCurrentUser
                ? { userPhoto: photoUrl }
                : { partnerPhoto: photoUrl }),
              photos: (m.photos || []).map((p) =>
                p.userId === userId ? { ...p, imageUrl: photoUrl } : p
              ),
            };
          }
          return m;
        });
      }

      if (updated) {
        saveAppState(appState);
      }
    } catch (err) {
      console.warn('[OURS SyncQueue] Could not update local app state with photo URL:', err);
    }
  }

  /**
   * Replace Data URI in local storage for Date photos
   */
  private updateLocalDatePhotos(momentId: string, userId: string, photoUrl: string): void {
    try {
      const storageKey = `ours_date_photos_${momentId}`;
      const stored = appStorage.getItem(storageKey);
      if (typeof stored === 'string' && stored) {
        const list: MomentPhoto[] = JSON.parse(stored);
        if (Array.isArray(list)) {
          const updated = list.map((p) =>
            p.userId === userId ? { ...p, imageUrl: photoUrl } : p
          );
          appStorage.setItem(storageKey, JSON.stringify(updated));
        }
      }
    } catch (err) {
      console.warn('[OURS SyncQueue] Could not update local date photos storage:', err);
    }
  }

  /**
   * Scan local app state and storage for any leftover base64 Data URIs and enqueue them automatically
   */
  async scanAndEnqueueUnsyncedDataURIs(): Promise<void> {
    try {
      const appState = getInitialAppState();
      const pairId = appState.couple?.id || '';
      const userId = appState.couple?.user?.id || 'user';

      // Scan today's moments
      if (Array.isArray(appState.todayMoments)) {
        for (const m of appState.todayMoments) {
          if (m.userPhoto && m.userPhoto.startsWith('data:')) {
            await this.enqueue({
              type: 'moment',
              momentId: m.id,
              pairId,
              userId,
              photoData: m.userPhoto,
            });
          }
        }
      }

      // Scan current date invitation
      const inv = dateInvitationService.getInvitation();
      if (inv && inv.photoUrl && inv.photoUrl.startsWith('data:')) {
        const momentId = inv.momentId || `date-${inv.id}`;
        await this.enqueue({
          type: 'date',
          momentId,
          pairId: inv.pairId || pairId,
          userId,
          photoData: inv.photoUrl,
          dateTitle: inv.idea?.title,
          dateDescription: inv.idea?.description,
        });
      }
    } catch (err) {
      console.warn('[OURS SyncQueue] Exception scanning for unsynced Data URIs:', err);
    }
  }

  /**
   * Notify DOM window of synced photos so React components update live
   */
  private notifyPhotoSynced(detail: {
    type: 'moment' | 'date';
    momentId: string;
    userId: string;
    photoUrl: string;
  }): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ours-photo-synced', { detail }));
    }
  }

  /**
   * Setup continuous auto-sync listeners
   */
  private initAutoSync(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('[OURS SyncQueue] Network connection restored. Processing pending upload queue...');
      this.resetFailedTasksForRetry().then(() => {
        this.processQueue();
      });
    });

    window.addEventListener('focus', () => {
      this.processQueue();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.processQueue();
      }
    });

    // Check queue periodically every 15 seconds
    setInterval(() => {
      this.processQueue();
    }, 15000);

    // Initial startup scan and queue check after 2s
    setTimeout(() => {
      this.resetFailedTasksForRetry()
        .then(() => this.scanAndEnqueueUnsyncedDataURIs())
        .then(() => {
          this.processQueue();
        });
    }, 2000);
  }
}

export const photoSyncQueue = new PhotoSyncQueue();
