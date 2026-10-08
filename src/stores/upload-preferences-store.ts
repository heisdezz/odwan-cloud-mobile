import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { BackupScope } from '@/db/schema';
import { preferencesStorage } from '@/lib/preferences-storage';

type UploadPreferences = {
  pausedByScope: Record<string, boolean>;
  setPaused: (scope: BackupScope, paused: boolean) => void;
};

export const uploadScopeKey = ({ serverUrl, accountId }: BackupScope) =>
  JSON.stringify([serverUrl, accountId]);

export function createUploadPreferencesStore(storage: StateStorage) {
  return createStore<UploadPreferences>()(persist((set) => ({
    pausedByScope: {},
    setPaused: (scope, paused) => set((state) => ({
      pausedByScope: { ...state.pausedByScope, [uploadScopeKey(scope)]: paused },
    })),
  }), {
    name: 'odwan-upload-preferences',
    storage: createJSONStorage(() => storage),
    partialize: ({ pausedByScope }) => ({ pausedByScope }),
  }));
}

const store = createUploadPreferencesStore(preferencesStorage);
export const useUploadPreferences = <T,>(selector: (state: UploadPreferences) => T) => useStore(store, selector);
