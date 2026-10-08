import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from 'react';
import { createStore } from 'zustand/vanilla';
import { AppState } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { randomUUID } from 'expo-crypto';
import { toast } from 'sonner-native';
import { pb } from '@/client/pb';
import { runLocalDatabase, recordBackupStatus, readBackupStatuses } from '@/db/local-store.native';
import { uploadRepository as repository } from '@/db/upload-repository.native';
import { createUploadRunner } from '@/lib/upload-runner';
import { backgroundUploadsAvailable, backgroundUploadsRunning, startUploadBackground, stopUploadBackground, updateUploadNotification } from '@/lib/upload-background.native';
import { UPLOAD_QUEUE_MIGRATION, UPLOAD_HISTORY_MIGRATION, type LocalAsset, type BackupScope } from '@/db/schema';
import { createUploadWorker } from '@/lib/upload-worker';
import { uploadDeviceFile } from '@/lib/upload-file.native';
import { readUploadToken, saveUploadToken } from '@/lib/upload-token';
import { testServerConnection } from '@/lib/server-connection';
import { UploadConnectionError, UploadError, type UploadDestination, type UploadJob, type UploadPhase } from '@/lib/upload-types';
import { useServerStore } from '@/stores/server-store';
import { uploadScopeKey, useUploadPreferences } from '@/stores/upload-preferences-store';
import { UploadQueueContext } from './upload-queue-context';
import { UploadActivityProvider } from './upload-activity-provider';
import { galleryInteraction } from '@/lib/gallery-interaction';

// Recover interrupted entries once per JS runtime, rather than on every mount/focus.
let recovery: Promise<void> | undefined;
const EMPTY_JOBS: UploadJob[] = [];

