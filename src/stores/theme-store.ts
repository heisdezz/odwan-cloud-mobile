import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { preferencesStorage } from '@/lib/preferences-storage';
export type ThemeMode = 'system' | 'light' | 'dark';
export const useThemeStore = create<{ mode: ThemeMode; setMode: (mode: ThemeMode) => void }>()(persist(
  (set) => ({ mode: 'system', setMode: (mode) => set({ mode }) }),
  { name: 'odwan-theme', storage: createJSONStorage(() => preferencesStorage), partialize: ({ mode }) => ({ mode }),
    merge: (saved, current) => { const mode = (saved as { mode?: unknown })?.mode; return { ...current, mode: mode === 'dark' || mode === 'light' ? mode : 'system' }; } },
));
