/**
 * Supabase Client Configuration & Contract
 *
 * When Supabase credentials are configured in .env:
 * VITE_SUPABASE_URL=https://xyz.supabase.co
 * VITE_SUPABASE_ANON_KEY=xyz
 *
 * This client provides the connection for:
 * - Supabase Auth (authService)
 * - Supabase Database (pairs, moments, users tables)
 * - Supabase Storage (photoStorageService, bucket 'moments')
 * - Supabase Realtime (subscribeToMoments)
 */

import { env } from '../config/env';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  return {
    url: env.supabaseUrl,
    anonKey: env.supabaseAnonKey,
    isConfigured: Boolean(env.supabaseUrl && env.supabaseAnonKey),
  };
}

export const supabaseConfig = getSupabaseConfig();
