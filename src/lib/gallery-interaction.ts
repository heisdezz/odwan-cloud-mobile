/** Multiple mounted grids can independently reserve time for touch/scroll work. */
export function createGalleryInteraction(releaseDelay = 160) {
  const active = new Set<object>();
  const timers = new Map<object, ReturnType<typeof setTimeout>>();
  const listeners = new Set<() => void>();
  const publish = () => listeners.forEach((listener) => listener());
  const release = (token: object) => {
    clearTimeout(timers.get(token)); timers.delete(token);
    if (active.delete(token)) publish();
  };
  return {
    isBusy: () => active.size > 0,
    setBusy(token: object, busy: boolean) {
      clearTimeout(timers.get(token)); timers.delete(token);
      if (busy) {
        if (!active.has(token)) { active.add(token); publish(); }
      } else if (active.has(token)) timers.set(token, setTimeout(() => release(token), releaseDelay));
    },
    release,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    wait(signal: AbortSignal): Promise<void> {
      if (signal.aborted) return Promise.reject(new Error('Gallery sync cancelled.'));
      if (!active.size) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const cleanup = () => { listeners.delete(check); signal.removeEventListener('abort', abort); };
        const check = () => { if (!active.size) { cleanup(); resolve(); } };
        const abort = () => { cleanup(); reject(new Error('Gallery sync cancelled.')); };
        listeners.add(check); signal.addEventListener('abort', abort, { once: true });
      });
    },
  };
}

export const galleryInteraction = createGalleryInteraction();
