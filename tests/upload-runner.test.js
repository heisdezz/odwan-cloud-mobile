import { expect, test } from 'bun:test';
import { createUploadRunner } from '../src/lib/upload-runner';

const deferred = () => { let resolve; const promise = new Promise((next) => { resolve = next; }); return { promise, resolve }; };
test('empty queues never start a service or recursively wake themselves', async () => {
  let starts = 0, transfers = 0;
  const runner = createUploadRunner({ canRun: () => true, hasPending: async () => false,
    worker: { wake: async () => { transfers++; }, stop: () => {} },
    background: { start: async () => { starts++; }, stop: async () => {} }, onBackgroundError: () => {} });
  await runner.wake(); await Promise.resolve();
  expect(starts).toBe(0); expect(transfers).toBe(0);
});
test('start and stop surround one worker; repeated wakeups cannot overlap native services', async () => {
  const sending = deferred(); const events = [];
  let pending = true, wakes = 0;
  const runner = createUploadRunner({ canRun: () => true, hasPending: async () => pending,
    worker: { wake: async () => { wakes++; events.push('upload'); await sending.promise; pending = false; }, stop: () => {} },
    background: { start: async () => { events.push('start'); }, stop: async () => { events.push('stop'); } }, onBackgroundError: () => {} });
  const first = runner.wake();
  while (!wakes) await Promise.resolve();
  const second = runner.wake(); sending.resolve();
  await Promise.all([first, second]);
  expect(events[0]).toBe('start'); expect(events.at(-1)).toBe('stop');
  expect(events.filter((event) => event === 'start').length).toBe(1);
});
test('pausing during native startup prevents the file transfer and releases the service', async () => {
  const starting = deferred(); let begun = false, stopped = 0, uploads = 0;
  const runner = createUploadRunner({ canRun: () => true, hasPending: async () => true,
    worker: { wake: async () => { uploads++; }, stop: () => {} }, background: {
      start: async () => { begun = true; await starting.promise; }, stop: async () => { stopped++; },
    }, onBackgroundError: () => {} });
  const task = runner.wake(); while (!begun) await Promise.resolve();
  runner.stop(); starting.resolve(); await task;
  expect(uploads).toBe(0); expect(stopped).toBe(1);
});
test('a service failure falls back only while the app is still allowed to run', async () => {
  let allowed = true, uploads = 0, errors = 0;
  const runner = createUploadRunner({ canRun: () => allowed, hasPending: async () => true,
    worker: { wake: async () => { uploads++; }, stop: () => {} }, background: {
      start: async () => { throw new Error('Notifications disabled'); }, stop: async () => {},
    }, onBackgroundError: () => { errors++; } });
  await runner.wake(); expect(uploads).toBe(1); expect(errors).toBe(1);
  allowed = false; await runner.wake(); expect(uploads).toBe(1);
});
test('new work waits until the previous native stop completes', async () => {
  const stopping = deferred(); let stopStarted = false, starts = 0, uploads = 0;
  const runner = createUploadRunner({ canRun: () => true, hasPending: async () => true,
    worker: { wake: async () => { uploads++; }, stop: () => {} }, background: {
      start: async () => { starts++; }, stop: async () => { stopStarted = true; if (starts === 1) await stopping.promise; },
    }, onBackgroundError: () => {} });
  const first = runner.wake(); while (!stopStarted) await Promise.resolve();
  void runner.wake(); expect(starts).toBe(1); stopping.resolve(); await first;
  while (uploads < 2) await Promise.resolve();
  expect(starts).toBe(2);
});


test('a background deadline cancels the worker and releases the native service', async () => {
  const sending = deferred(); let stopped = 0, warning = '';
  const runner = createUploadRunner({ canRun: () => true, hasPending: async () => true, maxBackgroundDurationMs: 5,
    worker: { wake: async () => { await sending.promise; }, stop: () => sending.resolve() },
    background: { start: async () => {}, stop: async () => { stopped++; } },
    onBackgroundError: (error) => { warning = error.message; } });
  await runner.wake();
  expect(stopped).toBe(1); expect(warning).toContain('time limit');
});
