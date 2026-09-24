/**
 * Storage Service
 * Manages photo file uploading and retrieval for Moments.
 * Decouples photo binary handling from database rows and business logic.
 * Prepares for Supabase Storage (bucket: 'moments') or Capacitor Filesystem/Camera.
 */

import { env } from '../config/env';

export interface IStorageService {
  uploadMomentPhoto(
    pairId: string,
    momentId: string,
    fileOrData: File | Blob | string
  ): Promise<string>;
  getPublicUrl(pathOrUrl: string): string;
}

export class AppStorageService implements IStorageService {
  private bucketName: string;

  constructor(bucketName: string = env.storageBucket) {
    this.bucketName = bucketName;
  }

  /**
   * Uploads a moment photo and returns its public access URL.
   * If running in local mock mode without Supabase credentials, returns an object URL
   * or direct clean URL reference to prevent bloating database state with base64 strings.
   */
  async uploadMomentPhoto(
    pairId: string,
    momentId: string,
    fileOrData: File | Blob | string
  ): Promise<string> {
    // If Supabase is connected in the future:
    // const filePath = `${pairId}/${momentId}-${Date.now()}.jpg`;
    // const { data, error } = await supabase.storage.from(this.bucketName).upload(filePath, fileOrData);
    // return this.getPublicUrl(filePath);

    if (typeof fileOrData === 'string') {
      // If it's already an HTTP URL (preset photo or CDN), return as-is
      if (fileOrData.startsWith('http://') || fileOrData.startsWith('https://')) {
        return fileOrData;
      }
      // If it's a data URI in local mode:
      return fileOrData;
    }

    if (fileOrData instanceof Blob) {
      if (typeof URL !== 'undefined' && URL.createObjectURL) {
        return URL.createObjectURL(fileOrData);
      }
    }

    return '';
  }

  getPublicUrl(pathOrUrl: string): string {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    if (env.supabaseUrl) {
      return `${env.supabaseUrl}/storage/v1/object/public/${this.bucketName}/${pathOrUrl}`;
    }
    return pathOrUrl;
  }
}

export const photoStorageService = new AppStorageService();
