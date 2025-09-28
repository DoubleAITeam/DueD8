import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { useSettingsStore } from '../state/settings';

export type Theme = 'light' | 'dark';
export type ThemePreference = Theme | 'system';

interface ThemeContextType {
  theme: Theme;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function prefersListener(media: MediaQueryList, handler: (event: MediaQueryListEvent) => void) {
  if (typeof media.addEventListener === 'function') {
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }
  media.addListener(handler);
  return () => media.removeListener(handler);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const themePreference = useSettingsStore((state) => state.ui.themePreference);
  const setUiThemePreference = useSettingsStore((state) => state.setUiThemePreference);
  const initialisedFromStorageRef = useRef(false);
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => getSystemPrefersDark());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemPrefersDark(event.matches);
    };
    const detach = prefersListener(media, handleChange);
    // Sync in case it changed between renders
    setSystemPrefersDark(media.matches);
    return detach;
  }, []);

  useEffect(() => {
    if (initialisedFromStorageRef.current) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    const storedPreference = window.localStorage.getItem('themePreference');
    const legacyTheme = window.localStorage.getItem('theme');
    const parsePreference = (value: string | null): ThemePreference | null => {
      if (value === 'light' || value === 'dark' || value === 'system') {
        return value;
      }
      return null;
    };
    const resolved = parsePreference(storedPreference) ?? parsePreference(legacyTheme);
    if (resolved && resolved !== themePreference) {
      setUiThemePreference(resolved);
    }
    initialisedFromStorageRef.current = true;
  }, [themePreference, setUiThemePreference]);

  const theme: Theme = useMemo(() => {
    if (themePreference === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return themePreference;
  }, [systemPrefersDark, themePreference]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.documentElement.setAttribute('data-theme', theme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem('themePreference', themePreference);
  }, [themePreference]);

  const setPreference = useCallback(
    (preference: ThemePreference) => {
      setUiThemePreference(preference);
    },
    [setUiThemePreference]
  );

  const toggleTheme = useCallback(() => {
    const nextTheme: ThemePreference = theme === 'light' ? 'dark' : 'light';
    setUiThemePreference(nextTheme);
  }, [setUiThemePreference, theme]);

  const value = useMemo(
    () => ({ theme, preference: themePreference, setPreference, toggleTheme }),
    [setPreference, theme, themePreference, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
