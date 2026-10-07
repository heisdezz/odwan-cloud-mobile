import { afterEach, expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { createSessionVault } from '../src/lib/session-vault';
import { restoreServerSession } from '../src/lib/server-session';
import { clearServerQueries } from '../src/lib/server-query-cache';
import { migratePreferences } from '../src/lib/migrate-preferences';
import { useServerStore } from '../src/stores/server-store';
import { pb } from '../src/client/pb';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; useServerStore.getState().setUrlInput(''); pb.authStore.clear(); });
const memory = () => {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: (key) => { values.delete(key); } };
};
const vault = () => {
  const store = memory();
  return createSessionVault({ getItem: async (key) => store.getItem(key), setItem: async (key, value) => store.setItem(key, value), removeItem: async (key) => store.removeItem(key) });
};
const account = { id: 'superuser', email: 'admin@example.com' };
const jwt = (expires = Date.now() / 1000 + 3600) => `header.${Buffer.from(JSON.stringify({ exp: expires })).toString('base64url')}.signature`;
const connect = (url) => {
  const state = useServerStore.getState();
  state.setUrlInput(url);
  const revision = state.beginCheck();
  state.verify(url, revision);
  return revision;
};

test('saved sessions survive reopening, normalize URLs, and remain isolated by server and base path', async () => {
  const store = memory();
  const asyncStore = { getItem: async (key) => store.getItem(key), setItem: async (key, value) => store.setItem(key, value), removeItem: async (key) => store.removeItem(key) };
  const first = createSessionVault(asyncStore);
  await first.save('https://ONE.example/pb/', { token: 'one', account });
  await first.save('https://two.example', { token: 'two', account });
  const reopened = createSessionVault(asyncStore);
  expect((await reopened.read('https://one.example/pb')).token).toBe('one');
  expect(await reopened.read('https://one.example')).toBeNull();
  await reopened.remove('https://one.example/pb');
  expect(await reopened.read('https://one.example/pb')).toBeNull();
  expect((await reopened.read('https://two.example')).token).toBe('two');
});

test('logout waits for an in-flight save then removes it without resurrecting a session', async () => {
  let finish;
  let persisted;
  const sessions = createSessionVault({ getItem: async () => persisted ?? null, setItem: async (_, value) => {
    await new Promise((resolve) => { finish = resolve; }); persisted = value;
  }, removeItem: async () => { persisted = undefined; } });
  const save = sessions.save('https://one.example', { token: 'one', account });
  while (!finish) await Promise.resolve();
  const logout = sessions.remove('https://one.example');
  finish();
  await Promise.all([save, logout]);
  expect(await sessions.read('https://one.example')).toBeNull();
});

test('restoring validates the correct server token and saves the refreshed session', async () => {
  const sessions = vault();
  const url = 'https://restore.example/pb';
  const token = jwt();
  await sessions.save(url, { token, account });
  const revision = connect(url);
  let calls = 0;
  globalThis.fetch = async (endpoint, options) => {
    calls++;
    expect(endpoint).toBe(`${url}/api/collections/_superusers/auth-refresh`);
    expect(options.headers.Authorization).toBe(token);
    return Response.json({ token, record: { ...account, collectionName: '_superusers', collectionId: 'test' } });
  };
  await Promise.all([restoreServerSession(url, revision, sessions), restoreServerSession(url, revision, sessions)]);
  expect(calls).toBe(1);
  expect(useServerStore.getState().account).toEqual(account);
  expect(pb.authStore.token).toBe(token);
  expect(await sessions.read(url)).toEqual({ token, account });
});

test('a late refresh cannot sign in after logout or switching servers', async () => {
  for (const action of ['logout', 'switch']) {
    const sessions = vault();
    const url = 'https://late.example';
    await sessions.save(url, { token: jwt(), account });
    const revision = connect(url);
    globalThis.fetch = async () => {
      if (action === 'logout') { useServerStore.getState().logout(); await sessions.remove(url); }
      else useServerStore.getState().setUrlInput('https://other.example');
      return Response.json({ token: jwt(), record: account });
    };
    await restoreServerSession(url, revision, sessions);
    expect(useServerStore.getState().account).toBeNull();
    expect(pb.authStore.token).toBe('');
    if (action === 'logout') expect(await sessions.read(url)).toBeNull();
  }
});

test('expired/revoked sessions require login, but transient network failures retain credentials', async () => {
  const sessions = vault();
  const url = 'https://invalid.example';
  const revision = connect(url);
  await sessions.save(url, { token: jwt(1), account });
  globalThis.fetch = async () => { throw new Error('expired tokens must not make requests'); };
  await restoreServerSession(url, revision, sessions);
  expect(await sessions.read(url)).toBeNull();
  await sessions.save(url, { token: jwt(), account });
  globalThis.fetch = async () => Response.json({ message: 'Unauthorized' }, { status: 401 });
  await restoreServerSession(url, revision, sessions);
  expect(await sessions.read(url)).toBeNull();
  await sessions.save(url, { token: jwt(), account });
  globalThis.fetch = async () => { throw new TypeError('Network unavailable'); };
  await expect(restoreServerSession(url, revision, sessions)).rejects.toThrow();
  expect(await sessions.read(url)).not.toBeNull();
  expect(useServerStore.getState().account).toBeNull();
});

test('clearing server queries preserves gallery, database, albums and device thumbnails', () => {
  const client = new QueryClient();
  const local = [['local-database'], ['device-gallery', 'all'], ['device-albums', 'list'], ['media-thumbnail', 'device', 'asset']];
  const remote = [['media-items', 'https://one.example'], ['albums', 'https://one.example'], ['viewer-file-token'], ['media-thumbnail', 'remote', 'https://one.example'], ['backup-status', 'gallery']];
  for (const key of [...local, ...remote]) client.setQueryData(key, 'cached');
  clearServerQueries(client);
  for (const key of local) expect(client.getQueryData(key)).toBe('cached');
  for (const key of remote) expect(client.getQueryData(key)).toBeUndefined();
  client.clear();
});

test('preference migration preserves saved URL/grid, avoids SQLite on later writes, and does not revive removed values', () => {
  const legacy = memory(), current = memory();
  legacy.setItem('server', 'saved-url'); legacy.setItem('grid', 'six-columns');
  const storage = migratePreferences(current, legacy);
  expect(storage.getItem('server')).toBe('saved-url');
  expect(storage.getItem('grid')).toBe('six-columns');
  expect(legacy.getItem('server')).toBeNull();
  legacy.removeItem = () => { throw new Error('migration must not repeat SQLite writes'); };
  storage.setItem('server', 'new-url');
  expect(storage.getItem('server')).toBe('new-url');
  storage.removeItem('server');
  expect(storage.getItem('server')).toBeNull();
});

test('failed preference migration retains the original value for retry', () => {
  const legacy = memory(), current = memory();
  legacy.setItem('server', 'saved-url');
  const set = current.setItem;
  current.setItem = () => { throw new Error('disk write failed'); };
  const storage = migratePreferences(current, legacy);
  expect(() => storage.getItem('server')).toThrow('disk write failed');
  expect(legacy.getItem('server')).toBe('saved-url');
  current.setItem = set;
  expect(storage.getItem('server')).toBe('saved-url');
});
