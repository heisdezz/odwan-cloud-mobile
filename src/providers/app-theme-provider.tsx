import { createContext, useCallback, useContext, useEffect, useRef, type PropsWithChildren } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import { useAppColorScheme, useDeviceContext } from 'twrnc';

import tw from '@/lib/tw';
import { animateThemeChange } from '@/lib/theme-animation';

import { useThemeStore, type ThemeMode } from '@/stores/theme-store';
export type { ThemeMode } from '@/stores/theme-store';
type ThemeContextValue = {
  mode: ThemeMode;
  colorScheme: 'light' | 'dark';
  setTheme: (mode: ThemeMode) => Promise<void>;
  toggleTheme: () => Promise<void>;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const mode = useThemeStore((state) => state.mode);
  const setMode = useThemeStore((state) => state.setMode);
  useEffect(() => { Appearance.setColorScheme(mode === "system" ? "unspecified" : mode); }, [mode]);
  const switching = useRef(false);
  const colorScheme = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  useDeviceContext(tw, { observeDeviceColorSchemeChanges: false, initialColorScheme: 'device' });
  const [twScheme, , setTwScheme] = useAppColorScheme(tw);
  useEffect(() => {
    if (twScheme !== colorScheme) setTwScheme(colorScheme);
  }, [twScheme, colorScheme, setTwScheme]);

  const setTheme = useCallback(async (next: ThemeMode) => {
    if (switching.current || next === mode) return;
    switching.current = true;
    try {
      await animateThemeChange(() => {
        Appearance.setColorScheme(next === 'system' ? 'unspecified' : next);
        setMode(next);
      });
    } finally {
      switching.current = false;
    }
  }, [mode, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, colorScheme, setTheme, toggleTheme: () => setTheme(colorScheme === 'dark' ? 'light' : 'dark') }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useAppTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useAppTheme must be used inside AppThemeProvider');
  return context;
}
