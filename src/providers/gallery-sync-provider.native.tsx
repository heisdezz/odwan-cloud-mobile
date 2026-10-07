import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addListener, loadDeviceMedia, loadChangedDeviceMedia, loadDeviceMediaIds, loadDeviceMediaByIds, mediaChangeIds, supportsGalleryUpdates, usePermissions, type GalleryCursor } from '@/lib/device-media.native';
import { clearGalleryIndex, completeGallerySync, readGalleryCheckpoint, readGalleryIds, removeGalleryIds, getLocalDatabase, indexGalleryPage, readGalleryPage } from '@/db/local-store.native';
import { scanGallery } from '@/lib/gallery-sync';
import { syncGalleryUpdates } from '@/lib/gallery-updates';
import { createGallerySyncQueue } from '@/lib/gallery-sync-queue';
import { extract_message } from '@/helpers/api';
import { toast } from 'sonner-native';

function useGallerySyncState() {
  const client = useQueryClient();
  const [permission, requestPermission, getPermission] = usePermissions({ granularPermissions: ['photo', 'video'] });
  const supported = !(Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient);
  const allowed = supported && !!(permission?.granted || permission?.accessPrivileges === 'limited');
  const limited = permission?.accessPrivileges === 'limited';
  const database = useQuery({ queryKey: ['local-database'], queryFn: getLocalDatabase, staleTime: Infinity, networkMode: 'always' });
  const [epoch, setEpoch] = useState(0);
  const [limitedReady, setLimitedReady] = useState(false);
  const [sync, setSync] = useState({ running: false, count: 0, error: '' });
  // Strict Mode / permission changes must wait for an old native batch to exit.
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  const refreshSequence = useRef(0);
  const revalidateLimited = useRef<(() => void) | null>(null);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    if (limited) setLimitedReady(false);
    await getPermission();
    if (sequence === refreshSequence.current) setEpoch((value) => value + 1);
  }, [getPermission, limited]);

  useEffect(() => {
    if (!allowed || !database.isSuccess) return;
    const controller = new AbortController();
    const signal = controller.signal;
    const previous = tail.current;
    const scope = limited ? 'limited' : 'all';
    let libraryRevision = 0;
    let catchup = true;
    const changes = new Map<string, 'upsert' | 'delete'>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const queue = createGallerySyncQueue(async (mode) => {
      await previous.catch(() => {});
      if (signal.aborted) return;
      const scanId = `${Date.now()}-${Math.random()}`;
      const toastId = `gallery-sync-${scanId}`;
      const startedAt = Date.now();
      const revision = libraryRevision;
      const checkpoint = await readGalleryCheckpoint();
      const full = mode === 'full' || !checkpoint || checkpoint.accessScope !== scope || !supportsGalleryUpdates;
      const batch = new Map(changes);
      changes.clear();
      const needsCatchup = catchup;
      catchup = false;
      let count = 0;
      let lastProgress = 0;
      let lastPublish = 0;
      setSync({ running: true, count: 0, error: '' });
      toast.loading(full ? 'Syncing phone gallery…' : 'Updating phone gallery…', { id: toastId, description: full ? 'Preparing scan' : 'Checking changes', duration: Infinity });
      try {
        const cached = await readGalleryPage();
        const initialScan = !cached.assets.length;
        const progress = (total: number) => {
          count = total;
          if (!signal.aborted && Date.now() - lastProgress >= 1000) {
            lastProgress = Date.now();
            toast.loading(full ? 'Syncing phone gallery…' : 'Updating phone gallery…', {
              id: toastId, description: `${total.toLocaleString()} items ${full ? 'scanned' : 'updated'}`, duration: Infinity,
            });
          }
          if (full && initialScan && !signal.aborted && Date.now() - lastPublish >= 5000) {
            lastPublish = Date.now();
            void client.invalidateQueries({ queryKey: ['device-gallery'] });
          }
        };
        if (full) {
          if (limited) {
            await clearGalleryIndex();
            client.removeQueries({ queryKey: ['device-gallery'] });
            if (!signal.aborted) setLimitedReady(true);
          }
          await scanGallery<GalleryCursor>({ initialCursor: 0, signal, load: loadDeviceMedia,
            write: (assets) => indexGalleryPage(assets, scanId),
            // Keep the completed checkpoint even if events arrived during the
            // scan. Skip pruning a moving snapshot; the queued delta fixes it.
            finish: () => completeGallerySync(startedAt, scope, signal, { scanId: revision === libraryRevision ? scanId : undefined }),
            onPage: progress,
          });
        } else if (needsCatchup) {
          await syncGalleryUpdates({ signal, knownIds: await readGalleryIds(),
            loadChanged: (offset) => loadChangedDeviceMedia(offset, checkpoint.checkedAt),
            loadIds: loadDeviceMediaIds, loadMissing: loadDeviceMediaByIds,
            write: (assets) => indexGalleryPage(assets, scanId),
            finish: (ids) => revision === libraryRevision ? completeGallerySync(startedAt, scope, signal, { ids }) : Promise.resolve(),
            onProgress: progress,
          });
        } else {
          const upserts = [...batch].filter(([, action]) => action === 'upsert').map(([id]) => id);
          for (let at = 0; at < upserts.length; at += 20) {
            if (signal.aborted) return;
            const assets = await loadDeviceMediaByIds(upserts.slice(at, at + 20));
            if (signal.aborted) return;
            await indexGalleryPage(assets, scanId);
            progress(count + assets.length);
          }
          await removeGalleryIds([...batch].filter(([, action]) => action === 'delete').map(([id]) => id), signal);
        }
        if (signal.aborted) return;
        await client.invalidateQueries({ queryKey: ['device-gallery'] });
        await client.invalidateQueries({ queryKey: ['backup-status'] });
        if (signal.aborted) return;
        if (limited) setLimitedReady(true);
        setSync({ running: false, count, error: '' });
        if (full || count > 0 || [...batch.values()].includes('delete')) {
          toast.success('Gallery synced', { id: toastId, description: `${count.toLocaleString()} items ${full ? 'scanned' : 'updated'}`, duration: 3000 });
        } else toast.dismiss(toastId);
      } catch (error) {
        catchup = true; // Failed updates must not advance the saved checkpoint.
        if (!signal.aborted) {
          const message = extract_message(error);
          setSync({ running: false, count, error: message });
          toast.error('Gallery sync failed', { id: toastId, description: message, duration: 5000 });
        }
      } finally { if (signal.aborted) toast.dismiss(toastId); }
    }, signal);
    const enqueue = (mode: 'full' | 'updates') => {
      const job = queue.request(mode).catch((error) => {
        if (!signal.aborted) setSync((value) => ({ ...value, running: false, error: extract_message(error) }));
      });
      tail.current = job;
    };
    const library = addListener((event) => {
      libraryRevision++;
      const change = mediaChangeIds(event);
      change.upsert.forEach((id) => changes.set(id, 'upsert'));
      change.deleted.forEach((id) => changes.set(id, 'delete'));
      if (!change.incremental) catchup = true;
      clearTimeout(timer);
      if (limited && !change.incremental) setLimitedReady(false);
      timer = setTimeout(() => enqueue('updates'), 500);
    });
    revalidateLimited.current = () => { catchup = true; setLimitedReady(false); enqueue('updates'); };
    enqueue(epoch > 0 ? 'full' : 'updates');
    return () => { controller.abort(); library.remove(); clearTimeout(timer); revalidateLimited.current = null; };
  }, [allowed, limited, database.isSuccess, epoch, client]);

  useEffect(() => {
    if (!supported) return;
    const app = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // Focus is not a library change. Check permissions without incrementing epoch.
      void getPermission().then(() => {
        // Limited selections may change without changing the permission status.
        if (limited) revalidateLimited.current?.();
      }).catch((error) => setSync((value) => ({ ...value, error: extract_message(error) })));
    });
    return () => app.remove();
  }, [supported, limited, getPermission]);

  return { permission, requestPermission, refresh, allowed, database, sync,
    cacheReadable: allowed && (!limited || limitedReady) };
}

const GallerySyncContext = createContext<ReturnType<typeof useGallerySyncState> | null>(null);
export function GallerySyncProvider({ children }: PropsWithChildren) {
  const state = useGallerySyncState();
  return <GallerySyncContext.Provider value={state}>{children}</GallerySyncContext.Provider>;
}
export function useGallerySync() {
  const context = useContext(GallerySyncContext);
  if (!context) throw new Error('Gallery sync provider is missing.');
  return context;
}
