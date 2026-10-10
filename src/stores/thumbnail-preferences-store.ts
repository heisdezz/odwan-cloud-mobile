import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { preferencesStorage } from '@/lib/preferences-storage';

export const THUMBNAIL_CACHE_LIMITS = [64, 128, 256, 512] as const;
export const useThumbnailPreferences = create<{ limitMB: number; setLimitMB: (value: number) => void }>()(persist((set) => ({
  limitMB: 128,
  setLimitMB: (limitMB) => { if (THUMBNAIL_CACHE_LIMITS.some((value) => value === limitMB)) set({ limitMB }); },
}), {
  name: 'odwan-thumbnail-preferences', storage: createJSONStorage(() => preferencesStorage),
  partialize: ({ limitMB }) => ({ limitMB }),
  merge: (saved, current) => {
    const limitMB = (saved as { limitMB?: number } | undefined)?.limitMB;
    return { ...current, limitMB: THUMBNAIL_CACHE_LIMITS.some((value) => value === limitMB) ? limitMB! : 128 };
  },
}));
