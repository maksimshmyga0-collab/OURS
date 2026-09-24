import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const isBrowser = typeof window !== 'undefined';
  // All browser requests are routed safely through same-origin proxy /supabase-api
  const targetUrl = isBrowser
    ? `${window.location.origin}/supabase-api`
    : (env.supabaseUrl || 'http://localhost:3000/supabase-api');

  return {
    url: targetUrl,
    anonKey: env.supabaseAnonKey || 'public-anon-key',
    isConfigured: Boolean(env.supabaseUrl),
  };
}

export const supabaseConfig = getSupabaseConfig();

export const supabase: SupabaseClient = createClient(
  supabaseConfig.url,
  supabaseConfig.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  }
);
