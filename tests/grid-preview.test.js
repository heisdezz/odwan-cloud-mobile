import { expect, test } from 'bun:test';
import { columnsAfterPinch } from '../src/helpers/grid-zoom';
import { createTaskQueue } from '../src/lib/task-queue';

test('pinches change density in the expected direction and stay within usable limits', () => {
  expect(columnsAfterPinch(3, 1.3)).toBe(2);
  expect(columnsAfterPinch(3, 1 / 1.3)).toBe(4);
  expect(columnsAfterPinch(3, 1.02)).toBe(3);
  expect(columnsAfterPinch(1, 10)).toBe(1);
  expect(columnsAfterPinch(6, 0.1)).toBe(6);
  expect(columnsAfterPinch(3, 0)).toBe(3);
  expect(columnsAfterPinch(3, NaN)).toBe(3);
});

test('thumbnail queue limits simultaneous work and skips cancelled offscreen requests', async () => {
  const enqueue = createTaskQueue(2);
  let active = 0, peak = 0;
  const releases = [];
  const work = () => new Promise((resolve) => {
    peak = Math.max(peak, ++active);
    releases.push(() => { active--; resolve('frame'); });
  });
  const first = enqueue(work), second = enqueue(work);
  const controller = new AbortController();
  let cancelledStarted = false;
  const cancelled = enqueue(async () => { cancelledStarted = true; }, controller.signal);
  const rejected = cancelled.catch((error) => error.message);
  const last = enqueue(work);
  controller.abort();
  expect(await rejected).toContain('cancelled');
  await Promise.resolve();
  expect(releases.length).toBe(2);
  releases[0](); releases[1]();
  await Promise.all([first, second]);
  // Wait for the queue's finally handler to launch the final task.
  await Promise.resolve(); await Promise.resolve();
  releases[2]();
  expect(await last).toBe('frame');
  expect(peak).toBe(2);
  expect(cancelledStarted).toBe(false);
});
