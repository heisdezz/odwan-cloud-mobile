import { expect, test } from 'bun:test';
import { createFocusedGridColumns } from '../src/lib/focused-grid-columns';
import { createThumbnailQueues } from '../src/lib/thumbnail-queues';

test('column changes notify the focused recycler only; hidden recyclers catch up once when opened', () => {
  let columns = 3;
  const listeners = new Set();
  const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
  const active = createFocusedGridColumns(() => columns, subscribe);
  const hidden = createFocusedGridColumns(() => columns, subscribe);
  let activeLayouts = 0, hiddenLayouts = 0;
  active.subscribe(() => activeLayouts++); hidden.subscribe(() => hiddenLayouts++);
  active.setFocused(true);
  for (const next of [4, 5, 6]) { columns = next; listeners.forEach((listener) => listener()); }
  expect(activeLayouts).toBe(3);
  expect(hiddenLayouts).toBe(0);
  expect(hidden.getSnapshot()).toBe(3);
  active.setFocused(false); hidden.setFocused(true);
  expect(hiddenLayouts).toBe(1);
  expect(hidden.getSnapshot()).toBe(6);
  expect(listeners.size).toBe(1);
  hidden.setFocused(false);
  expect(listeners.size).toBe(0);
});

test('unchanged preferences do not relayout the focused recycler and repeated focus does not duplicate listeners', () => {
  const listeners = new Set();
  const grid = createFocusedGridColumns(() => 4, (listener) => { listeners.add(listener); return () => listeners.delete(listener); });
  let layouts = 0; grid.subscribe(() => layouts++);
  grid.setFocused(true); grid.setFocused(true);
  listeners.forEach((listener) => listener());
  expect(listeners.size).toBe(1);
  expect(layouts).toBe(0);
  grid.setFocused(false);
});

test('pinching pauses both thumbnail queues, keeps started work, and skips queued offscreen work', async () => {
  const queues = createThumbnailQueues();
  const starts = [];
  let finish;
  const started = queues.remote(() => new Promise((resolve) => { starts.push('started'); finish = resolve; }));
  await Promise.resolve();
  queues.setBusy(true);
  const controller = new AbortController();
  const offscreen = queues.local(async () => { starts.push('offscreen'); }, controller.signal);
  const visible = queues.local(async () => { starts.push('visible'); });
  const remote = queues.remote(async () => { starts.push('remote'); });
  controller.abort();
  await expect(offscreen).rejects.toThrow('cancelled');
  finish(); await started;
  await Promise.resolve();
  expect(starts).toEqual(['started']);
  queues.setBusy(false);
  await Promise.all([visible, remote]);
  expect(starts).toEqual(['started', 'visible', 'remote']);
});
