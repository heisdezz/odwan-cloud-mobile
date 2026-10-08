/** Bounds costly work and removes offscreen requests before they start. */
export function createTaskQueue(concurrency: number) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new Error('Concurrency must be a positive integer.');
  let active = 0;
  const pending: (() => void)[] = [];
  function pump() {
    while (active < concurrency && pending.length) pending.shift()!();
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
        Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; pump(); });
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
  return enqueue;
}
