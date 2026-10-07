import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { preferencesStorage } from '@/lib/preferences-storage';

type ViewerPreferences = { favorites: Record<string, true>; toggleFavorite: (key: string) => void };
export const useViewerStore = create<ViewerPreferences>()(persist((set) => ({
  favorites: {},
  toggleFavorite: (key) => set((state) => {
    const favorites = { ...state.favorites };
    if (favorites[key]) delete favorites[key]; else favorites[key] = true;
    return { favorites };
  }),
}), {
  name: 'odwan-viewer-preferences',
  storage: createJSONStorage(() => preferencesStorage),
  partialize: ({ favorites }) => ({ favorites }),
}));
