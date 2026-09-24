/**
 * Environment configuration reader
 * Safely accesses Vite environment variables without assuming runtime or browser-only context.
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
  const meta = import.meta as unknown as { env?: Record<string, string | boolean | undefined> };
  const metaEnv = meta?.env || {};

  return {
    supabaseUrl: (metaEnv.VITE_SUPABASE_URL as string) || '',
    supabaseAnonKey: (metaEnv.VITE_SUPABASE_ANON_KEY as string) || '',
    storageBucket: (metaEnv.VITE_STORAGE_BUCKET as string) || 'moments',
    apiUrl: (metaEnv.VITE_API_URL as string) || '',
    isProduction: metaEnv.PROD === true || metaEnv.MODE === 'production',
    isDevelopment: metaEnv.DEV === true || metaEnv.MODE === 'development',
  };
}



export const env = getEnvConfig();
