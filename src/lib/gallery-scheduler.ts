/** Let rendering/input run before each scan page. Native I/O still runs off JS. */
export function waitForGalleryIdle(signal: AbortSignal, pauseMs = 32) {
  return new Promise<void>((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;
    function cleanup() {
      clearTimeout(timer);
      if (idle !== undefined) cancelIdleCallback(idle);
      signal.removeEventListener('abort', abort);
    }
    function abort() { cleanup(); reject(new Error('Gallery sync cancelled.')); }
    function ready() { cleanup(); resolve(); }
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => {
      if (typeof requestIdleCallback === 'function' && typeof cancelIdleCallback === 'function') {
        // Bound starvation on busy screens, but don't force every page into the next frame.
        idle = requestIdleCallback(ready, { timeout: 1000 });
      } else ready();
    }, pauseMs);
  });
}
