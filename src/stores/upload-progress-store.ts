import { createStore } from 'zustand/vanilla';
import type { UploadProgress } from '@/lib/upload-types';

/** Ephemeral transfer state: progress never writes SQLite or invalidates gallery cells. */
export function createUploadProgressStore() {
  const store = createStore(() => ({ id: null as string | null, progress: null as UploadProgress | null }));
  return Object.assign(store, {
    start(id: string) { store.setState({ id, progress: { loaded: 0, total: null, percent: null } }); },
    update(id: string, progress: UploadProgress) {
      if (store.getState().id === id) store.setState({ progress });
    },
    clear() { store.setState({ id: null, progress: null }); },
  });
}
export const uploadProgressStore = createUploadProgressStore();
