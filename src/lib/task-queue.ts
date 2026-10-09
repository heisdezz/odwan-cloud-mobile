/** Bounds costly work and removes offscreen requests before they start. */
export function createTaskQueue(concurrency: number) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Concurrency must be a positive integer.');
  let active = 0;
  let paused = false;
  const pending: (() => void)[] = [];
  const idleListeners = new Set<() => void>();
  function pump() {
    while (!paused && active < concurrency && pending.length) pending.shift()!();
  }
  function enqueue<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      function abort() {
        const index = pending.indexOf(start);
        if (index >= 0) pending.splice(index, 1);
        signal?.removeEventListener('abort', abort);
        reject(new Error('Thumbnail request cancelled.'));
      }
      function start() {
        signal?.removeEventListener('abort', abort);
        if (signal?.aborted) { abort(); return; }
        active++;
        Promise.resolve().then(task).then(resolve, reject).finally(() => {
          active--; pump();
          if (!active) { idleListeners.forEach((listener) => listener()); idleListeners.clear(); }
        });
      }
      if (signal?.aborted) { abort(); return; }
      signal?.addEventListener('abort', abort, { once: true });
      pending.push(start);
      pump();
    });
  }
  enqueue.setConcurrency = (next: number) => {
    if (!Number.isInteger(next) || next < 1) throw new Error('Concurrency must be a positive integer.');
    concurrency = next;
    pump();
  };
  // Started work completes normally; queued offscreen tasks remain cancellable.
  enqueue.setPaused = (next: boolean) => { paused = next; if (!paused) pump(); };
  enqueue.whenIdle = () => active ? new Promise<void>((resolve) => idleListeners.add(resolve)) : Promise.resolve();
  return enqueue;
}
