import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
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

export function getSystemTheme(): ResolvedTheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: ThemeMode;
  onThemePersist?: (theme: ThemeMode) => void;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  initialTheme,
  onThemePersist,
}) => {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved as ThemeMode;
      }
    } catch {
      // fallback
    }
    if (initialTheme === 'light' || initialTheme === 'dark' || initialTheme === 'system') {
      return initialTheme;
    }
    return 'system';
  });

  const [systemPreference, setSystemPreference] = useState<ResolvedTheme>(getSystemTheme);

  // Sync with prop if it changes externally
  useEffect(() => {
    if (initialTheme && initialTheme !== theme) {
      setThemeState(initialTheme);
    }
  }, [initialTheme]);

  // Dynamic listener for prefers-color-scheme with Android/Capacitor focus & visibility fallback
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateSystemPreference = () => {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setSystemPreference(isDark ? 'dark' : 'light');
    };

    // Initialize current match
    updateSystemPreference();

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateSystemPreference);
    } else if ('addListener' in mediaQuery) {
      (mediaQuery as any).addListener(updateSystemPreference);
    }

    // Android WebView / Capacitor: updates when user returns from system settings or pulls notification shade
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== 'hidden') {
        updateSystemPreference();
      }
    };

    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', updateSystemPreference);
      } else if ('removeListener' in mediaQuery) {
        (mediaQuery as any).removeListener(updateSystemPreference);
      }
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (theme === 'system') {
      return systemPreference;
    }
    return theme;
  }, [theme, systemPreference]);

  // Apply resolved theme to DOM with smooth micro-transition (150-250ms)
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    root.classList.add('theme-transitioning');

    if (resolvedTheme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
      root.dataset.theme = 'dark';
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.dataset.theme = 'light';
      root.setAttribute('data-theme', 'light');
      root.style.colorScheme = 'light';
    }

    // Update meta theme-color for mobile address bar
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', resolvedTheme === 'dark' ? '#000000' : '#FFF9FA');
    }

    const timer = setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 220);

    return () => {
      clearTimeout(timer);
      root.classList.remove('theme-transitioning');
    };
  }, [resolvedTheme]);

  const setTheme = useCallback(
    (newTheme: ThemeMode) => {
      setThemeState(newTheme);
      try {
        localStorage.setItem(STORAGE_THEME_KEY, newTheme);
      } catch {
        // ignore
      }
      if (onThemePersist) {
        onThemePersist(newTheme);
      }
    },
    [onThemePersist]
  );

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      setTheme,
    }),
    [theme, resolvedTheme, setTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
