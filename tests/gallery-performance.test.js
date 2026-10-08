import { expect, test } from 'bun:test';
import { createThumbnailLookup } from '../src/lib/thumbnail-lookup';
import { createGalleryInteraction } from '../src/lib/gallery-interaction';
import { createTaskQueue } from '../src/lib/task-queue';
import { createUploadActivityStore, uploadAssetKey } from '../src/stores/upload-activity-store';

test('thumbnail URI lookup deduplicates misses, evicts least-used entries and invalidates broken files', async () => {
  const lookup = createThumbnailLookup(2);
  let loads = 0;
  const load = (name) => async () => { loads++; return `file:///${name}.jpg`; };
  await Promise.all([lookup.get('a', load('a')), lookup.get('a', load('a'))]);
  expect(loads).toBe(1);
  await lookup.get('b', load('b'));
  await lookup.get('a', load('a')); // Keep a, evict b.
  await lookup.get('c', load('c'));
  await lookup.get('a', load('a'));
  expect(loads).toBe(3);
  await lookup.get('b', load('b'));
  expect(loads).toBe(4);
  lookup.invalidate('file:///b.jpg');
  await lookup.get('b', load('b'));
  expect(loads).toBe(5);
  await expect(lookup.get('failed', async () => { throw new Error('Decode failed'); })).rejects.toThrow('Decode failed');
  expect(await lookup.get('failed', load('fixed'))).toBe('file:///fixed.jpg');
});

test('scanning waits for every active grid and cancellation releases a waiting scan', async () => {
  const scheduler = createGalleryInteraction(1);
  const scrolling = {}, pinching = {};
  scheduler.setBusy(scrolling, true); scheduler.setBusy(pinching, true);
  let resumed = false;
  const wait = scheduler.wait(new AbortController().signal).then(() => { resumed = true; });
  scheduler.release(scrolling);
  await Promise.resolve();
  expect(resumed).toBe(false);
  scheduler.setBusy(pinching, false);
  await wait;
  expect(scheduler.isBusy()).toBe(false);
  scheduler.setBusy(scrolling, true);
  const controller = new AbortController();
  const cancelled = scheduler.wait(controller.signal);
  controller.abort();
  await expect(cancelled).rejects.toThrow('cancelled');
  scheduler.release(scrolling);
});

test('reducing thumbnail concurrency preserves started jobs and holds new work until capacity is available', async () => {
  const queue = createTaskQueue(2);
  const releases = [];
  const work = () => new Promise((resolve) => { releases.push(resolve); });
  const first = queue(work), second = queue(work), third = queue(work);
  await Promise.resolve();
  queue.setConcurrency(1);
  releases[0](); await first; await Promise.resolve(); await Promise.resolve();
  expect(releases).toHaveLength(2);
  releases[1](); await second; await Promise.resolve(); await Promise.resolve();
  expect(releases).toHaveLength(3);
  releases[2](); await third;
});

test('upload status subscriptions update only changed asset versions and preserve confirmed backups', () => {
  const store = createUploadActivityStore();
  const asset = (id) => ({ id, modifiedAt: 1 });
  const job = (id, state, result = null) => ({ asset: asset(id), state, result });
  const key = uploadAssetKey('one', 1);
  store.update([job('one', 'queued'), job('two', 'queued')], 'server');
  let firstChanges = 0, secondChanges = 0;
  let first = store.getState().statuses[key];
  let second = store.getState().statuses[uploadAssetKey('two', 1)];
  const unsubscribe = store.subscribe((state) => {
    if (state.statuses[key] !== first) { firstChanges++; first = state.statuses[key]; }
    if (state.statuses[uploadAssetKey('two', 1)] !== second) { secondChanges++; second = state.statuses[uploadAssetKey('two', 1)]; }
  });
  store.update([job('one', 'uploading'), job('two', 'queued')], 'server');
  expect(firstChanges).toBe(1); expect(secondChanges).toBe(0);
  store.update([job('one', 'organizing', { media_id: 'confirmed' }), job('one', 'queued'), job('two', 'queued')], 'server');
  expect(store.getState().statuses[key]).toBe('backed_up');
  expect(store.getState().statuses[uploadAssetKey('one', 2)]).toBeUndefined();
  store.update([], 'other-server');
  expect(store.getState().pending).toBe(0);
  expect(store.getState().statuses).toEqual({});
  unsubscribe();
});
