/**
 * Platform and Device abstraction
 * Detects running environment (Web browser, Capacitor Android/iOS, or WebView) safely.
 */

export type PlatformType = 'web' | 'android' | 'ios';

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
