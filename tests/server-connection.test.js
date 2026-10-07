import { afterEach, expect, test } from 'bun:test';
import { normalizeServerUrl, testServerConnection } from '../src/lib/server-connection';
import { useServerStore } from '../src/stores/server-store';
import { pb } from '../src/client/pb';
const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; useServerStore.getState().setUrlInput(''); });

test('normalizes trailing slashes and preserves a server base path', () => {
  expect(normalizeServerUrl(' https://example.com/pb/// ')).toBe('https://example.com/pb');
});
test('rejects malformed URLs, protocols, credentials, queries and fragments', () => {
  for (const url of ['example.com', 'ftp://example.com', 'https://user:pass@example.com', 'https://example.com?q=1', 'https://example.com/#x']) {
    expect(() => normalizeServerUrl(url)).toThrow();
  }
});
test('requires the connection endpoint to return ok', async () => {
  let called;
  globalThis.fetch = async (url) => { called = url; return new Response('ok'); };
  expect(await testServerConnection('https://example.com/')).toBe('https://example.com');
  expect(called).toBe('https://example.com/api/test/connection');
  globalThis.fetch = async () => new Response('"ok"');
  expect(await testServerConnection('https://example.com')).toBe('https://example.com');
});
test('rejects unsuccessful HTTP and unexpected bodies', async () => {
  globalThis.fetch = async () => new Response('ok', { status: 500 });
  await expect(testServerConnection('https://example.com')).rejects.toThrow('HTTP 500');
  globalThis.fetch = async () => new Response('<html>ok</html>');
  await expect(testServerConnection('https://example.com')).rejects.toThrow('did not return ok');
});
test('reports an unreachable server', async () => {
  globalThis.fetch = async () => { throw new TypeError('fetch failed'); };
  await expect(testServerConnection('https://example.com')).rejects.toThrow('Could not reach');
});
test('editing the URL discards old verification and authentication', () => {
  const state = useServerStore.getState();
  state.setUrlInput('https://first.example');
  const revision = state.beginCheck();
  expect(state.verify('https://first.example', revision)).toBe(true);
  state.setAccount({ id: 'test', email: 'test@example.com' });
  pb.authStore.save('test-token');
  state.setUrlInput('https://second.example');
  expect(state.verify('https://first.example', revision)).toBe(false);
  expect(useServerStore.getState().verifiedUrl).toBeNull();
  expect(useServerStore.getState().account).toBeNull();
  expect(pb.authStore.token).toBe('');
});
test('retesting clears prior verification and ignores older responses', () => {
  const state = useServerStore.getState();
  state.setUrlInput('https://example.com');
  const first = state.beginCheck();
  state.verify('https://example.com', first);
  const second = state.beginCheck();
  expect(useServerStore.getState().verifiedUrl).toBeNull();
  expect(state.verify('https://example.com', first)).toBe(false);
  expect(state.verify('https://example.com', second)).toBe(true);
});

test('superuser login sends credentials to the verified server and saves the session', async () => {
  const { authenticateSuperuser } = await import('../src/lib/authenticate-superuser');
  const state = useServerStore.getState();
  state.setUrlInput('https://example.com');
  const revision = state.beginCheck();
  state.verify('https://example.com', revision);
  let endpoint, body;
  globalThis.fetch = async (url, options) => {
    endpoint = url; body = JSON.parse(options.body);
    return Response.json({ token: 'test-token', record: { id: 'superuser', email: 'test@example.com' } });
  };
  await authenticateSuperuser({ verifiedUrl: 'https://example.com', revision, email: ' test@example.com ', password: 'test-password' });
  expect(endpoint).toBe('https://example.com/api/collections/_superusers/auth-with-password');
  expect(body.identity).toBe('test@example.com');
  expect(body.password).toBe('test-password');
  expect(useServerStore.getState().account.id).toBe('superuser');
  expect(pb.authStore.token).toBe('test-token');
});
test('login response from a changed server cannot install an auth token', async () => {
  const { authenticateSuperuser } = await import('../src/lib/authenticate-superuser');
  const state = useServerStore.getState();
  state.setUrlInput('https://example.com');
  const revision = state.beginCheck();
  state.verify('https://example.com', revision);
  globalThis.fetch = async () => {
    state.setUrlInput('https://different.example');
    return Response.json({ token: 'stale-token', record: { id: 'superuser', email: 'test@example.com' } });
  };
  await expect(authenticateSuperuser({ verifiedUrl: 'https://example.com', revision, email: 'test@example.com', password: 'test-password' })).rejects.toThrow('server changed');
  expect(pb.authStore.token).toBe('');
  expect(useServerStore.getState().account).toBeNull();
});
test('failed authentication reports a useful error and keeps the session empty', async () => {
  const { authenticateSuperuser } = await import('../src/lib/authenticate-superuser');
  globalThis.fetch = async () => Response.json({ message: 'Failed to authenticate.' }, { status: 400 });
  await expect(authenticateSuperuser({ verifiedUrl: 'https://example.com', revision: 0, email: 'test@example.com', password: 'wrong' })).rejects.toThrow('superuser email and password');
  expect(pb.authStore.token).toBe('');
});
