/**
 * Supabase Storage Service
 * Manages photo file uploading and retrieval for Moments in Supabase Storage.
 */

import { supabase, supabaseConfig } from '../api/supabaseClient';
import { env } from '../config/env';

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
    // If it's already an external HTTP URL (preset sample photo or CDN), return as-is
    if (typeof fileOrData === 'string' && (fileOrData.startsWith('http://') || fileOrData.startsWith('https://'))) {
      return fileOrData;
    }

    let blob: Blob;
    let ext = 'jpg';

    if (typeof fileOrData === 'string' && fileOrData.startsWith('data:')) {
      blob = this.dataURItoBlob(fileOrData);
      if (fileOrData.includes('image/png')) ext = 'png';
      if (fileOrData.includes('image/webp')) ext = 'webp';
    } else if (fileOrData instanceof Blob) {
      blob = fileOrData;
      if (fileOrData.type === 'image/png') ext = 'png';
      if (fileOrData.type === 'image/webp') ext = 'webp';
    } else {
      return typeof fileOrData === 'string' ? fileOrData : '';
    }

    const safePairId = pairId || 'pair';
    const safeMomentId = momentId || 'moment';
    const safeUserId = userId || 'user';
    const filePath = `${safePairId}/${safeMomentId}/${safeUserId}_${Date.now()}.${ext}`;

    if (supabaseConfig.isConfigured) {
      try {
        // Attempt upload to primary bucket 'ours-photos', fallback to 'moments'
        let uploadRes = await supabase.storage
          .from(this.bucketName)
          .upload(filePath, blob, {
            contentType: blob.type || 'image/jpeg',
            upsert: true,
          });

        if (uploadRes.error && this.bucketName !== 'moments') {
          // Try fallback bucket 'moments'
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
        } else {
          console.warn('[OURS Storage] Upload warning, falling back to data URL:', uploadRes.error.message);
        }
      } catch (err) {
        console.warn('[OURS Storage] Upload exception:', err);
      }
    }

    // Graceful fallback for local data URL if storage is unconfigured / offline
    if (typeof fileOrData === 'string') {
      return fileOrData;
    }
    if (typeof URL !== 'undefined' && URL.createObjectURL) {
      return URL.createObjectURL(blob);
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
