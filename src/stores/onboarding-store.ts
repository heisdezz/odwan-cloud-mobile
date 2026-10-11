import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import type { StateStorage } from 'zustand/middleware';
import { preferencesStorage } from '@/lib/preferences-storage';

const KEY = 'odwan-onboarding-completed';

export function createOnboardingStore(storage: StateStorage) {
  let initialization: Promise<void> | undefined;
  return createStore<{
    ready: boolean; completed: boolean; error: string | null;
    initialize: () => Promise<void>; complete: () => Promise<void>;
  }>((set, get) => ({
    ready: false, completed: false, error: null,
    initialize: () => {
      if (initialization) return initialization;
      initialization = Promise.resolve().then(async () => {
        try { set({ ready: true, completed: await storage.getItem(KEY) === '1', error: null }); }
        catch { set({ error: 'Could not load your preferences. Try again.' }); initialization = undefined; }
      });
      return initialization;
    },
    complete: async () => {
      if (get().completed) return;
      // Persist before navigating: a failed write must not claim the welcome was saved.
      await storage.setItem(KEY, '1');
      set({ completed: true });
    },
  }));
}

const store = createOnboardingStore(preferencesStorage);
export const useOnboardingStore = <T>(selector: (state: ReturnType<typeof store.getState>) => T) => useStore(store, selector);
