import { expect, test } from 'bun:test';
import { createOnboardingStore } from '../src/stores/onboarding-store';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: (key) => { data.delete(key); } };
}

test('a new installation shows onboarding and completion survives reopening', async () => {
  const storage = memoryStorage();
  const first = createOnboardingStore(storage);
  expect(first.getState().ready).toBe(false);
  await first.getState().initialize();
  expect(first.getState().completed).toBe(false);
  await first.getState().complete();
  const next = createOnboardingStore(storage);
  await next.getState().initialize();
  expect(next.getState().ready).toBe(true);
  expect(next.getState().completed).toBe(true);
});

test('async hydration does not expose main screens before preferences are read', async () => {
  let resolve;
  let calls = 0;
  const storage = memoryStorage();
  storage.getItem = () => { calls++; return new Promise((done) => { resolve = done; }); };
  const store = createOnboardingStore(storage);
  const first = store.getState().initialize();
  const second = store.getState().initialize();
  await Promise.resolve();
  expect(calls).toBe(1);
  expect(store.getState().ready).toBe(false);
  resolve('1');
  await Promise.all([first, second]);
  expect(store.getState().completed).toBe(true);
});

test('failed preference reads can retry and failed writes do not claim completion', async () => {
  let fail = true;
  const storage = memoryStorage();
  storage.getItem = () => { if (fail) throw new Error('unavailable'); return null; };
  const store = createOnboardingStore(storage);
  await store.getState().initialize();
  expect(store.getState().ready).toBe(false);
  expect(store.getState().error).toBeTruthy();
  fail = false;
  await store.getState().initialize();
  expect(store.getState().ready).toBe(true);
  storage.setItem = () => { throw new Error('full'); };
  await expect(store.getState().complete()).rejects.toThrow('full');
  expect(store.getState().completed).toBe(false);
});
