import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { useStore } from 'zustand';
import type { BackupStatus, LocalAsset } from '@/db/schema';
import type { UploadJob } from '@/lib/upload-types';
import { createUploadActivityStore, uploadAssetKey } from '@/stores/upload-activity-store';
import { useServerStore } from '@/stores/server-store';

const empty = createUploadActivityStore();
const Context = createContext(empty);
export function UploadActivityProvider({ jobs, scopeKey, children }: PropsWithChildren<{ jobs: UploadJob[]; scopeKey: string }>) {
  const [store] = useState(createUploadActivityStore);
  useEffect(() => { store.update(jobs, scopeKey); }, [store, jobs, scopeKey]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

function useScopeKey() {
  return useServerStore((state) => JSON.stringify([state.verifiedUrl, state.account?.id, state.revision]));
}
export function useUploadPendingCount() {
  const store = useContext(Context);
  const scopeKey = useScopeKey();
  return useStore(store, (state) => state.scopeKey === scopeKey ? state.pending : 0);
}
export function useAssetBackupStatus(asset: LocalAsset, saved?: BackupStatus) {
  const store = useContext(Context);
  const scopeKey = useScopeKey();
  const key = uploadAssetKey(asset.id, asset.modifiedAt);
  return useStore(store, (state) => saved === 'backed_up' ? saved
    : state.scopeKey === scopeKey ? state.statuses[key] ?? saved : saved);
}
