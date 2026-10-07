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
  logout: () => { pb.authStore.clear(); set({ account: null }); },
  }), {
    name: 'odwan-server-preferences',
    storage: createJSONStorage(() => storage),
    partialize: ({ urlInput }) => ({ urlInput }),
    merge: (persisted, current) => {
      const urlInput = (persisted as { urlInput?: unknown } | undefined)?.urlInput;
      return { ...current, urlInput: typeof urlInput === 'string' ? urlInput : '' };
    },
  }));
}

export const useServerStore = createServerStore(preferencesStorage);
