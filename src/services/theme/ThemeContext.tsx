import React, { createContext, useContext, useEffect, useMemo, useCallback } from 'react';
import { ThemeMode, ResolvedTheme } from '../../types';

export type ThemePreference = ThemeMode;
export type { ResolvedTheme };

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const STORAGE_THEME_KEY = 'ours_theme_mode_v1';

/**
 * Permanently enforce Dark Theme across DOM, PWA meta tags, and Native Capacitor / TMA wrappers.
 */
export function enforcePermanentDarkTheme(): void {
  if (typeof document === 'undefined') return;

  try {
    const root = document.documentElement;

    // 1. Root DOM class and attribute enforcement
    if (root.classList.contains('light')) {
      root.classList.remove('light');
    }
    if (!root.classList.contains('dark')) {
      root.classList.add('dark');
    }
    root.dataset.theme = 'dark';
    root.setAttribute('data-theme', 'dark');
    root.style.colorScheme = 'dark';

    // 2. Meta tags for browser viewport and mobile address bar
    let metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (!metaThemeColor) {
      metaThemeColor = document.createElement('meta');
      metaThemeColor.setAttribute('name', 'theme-color');
      document.head.appendChild(metaThemeColor);
    }
    metaThemeColor.setAttribute('content', '#000000');

    let metaColorScheme = document.querySelector('meta[name="color-scheme"]');
    if (!metaColorScheme) {
      metaColorScheme = document.createElement('meta');
      metaColorScheme.setAttribute('name', 'color-scheme');
      document.head.appendChild(metaColorScheme);
    }
    metaColorScheme.setAttribute('content', 'dark');

    let metaAppleStatusBar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
    if (!metaAppleStatusBar) {
      metaAppleStatusBar = document.createElement('meta');
      metaAppleStatusBar.setAttribute('name', 'apple-mobile-web-app-status-bar-style');
      document.head.appendChild(metaAppleStatusBar);
    }
    metaAppleStatusBar.setAttribute('content', 'black-translucent');

    // 3. Persist locked dark theme to localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(STORAGE_THEME_KEY, 'dark');
    }

    // 4. Native Capacitor Plugins (Android & iOS)
    if (typeof window !== 'undefined') {
      const win = window as any;
      try {
        if (win.Capacitor?.Plugins?.StatusBar) {
          // 'DARK' style renders light status bar icons/text for dark backgrounds
          win.Capacitor.Plugins.StatusBar.setStyle?.({ style: 'DARK' });
          win.Capacitor.Plugins.StatusBar.setBackgroundColor?.({ color: '#000000' });
        }
        if (win.Capacitor?.Plugins?.NavigationBar) {
          win.Capacitor.Plugins.NavigationBar.setColor?.({ color: '#000000', darkButtons: false });
        }
        if (win.Telegram?.WebApp) {
          win.Telegram.WebApp.setHeaderColor?.('#000000');
          win.Telegram.WebApp.setBackgroundColor?.('#000000');
        }
      } catch {
        // Safe fallback
      }
    }
  } catch {
    // Safe fallback
  }
}

/** Always returns 'dark' for backward compatibility */
export function getSystemTheme(): ResolvedTheme {
  return 'dark';
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeMode;
  onThemePersist?: (theme: ThemeMode) => void;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // Enforce dark theme on mount and keep it locked
  useEffect(() => {
    enforcePermanentDarkTheme();

    // Re-assert dark theme when app resumes or gains focus
    const handleReassert = () => enforcePermanentDarkTheme();
    window.addEventListener('focus', handleReassert);
    document.addEventListener('visibilitychange', handleReassert);

    return () => {
      window.removeEventListener('focus', handleReassert);
      document.removeEventListener('visibilitychange', handleReassert);
    };
  }, []);

  const setTheme = useCallback((_newTheme: ThemeMode) => {
    // Theme switching is permanently disabled. Always locked to dark.
    enforcePermanentDarkTheme();
  }, []);

  const value = useMemo<ThemeContextType>(
    () => ({
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme,
    }),
    [setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      theme: 'dark',
      resolvedTheme: 'dark',
      setTheme: () => {},
    };
  }
  return context;
};
