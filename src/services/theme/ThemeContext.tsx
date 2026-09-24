import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ThemeMode, ResolvedTheme } from '../../types';

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
    if (initialTheme) return initialTheme;
    try {
      const saved = localStorage.getItem(STORAGE_THEME_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        return saved;
      }
    } catch {
      // fallback
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

  // Dynamic listener for prefers-color-scheme
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setSystemPreference(e.matches ? 'dark' : 'light');
    };

    // Initialize current match
    setSystemPreference(mediaQuery.matches ? 'dark' : 'light');

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemChange);
      return () => mediaQuery.removeEventListener('change', handleSystemChange);
    } else if ('addListener' in mediaQuery) {
      // Legacy Safari
      (mediaQuery as any).addListener(handleSystemChange);
      return () => (mediaQuery as any).removeListener(handleSystemChange);
    }
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
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
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
