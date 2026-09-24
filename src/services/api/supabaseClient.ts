import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

export const supabase: SupabaseClient = createClient(
  supabaseConfig.url || 'https://placeholder.supabase.co',
  supabaseConfig.anonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
