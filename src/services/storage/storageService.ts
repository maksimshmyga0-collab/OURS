/**
 * Supabase Storage Service
 * Manages photo file uploading and retrieval for Moments in Supabase Storage.
 */

import { supabase, supabaseConfig } from '../api/supabaseClient';
import { env } from '../config/env';
import { optimizePhotoForUpload } from './imageOptimizer';

export const PHOTO_BUCKET_NAME = env.storageBucket || 'ours-photos';

export interface IStorageService {
  uploadMomentPhoto(
    pairId: string,
    momentId: string,
    userId: string,
    fileOrData: File | Blob | string
  ): Promise<string>;
  getPublicUrl(pathOrUrl: string): string;
}

export class AppStorageService implements IStorageService {
  private bucketName: string;

  constructor(bucketName: string = PHOTO_BUCKET_NAME) {
    this.bucketName = bucketName;
  }

  /**
   * Helper: converts base64 Data URL to Blob
   */
  private dataURItoBlob(dataURI: string): Blob {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  }

  /**
   * Uploads a moment photo to Supabase Storage bucket and returns its public URL
   */
  async uploadMomentPhoto(
    pairId: string,
    momentId: string,
    userId: string,
    fileOrData: File | Blob | string
  ): Promise<string> {
    // 1. If it's already an external HTTP URL (preset sample photo or CDN), return as-is
    if (typeof fileOrData === 'string' && (fileOrData.startsWith('http://') || fileOrData.startsWith('https://'))) {
      return fileOrData;
    }

    // 2. If it's a blob: URL, resolve its binary data before it gets revoked
    let sourceToOptimize: File | Blob | string = fileOrData;
    if (typeof fileOrData === 'string' && fileOrData.startsWith('blob:')) {
      try {
        const blobResp = await fetch(fileOrData);
        if (blobResp.ok) {
          sourceToOptimize = await blobResp.blob();
        }
      } catch (err) {
        console.warn('[OURS Storage] Could not fetch local blob URL:', err);
      }
    }

    // 3. Optimize image into a clean, standalone JPEG Data URL
    let targetSource: File | Blob | string = sourceToOptimize;
    if (typeof sourceToOptimize === 'string' && sourceToOptimize.startsWith('data:')) {
      targetSource = sourceToOptimize;
    } else {
      try {
        const optimized = await optimizePhotoForUpload(sourceToOptimize);
        if (optimized && !optimized.startsWith('blob:')) {
          targetSource = optimized;
        }
      } catch {
        // ignore
      }
    }

    // 4. Try server-side upload endpoint (uses Service Role Key to upload to ours-photos CDN)
    if (typeof targetSource === 'string' && targetSource.startsWith('data:')) {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (supabaseConfig.isConfigured) {
          try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (token) {
              headers['Authorization'] = `Bearer ${token}`;
            }
          } catch {
            // ignore
          }
        }

        const srvResp = await fetch('/api/storage/upload-photo', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            pairId,
            momentId,
            photoData: targetSource,
          }),
        });

        if (srvResp.ok) {
          const srvJson = await srvResp.json();
          if (srvJson?.url && (srvJson.url.startsWith('http://') || srvJson.url.startsWith('https://'))) {
            return srvJson.url;
          }
        }
      } catch (srvErr) {
        console.warn('[OURS Storage] Server upload fallback to client storage/data URI:', srvErr);
      }
    }

    // 5. Try direct Supabase client storage upload
    let blob: Blob | null = null;
    let ext = 'jpg';

    if (typeof targetSource === 'string' && targetSource.startsWith('data:')) {
      blob = this.dataURItoBlob(targetSource);
      if (targetSource.includes('image/png')) ext = 'png';
      if (targetSource.includes('image/webp')) ext = 'webp';
    } else if (targetSource instanceof Blob) {
      blob = targetSource;
      if (targetSource.type === 'image/png') ext = 'png';
      if (targetSource.type === 'image/webp') ext = 'webp';
    }

    if (blob && supabaseConfig.isConfigured) {
      const safePairId = pairId || 'pair';
      const safeMomentId = momentId || 'moment';
      const safeUserId = userId || 'user';
      const filePath = `${safePairId}/${safeMomentId}/${safeUserId}_${Date.now()}.${ext}`;

      try {
        let uploadRes = await supabase.storage
          .from(this.bucketName)
          .upload(filePath, blob, {
            contentType: blob.type || 'image/jpeg',
            upsert: true,
          });

        if (uploadRes.error && this.bucketName !== 'moments') {
          uploadRes = await supabase.storage
            .from('moments')
            .upload(filePath, blob, {
              contentType: blob.type || 'image/jpeg',
              upsert: true,
            });
          if (!uploadRes.error) {
            const { data } = supabase.storage.from('moments').getPublicUrl(filePath);
            return data.publicUrl;
          }
        }

        if (!uploadRes.error) {
          const { data } = supabase.storage.from(this.bucketName).getPublicUrl(filePath);
          return data.publicUrl;
        }
      } catch (err) {
        console.warn('[OURS Storage] Client direct storage upload exception:', err);
      }
    }

    // 6. Graceful persistent fallback: standalone Data URL (works across all devices and browsers)
    if (typeof targetSource === 'string' && targetSource.startsWith('data:')) {
      return targetSource;
    }

    // 7. If targetSource is still a Blob, convert it to Data URL via FileReader (NEVER return a blob: URL)
    if (blob) {
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob!);
        });
        if (dataUrl && dataUrl.startsWith('data:')) {
          return dataUrl;
        }
      } catch {
        // ignore
      }
    }

    // 8. Absolute safety guarantee: NEVER return a blob: URL under any circumstances
    if (typeof fileOrData === 'string' && !fileOrData.startsWith('blob:')) {
      return fileOrData;
    }

    return '';
  }

  getPublicUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    if (supabaseConfig.isConfigured) {
      const { data } = supabase.storage.from(this.bucketName).getPublicUrl(pathOrUrl);
      return data.publicUrl;
    }
    return pathOrUrl;
  }
}

export const photoStorageService = new AppStorageService();
