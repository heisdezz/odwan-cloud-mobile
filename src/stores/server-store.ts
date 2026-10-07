import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { preferencesStorage } from '@/lib/preferences-storage';
import { pb } from '@/client/pb';

type ServerState = {
  urlInput: string;
  verifiedUrl: string | null;
  revision: number;
  account: { id: string; email: string } | null;
  setUrlInput: (value: string) => void;
  beginCheck: () => number;
  verify: (url: string, revision: number) => boolean;
  setAccount: (account: { id: string; email: string }) => void;
  logout: () => void;
};

export function createServerStore(storage: StateStorage) {
  let lastSaved: string | null | undefined;
  const urlStorage: StateStorage = {
    getItem: (key) => {
      const saved = storage.getItem(key);
      if (typeof saved === 'string' || saved === null) lastSaved = saved;
      return saved;
    },
    setItem: (key, value) => {
      if (value === lastSaved) return;
      const result = storage.setItem(key, value);
      lastSaved = value;
      return result;
    },
    removeItem: (key) => { lastSaved = undefined; return storage.removeItem(key); },
  };
  return create<ServerState>()(persist((set, get) => ({
  urlInput: '', verifiedUrl: null, revision: 0, account: null,
  setUrlInput: (urlInput) => {
    if (urlInput === get().urlInput) return;
    pb.cancelAllRequests();
    pb.authStore.clear();
    set({ urlInput, verifiedUrl: null, account: null, revision: get().revision + 1 });
  },
  beginCheck: () => {
    pb.authStore.clear();
    const revision = get().revision + 1;
    set({ revision, verifiedUrl: null, account: null });
    return revision;
  },
  verify: (verifiedUrl, revision) => {
    if (get().revision !== revision) return false;
    pb.baseURL = verifiedUrl;
    set({ verifiedUrl });
    return true;
  },
  setAccount: (account) => set({ account }),
  logout: () => { pb.cancelAllRequests(); pb.authStore.clear(); set({ account: null, revision: get().revision + 1 }); },
  }), {
    name: 'odwan-server-preferences',
    storage: createJSONStorage(() => urlStorage),
    partialize: ({ urlInput }) => ({ urlInput }),
    merge: (persisted, current) => {
      const urlInput = (persisted as { urlInput?: unknown } | undefined)?.urlInput;
      return { ...current, urlInput: typeof urlInput === 'string' ? urlInput : '' };
    },
  }));
}

export const useServerStore = createServerStore(preferencesStorage);
