import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { AppState, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { addListener, loadDeviceMedia, usePermissions, type GalleryCursor } from '@/lib/device-media.native';
import { clearGalleryIndex, finishGalleryScan, getLocalDatabase, indexGalleryPage, readGalleryPage } from '@/db/local-store.native';
import { scanGallery } from '@/lib/gallery-sync';
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
  const [checking, setChecking] = useState(false);
  const [limitedReady, setLimitedReady] = useState(false);
  const [sync, setSync] = useState({ running: false, count: 0, error: '' });
  // Strict Mode / permission changes must wait for an old native batch to exit.
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    setChecking(true);
    setLimitedReady(false);
    try {
      await getPermission();
      if (sequence === refreshSequence.current) setEpoch((value) => value + 1);
    } finally { if (sequence === refreshSequence.current) setChecking(false); }
  }, [getPermission]);

  useEffect(() => {
    if (!allowed || !database.isSuccess || checking) return;
    const controller = new AbortController();
    const signal = controller.signal;
    const scanId = `${Date.now()}-${Math.random()}`;
    const toastId = `gallery-sync-${scanId}`;
    let scanned = 0;
    let lastProgress = 0;
    const job = tail.current.catch(() => {}).then(async () => {
      if (signal.aborted) return;
      setSync({ running: true, count: 0, error: '' });
      toast.loading('Syncing phone gallery…', { id: toastId, description: 'Preparing scan', duration: Infinity });
      // Limited selections can change without a different permission status.
      // Revalidate them instead of exposing records from an older selection.
      if (limited) {
        await clearGalleryIndex();
        client.removeQueries({ queryKey: ['device-gallery'] });
        if (!signal.aborted) setLimitedReady(true);
      }
      const cached = await readGalleryPage();
      const initialScan = cached.assets.length === 0;
      let lastUpdate = 0;
      const count = await scanGallery<GalleryCursor>({ initialCursor: 0, signal, load: loadDeviceMedia,
        write: (assets) => indexGalleryPage(assets, scanId),
        finish: () => finishGalleryScan(scanId, signal),
        onPage: (count) => {
          scanned = count;
          // Update only the toast, not every gallery/context subscriber.
          if (!signal.aborted && Date.now() - lastProgress >= 1000) {
            lastProgress = Date.now();
            toast.loading('Syncing phone gallery…', { id: toastId, description: `${count.toLocaleString()} items scanned`, duration: Infinity });
          }
          if (!initialScan || signal.aborted || Date.now() - lastUpdate < 5000) return;
          lastUpdate = Date.now();
          void client.invalidateQueries({ queryKey: ['device-gallery'] });
        },
      });
      if (!signal.aborted) {
        await client.invalidateQueries({ queryKey: ['device-gallery'] });
        await client.invalidateQueries({ queryKey: ['backup-status'] });
        if (signal.aborted) return;
        setSync({ running: false, count, error: '' });
        toast.success('Gallery synced', { id: toastId, description: `${count.toLocaleString()} items scanned`, duration: 3000 });
      }
    }).catch((error) => {
      if (!signal.aborted) {
        const message = extract_message(error);
        setSync({ running: false, count: scanned, error: message });
        toast.error('Gallery sync failed', { id: toastId, description: message, duration: 5000 });
      }
    }).finally(() => { if (signal.aborted) toast.dismiss(toastId); });
    tail.current = job;
    return () => { controller.abort(); toast.dismiss(toastId); };
  }, [allowed, limited, database.isSuccess, checking, epoch, client]);

  useEffect(() => {
    if (!supported) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const queueRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { void refresh().catch((error) => setSync((value) => ({ ...value, error: extract_message(error) }))); }, 500);
    };
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') queueRefresh(); });
    const library = allowed ? addListener(queueRefresh) : null;
    return () => { app.remove(); library?.remove(); clearTimeout(timer); };
  }, [supported, allowed, refresh]);
  return { permission, requestPermission, refresh, allowed, database, sync,
    cacheReadable: allowed && (!limited || (!checking && limitedReady)) };
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
