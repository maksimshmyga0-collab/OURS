/**
 * Photo Sync Queue for OURS
 * Guarantees offline resilience and reliable background uploads for Moments and Date photos.
 * Uses IndexedDB for durable local persistence of pending photo upload tasks.
 */

import { photoStorageService } from './storageService';
import { supabase, supabaseConfig } from '../api/supabaseClient';
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
   * Fetch all pending tasks
   */
  async getAllPendingTasks(): Promise<PendingUploadTask[]> {
    try {
      const db = await this.getDB();
      const tasks = await new Promise<PendingUploadTask[]>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      return tasks.filter((t) => t.status !== 'completed' && t.retryCount < MAX_RETRIES);
    } catch {
      return this.fallbackMemoryQueue.filter((t) => t.status !== 'completed' && t.retryCount < MAX_RETRIES);
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

    const allTasks = await this.getAllPendingTasks();
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
          console.error(`[OURS SyncQueue] Error processing task ${task.id}:`, err);
          task.retryCount += 1;
          task.lastError = err?.message || String(err);
          task.status = task.retryCount >= MAX_RETRIES ? 'failed' : 'pending';
          task.updatedAt = Date.now();
          await this.saveTask(task);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Upload moment photo to Supabase Storage & sync database + appState
   */
  private async processMomentUpload(task: PendingUploadTask): Promise<void> {
    const storageUrl = await photoStorageService.uploadMomentPhoto(
      task.pairId,
      task.momentId,
      task.userId,
      task.photoData
    );

    // If storageUrl is still a base64 Data URI or blob, upload was not completed on server/storage bucket
    if (!storageUrl || !storageUrl.startsWith('http')) {
      throw new Error('Upload returned non-HTTP URL (offline or storage error)');
    }

    // Save photo record to public.photos table in Supabase
    if (supabaseConfig.isConfigured) {
      const { error: upsertErr } = await supabase.from('photos').upsert(
        {
          moment_id: task.momentId,
          user_id: task.userId,
          storage_path: storageUrl,
          created_at: new Date().toISOString(),
        },
        { onConflict: 'moment_id,user_id' }
      );

      if (upsertErr) {
        console.warn('[OURS SyncQueue] Warning: public.photos upsert error:', upsertErr);
      }
    }

    // Update local appState storage by replacing Data URI with permanent CDN URL
    this.updateLocalAppStateMomentPhoto(task.momentId, task.userId, storageUrl);

    // Notify active React views
    this.notifyPhotoSynced({
      type: 'moment',
      momentId: task.momentId,
      userId: task.userId,
      photoUrl: storageUrl,
    });

    // Successfully finished! Remove from queue
    await this.removeTask(task.id);
    console.log(`[OURS SyncQueue] Successfully synced moment photo ${task.momentId} -> ${storageUrl}`);
  }

  /**
   * Upload date photo to Supabase Storage & sync public.photos + dateInvitationService
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

    if (supabaseConfig.isConfigured) {
      const todayKey = new Date().toISOString().slice(0, 10);
      try {
        await supabase.from('moments').upsert(
          {
            id: task.momentId,
            pair_id: task.pairId,
            moment_date: todayKey,
            prompt: task.dateTitle ? `Свидание: ${task.dateTitle}` : 'Свидание',
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

        await supabase.from('photos').upsert(
          {
            moment_id: task.momentId,
            user_id: task.userId,
            storage_path: storageUrl,
            image_url: storageUrl,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'moment_id,user_id' }
        );
      } catch (e) {
        console.warn('[OURS SyncQueue] Could not upsert date photo in Supabase:', e);
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
  private updateLocalAppStateMomentPhoto(momentId: string, userId: string, photoUrl: string): void {
    try {
      const appState = getInitialAppState();
      let updated = false;

      if (Array.isArray(appState.todayMoments)) {
        appState.todayMoments = appState.todayMoments.map((m) => {
          if (m.id === momentId) {
            updated = true;
            const currentUserId = appState.couple?.user?.id;
            const isCurrentUser = !currentUserId || currentUserId === userId;

            return {
              ...m,
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
      this.processQueue();
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
      this.scanAndEnqueueUnsyncedDataURIs().then(() => {
        this.processQueue();
      });
    }, 2000);
  }
}

export const photoSyncQueue = new PhotoSyncQueue();
