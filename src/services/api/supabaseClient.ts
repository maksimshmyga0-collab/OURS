import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const fallbackUrl = 'https://dcaryfwvjattucxbckgw.supabase.co';
  const targetUrl = env.supabaseUrl || fallbackUrl;
  const anonKey = env.supabaseAnonKey || '';

  return {
    url: targetUrl,
    anonKey,
    isConfigured: Boolean(targetUrl && anonKey),
  };
}

export const supabaseConfig = getSupabaseConfig();

export const supabase: SupabaseClient = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey || 'dummy-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
