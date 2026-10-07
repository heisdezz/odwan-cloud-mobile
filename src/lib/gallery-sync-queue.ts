export type GallerySyncMode = 'full' | 'updates';

/** Merge event bursts; finish the current scan before processing new changes. */
export function createGallerySyncQueue(run: (mode: GallerySyncMode) => Promise<void>, signal: AbortSignal) {
  let pending: GallerySyncMode | undefined;
  let running: Promise<void> | undefined;
  function request(mode: GallerySyncMode) {
    if (signal.aborted) return Promise.resolve();
    pending = pending === 'full' || mode === 'full' ? 'full' : 'updates';
    if (!running) {
      running = Promise.resolve().then(async () => {
        while (pending && !signal.aborted) {
          const next = pending;
          pending = undefined;
          await run(next);
        }
      }).finally(() => { running = undefined; pending = undefined; });
    }
    return running;
  }
  return { request };
}
