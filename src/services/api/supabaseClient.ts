import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  isConfigured: boolean;
}

export function getSupabaseConfig(): SupabaseConfig {
  const isBrowser = typeof window !== 'undefined';
  const shouldUseProxy = isBrowser && (env.isDevelopment || window.location.hostname.includes('run.app') || window.location.hostname === 'localhost');
  const targetUrl = shouldUseProxy
    ? `${window.location.origin}/supabase-api`
    : env.supabaseUrl;

  return {
    url: targetUrl,
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