export function UploadQueueProvider({ children }: PropsWithChildren) {
  const client = useQueryClient();
  const { verifiedUrl, account, revision } = useServerStore();
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [phase, setPhase] = useState<UploadPhase>(null);
  const [backgroundError, setBackgroundError] = useState<string | null>(null);
  const [retryState, setRetryState] = useState({ scopeKey: null as string | null, attempt: 0, waiting: false });
  const scope = useMemo(() => verifiedUrl && account ? { serverUrl: verifiedUrl, accountId: account.id } : null, [verifiedUrl, account]);
  const scopeKey = scope ? uploadScopeKey(scope) : null;
  const retryAttempt = retryState.scopeKey === scopeKey ? retryState.attempt : 0;
  const waitingForConnection = retryState.scopeKey === scopeKey && retryState.waiting;
  const paused = useUploadPreferences((state) => scope ? !!state.pausedByScope[uploadScopeKey(scope)] : false);
  const savePaused = useUploadPreferences((state) => state.setPaused);
  const setPaused = useCallback((value: boolean) => { if (scope) savePaused(scope, value); }, [scope, savePaused]);
  const [runtime] = useState(() => createStore<{ scope: BackupScope | null }>(() => ({ scope: null })));
  useEffect(() => { runtime.setState({ scope: !paused ? scope : null }); }, [scope, paused, runtime]);
  const query = useQuery({ queryKey: ['upload-queue', verifiedUrl, account?.id], enabled: !!scope,
    queryFn: async () => {
      // Fast Refresh may retain a connection initialized before this migration.
      recovery ??= runLocalDatabase(async (db) => {
        const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        if ((version?.user_version ?? 0) < 4) await db.withTransactionAsync(() => db.execAsync(UPLOAD_QUEUE_MIGRATION));
        if ((version?.user_version ?? 0) < 5) await db.withTransactionAsync(() => db.execAsync(UPLOAD_HISTORY_MIGRATION));
      }).then(() => repository.recover()).catch((error) => { recovery = undefined; throw error; });
      await recovery;
      return scope ? repository.current(scope) : [];
    },
    networkMode: 'always', staleTime: Infinity, refetchOnWindowFocus: false,
  });
  const [backupRefresh] = useState(() => {
    let dirty = false;
    const flush = () => {
      if (!dirty || galleryInteraction.isBusy()) return;
      dirty = false;
      void client.invalidateQueries({ queryKey: ['backup-status'] });
    };
    return { request: () => { dirty = true; flush(); }, flush };
  });
  useEffect(() => galleryInteraction.subscribe(backupRefresh.flush), [backupRefresh]);
  const changed = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['upload-queue'] });
    backupRefresh.request();
    void client.invalidateQueries({ queryKey: ['upload-history'] });
  }, [client, backupRefresh]);
  const [worker] = useState(() => createUploadWorker({ repository, scope: () => AppState.currentState === 'active' || backgroundUploadsRunning() ? runtime.getState().scope : null,
    upload: async (job, signal) => {
      setPhase({ id: job.id, phase: 'preparing' });
      void updateUploadNotification(`Preparing ${job.asset.filename}`).catch(() => {});
      const token = await readUploadToken(job.serverUrl);
      if (!token) throw new UploadError('Enter the upload token in the upload sheet, then retry.', 401);
      return uploadDeviceFile(job, token, signal, () => { setPhase({ id: job.id, phase: 'sending' }); void updateUploadNotification(`Sending / storing ${job.asset.filename}`).catch(() => {}); });
    },
    organize: async (job, result, signal) => {
      setPhase({ id: job.id, phase: 'organizing' });
      void updateUploadNotification(`Adding ${job.asset.filename} to ${job.albumName}`).catch(() => {});
      const state = useServerStore.getState();
      if (state.verifiedUrl !== job.serverUrl || state.account?.id !== job.accountId || !pb.authStore.isValid)
        throw new UploadError('Log in again to finish organizing this upload.', 401);
      const api = new PocketBase(job.serverUrl, new BaseAuthStore());
      api.authStore.save(pb.authStore.token, pb.authStore.record);
      try {
        await api.collection('media_item').update(result.media_id, { album_id: job.albumId }, { signal, requestKey: null });
      } catch (error) {
        if (!signal.aborted && error && typeof error === 'object' && 'status' in error && error.status === 0)
          throw new UploadConnectionError();
        throw error;
      }
      void client.invalidateQueries({ queryKey: ['albums', job.serverUrl, job.accountId] });
      void client.invalidateQueries({ queryKey: ['media-items', job.serverUrl, job.accountId] });
    },
    confirm: async (job, result) => {
      await recordBackupStatus(job.asset, job, 'backed_up', { remoteId: result.media_id, fileHash: result.hash });
    },
    status: async (job, state, error) => {
      const previous = await readBackupStatuses([job.asset], job);
      if (previous[job.asset.id] !== 'backed_up') await recordBackupStatus(job.asset, job, state, undefined, error);
    },
    changed: () => { setPhase(null); changed(); },
    connectionLost: (job) => {
      const key = uploadScopeKey(job);
      setRetryState((state) => ({ scopeKey: key, attempt: state.scopeKey === key ? state.attempt + 1 : 1, waiting: true }));
    },
    completed: (job) => {
      const key = uploadScopeKey(job);
      setRetryState((state) => state.scopeKey === key ? { scopeKey: key, attempt: 0, waiting: false } : state);
    },
  }));
  const [runner] = useState(() => createUploadRunner({ worker,
    // Stop before Android 15's six-hour dataSync service limit.
    maxBackgroundDurationMs: 5.75 * 60 * 60 * 1000,
    onBackgroundDeadline: () => setPaused(true),
    canRun: () => !!runtime.getState().scope && (AppState.currentState === 'active' || backgroundUploadsRunning()),
    hasPending: async () => { const current = runtime.getState().scope; return !!current && repository.hasPending(current); },
    background: backgroundUploadsAvailable ? {
      start: async () => { await startUploadBackground(); setBackgroundError(null); }, stop: stopUploadBackground,
    } : undefined,
    onBackgroundError: (error) => setBackgroundError(error instanceof Error ? error.message : 'Background uploads unavailable.'),
  }));
  const wake = useCallback(() => { void runner.wake().catch((error: Error) => toast.error(error.message)); }, [runner]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setActive(state === 'active'));
    return () => subscription.remove();
  }, []);
  useEffect(() => { runner.stop(); return () => runner.stop(); }, [scope, revision, paused, runner]);
  useEffect(() => {
    if (!retryAttempt || !scope || paused || !active) return;
    let cancelled = false;
    const delay = Math.min(30_000, 1_000 * 2 ** Math.min(retryAttempt - 1, 5));
    const timer = setTimeout(() => {
      void testServerConnection(scope.serverUrl).then(() => {
        if (cancelled) return;
        setRetryState((state) => state.scopeKey === scopeKey ? { ...state, waiting: false } : state);
        wake();
      }).catch(() => {
        if (!cancelled) setRetryState((state) => state.scopeKey === scopeKey ? { ...state, attempt: state.attempt + 1 } : state);
      });
    }, delay);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [retryAttempt, scope, scopeKey, paused, active, wake]);
  useEffect(() => {
    if (scope && !paused && query.isSuccess && active && !waitingForConnection) wake();
    else if (!scope || paused || (!active && !backgroundUploadsRunning())) runner.stop();
  }, [scope, active, paused, waitingForConnection, query.isSuccess, revision, wake, runner]);
  useEffect(() => () => runner.stop(), [runner]);
  const enqueue = useCallback(async (assets: LocalAsset[], destination: UploadDestination, token: string) => {
    const server = useServerStore.getState();
    if (!scope || !pb.authStore.isValid || server.verifiedUrl !== scope.serverUrl || server.account?.id !== scope.accountId)
      throw new Error('Connect and log in before uploading.');
    if (!token.trim()) throw new Error('Enter the server upload token.');
    const checkedRevision = useServerStore.getState().revision;
    await saveUploadToken(scope.serverUrl, token);
    if (useServerStore.getState().revision !== checkedRevision) throw new Error('The server changed. Choose the destination again.');
    const createdAt = Date.now();
    const jobs: UploadJob[] = assets.map((asset, index) => {
      const id = randomUUID();
      return { ...scope, id, asset, albumId: destination.id, albumName: destination.name,
        objectKey: `tests/${id}/${asset.filename.replace(/[\\/]/g, '_') || 'media'}`,
        state: 'queued', result: null, error: null, createdAt: createdAt + index };
    });
    await repository.enqueue(jobs); changed(); if (!waitingForConnection) wake();
  }, [scope, changed, waitingForConnection, wake]);
  const retry = useCallback(async () => { if (scope) { await repository.retry(scope); changed(); if (!waitingForConnection) wake(); } }, [scope, changed, waitingForConnection, wake]);
  const remove = useCallback(async (id: string) => { await repository.remove(id); changed(); }, [changed]);
  const clearCompleted = useCallback(async () => { if (scope) { await repository.clearCompleted(scope); changed(); } }, [scope, changed]);
  const reload = async () => { const result = await query.refetch(); if (result.error) throw result.error; };
  return <UploadActivityProvider jobs={query.data ?? EMPTY_JOBS} scopeKey={JSON.stringify([verifiedUrl, account?.id, revision])}>
    <UploadQueueContext.Provider value={{ jobs: query.data ?? EMPTY_JOBS, phase, paused, waitingForConnection, ready: query.isSuccess,
      error: query.error, backgroundAvailable: backgroundUploadsAvailable, backgroundError, enqueue, retry, remove, clearCompleted, reload, setPaused }}>{children}</UploadQueueContext.Provider>
  </UploadActivityProvider>;
}
