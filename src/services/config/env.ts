/**
 * Environment configuration reader
 * Safely accesses Vite environment variables without exposing backend secrets.
 */

export interface AppEnvConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  storageBucket: string;
  apiUrl: string;
  isProduction: boolean;
  isDevelopment: boolean;
}

export function getEnvConfig(): AppEnvConfig {
  return {
    supabaseUrl: import.meta.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: 'public-anon-key',
    storageBucket: import.meta.env.VITE_STORAGE_BUCKET || 'moments',
    apiUrl: import.meta.env.VITE_API_URL || '',
    isProduction: import.meta.env.PROD === true || import.meta.env.MODE === 'production',
    isDevelopment: import.meta.env.DEV === true || import.meta.env.MODE === 'development',
  };
}

export const env = getEnvConfig();
