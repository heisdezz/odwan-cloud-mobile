import { afterEach, expect, test } from 'bun:test';
import { createServerStore } from '../src/stores/server-store';
import { pb } from '../src/client/pb';

afterEach(() => pb.authStore.clear());
const memoryStorage = (initial = null) => {
  let saved = initial;
  return { getItem: () => saved, setItem: (_, value) => { saved = value; }, removeItem: () => { saved = null; } };
};

test('server URL survives a restart and logout without restoring a connected session', () => {
  const storage = memoryStorage();
  const first = createServerStore(storage);
  first.getState().setUrlInput('http://10.80.33.205:8090');
  const revision = first.getState().beginCheck();
  first.getState().verify('http://10.80.33.205:8090', revision);
  first.getState().setAccount({ id: 'user', email: 'test@example.com' });
  pb.authStore.save('session-token');
  expect(JSON.parse(storage.getItem()).state).toEqual({ urlInput: 'http://10.80.33.205:8090' });
  first.getState().logout();
  const reopened = createServerStore(storage);
  expect(reopened.persist.hasHydrated()).toBe(true);
  expect(reopened.getState().urlInput).toBe('http://10.80.33.205:8090');
  expect(reopened.getState().verifiedUrl).toBeNull();
  expect(reopened.getState().account).toBeNull();
  reopened.getState().setUrlInput('');
  expect(createServerStore(storage).getState().urlInput).toBe('');
});

test('invalid or extra persisted fields cannot restore verification or account state', () => {
  const storage = memoryStorage(JSON.stringify({ state: { urlInput: 123, verifiedUrl: 'https://old.example', account: { id: 'old' }, revision: 999 }, version: 0 }));
  const store = createServerStore(storage);
  expect(store.getState().urlInput).toBe('');
  expect(store.getState().verifiedUrl).toBeNull();
  expect(store.getState().account).toBeNull();
  expect(store.getState().revision).toBe(0);
});
