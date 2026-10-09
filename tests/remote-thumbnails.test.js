import { expect, test } from 'bun:test';
import { withRemoteThumbnailSource } from '../src/lib/remote-thumbnail-source';
import { createThumbnailQueues } from '../src/lib/thumbnail-queues';

const deferred = () => { let resolve; const promise = new Promise((next) => { resolve = next; }); return { promise, resolve }; };

test('decoding begins only after a full download, and cleanup waits until the JPEG is saved', async () => {
  const download = deferred(), decode = deferred(); const events = [];
  const preview = withRemoteThumbnailSource({
    download: async () => { events.push('downloading'); return download.promise; },
    publish: async (file) => { expect(file).toBe('file:///private-cache/original'); events.push('decoding'); await decode.promise; events.push('saved'); return 'file:///preview.jpg'; },
    cleanup: () => events.push('cleaned'),
  });
  await Promise.resolve(); expect(events).toEqual(['downloading']);
  download.resolve('file:///private-cache/original');
  while (!events.includes('decoding')) await Promise.resolve();
  expect(events).not.toContain('cleaned');
  decode.resolve(); expect(await preview).toBe('file:///preview.jpg');
  expect(events).toEqual(['downloading', 'decoding', 'saved', 'cleaned']);
});

test('a stalled download is cancelled and cleaned up without entering the video decoder', async () => {
  let aborted = false, decoded = false, cleaned = false;
  const preview = withRemoteThumbnailSource({
    download: (signal) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => { aborted = true; reject(new Error('Download cancelled')); }, { once: true });
    }),
    publish: async () => { decoded = true; }, cleanup: () => { cleaned = true; },
  }, { timeoutMs: 5, maxBytes: 100 });
  await expect(preview).rejects.toThrow('timed out');
  expect(aborted).toBe(true); expect(decoded).toBe(false); expect(cleaned).toBe(true);
});

test('oversized previews are cancelled with or without a content length', async () => {
  for (const [written, total] of [[1, 101], [101, -1]]) {
    let aborted = false, cleaned = false, decoded = false;
    const preview = withRemoteThumbnailSource({
      download: async (signal, progress) => { progress(written, total); aborted = signal.aborted; return 'file:///oversized'; },
      publish: async () => { decoded = true; }, cleanup: () => { cleaned = true; },
    }, { timeoutMs: 100, maxBytes: 100 });
    await expect(preview).rejects.toThrow('exceeds');
    expect(aborted).toBe(true); expect(cleaned).toBe(true); expect(decoded).toBe(false);
  }
});

test('download and publication errors clean up temporary files without pretending a thumbnail exists', async () => {
  let cleaned = 0;
  await expect(withRemoteThumbnailSource({ download: async () => { throw new Error('HTTP 401'); },
    publish: async () => 'never', cleanup: () => { cleaned++; } })).rejects.toThrow('HTTP 401');
  await expect(withRemoteThumbnailSource({ download: async () => 'file:///original',
    publish: async () => { throw new Error('Unsupported codec'); }, cleanup: () => { cleaned++; } })).rejects.toThrow('Unsupported codec');
  expect(cleaned).toBe(2);
});

test('a stalled server preview cannot consume device slots after grid interaction', async () => {
  const queues = createThumbnailQueues(), server = deferred(); let local = 0, remote = 0;
  const first = queues.remote(async () => { remote++; await server.promise; });
  const controller = new AbortController();
  const offscreen = queues.remote(async () => { remote++; }, controller.signal);
  queues.setBusy(true);
  const device = queues.local(async () => { local++; });
  await Promise.resolve();
  expect(local).toBe(0); expect(remote).toBe(1);
  queues.setBusy(false);
  await device;
  expect(local).toBe(1);
  controller.abort(); await expect(offscreen).rejects.toThrow('cancelled');
  server.resolve(); await first;
  await queues.remote(async () => { remote++; });
  expect(remote).toBe(2); queues.setBusy(false);
});
