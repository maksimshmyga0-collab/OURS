/**
 * Platform and Device abstraction
 * Detects running environment (Web browser, Capacitor Android/iOS, or WebView) safely.
 */

export type PlatformType = 'web' | 'android' | 'ios' | 'tma';

interface TelegramWebApp {
  ready?: () => void;
  expand?: () => void;
  enableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  colorScheme?: 'light' | 'dark';
  initData?: string;
  initDataUnsafe?: {
    user?: {
      id?: number;
      first_name?: string;
      last_name?: string;
      username?: string;
      photo_url?: string;
    };
  };
}

export function isTelegramWebApp(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
  return Boolean(win.Telegram?.WebApp && (win.Telegram.WebApp.initData || win.Telegram.WebApp.ready));
}

export function initTelegramWebApp(): void {
  if (typeof window === 'undefined') return;
  try {
    const win = window as unknown as { Telegram?: { WebApp?: TelegramWebApp } };
    const tg = win.Telegram?.WebApp;
    if (tg) {
      tg.ready?.();
      tg.expand?.();
      tg.enableClosingConfirmation?.();
    }
  } catch {
    // Ignore Telegram WebApp initialization errors in standard browser
  }
}

export function isCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(win.Capacitor);
}

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } };
  return Boolean(win.Capacitor?.isNativePlatform && win.Capacitor.isNativePlatform());
}

export function getPlatform(): PlatformType {
  if (typeof window === 'undefined') return 'web';
  if (isTelegramWebApp()) return 'tma';

  const win = window as unknown as { Capacitor?: { getPlatform?: () => string } };
  if (win.Capacitor?.getPlatform) {
    const p = win.Capacitor.getPlatform();
    if (p === 'android') return 'android';
    if (p === 'ios') return 'ios';
  }

  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  if (/android/i.test(userAgent)) return 'android';
  if (/iPad|iPhone|iPod/.test(userAgent)) return 'ios';

  return 'web';
}
