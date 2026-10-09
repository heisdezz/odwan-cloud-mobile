import { expect, test } from 'bun:test';
import { pocketbaseThumbnailSource, createThumbnailFileTokenCache } from '../src/lib/pocketbase-thumbnail';

const signal = () => new AbortController().signal;
const record = { id: 'record123', collectionId: 'collection123', collectionName: 'media_item', thumbs: 'preview_abc.jpg' };

test('saved thumbnails use SDK file URLs and missing ones retain the generation route', () => {
  const source = pocketbaseThumbnailSource('https://example.test/pb/', record, 'session-token');
  expect(source.uri).toBe('https://example.test/pb/api/files/collection123/record123/preview_abc.jpg');
  expect(source.fileAuth).toEqual({ serverUrl: 'https://example.test/pb/', authToken: 'session-token' });
  expect(source.headers).toBeUndefined();
  expect(pocketbaseThumbnailSource('https://example.test', { ...record, thumbs: '' }, 'auth')).toEqual({
    uri: 'https://example.test/api/media/record123/thumb', headers: { Authorization: 'auth' },
  });
});

test('one short-lived token serves concurrent protected thumbnail requests and renews after expiry', async () => {
  let calls = 0, time = 0;
  const resolve = createThumbnailFileTokenCache(async () => { calls++; return `file-token-${calls}`; }, () => time);
  const source = pocketbaseThumbnailSource('https://example.test', record, 'auth');
  const [a, b] = await Promise.all([resolve(source, signal()), resolve(source, signal())]);
  expect(calls).toBe(1);
  expect(a.uri).toEndWith('?token=file-token-1');
  expect(b.uri).toBe(a.uri);
  expect(a.headers).toBeUndefined();
  time = 60_001;
  expect((await resolve(source, signal())).uri).toEndWith('?token=file-token-2');
  expect(calls).toBe(2);
});

test('server or auth changes cannot reuse another session file token', async () => {
  const requests = [];
  const resolve = createThumbnailFileTokenCache(async (url, token) => { requests.push([url, token]); return `file-${requests.length}`; });
  const a = pocketbaseThumbnailSource('https://one.test', record, 'auth-one');
  await resolve(a, signal());
  await resolve(pocketbaseThumbnailSource('https://two.test', record, 'auth-one'), signal());
  const changed = await resolve(pocketbaseThumbnailSource('https://two.test', record, 'auth-two'), signal());
  expect(changed.uri).toEndWith('?token=file-3');
  expect(requests).toEqual([['https://one.test', 'auth-one'], ['https://two.test', 'auth-one'], ['https://two.test', 'auth-two']]);
});

test('failed token requests can retry and cancelled requests never publish a URL', async () => {
  let calls = 0;
  const resolve = createThumbnailFileTokenCache(async () => { if (++calls === 1) throw new Error('unauthorized'); return 'valid'; });
  const source = pocketbaseThumbnailSource('https://example.test', record, 'auth');
  await expect(resolve(source, signal())).rejects.toThrow('unauthorized');
  expect((await resolve(source, signal())).uri).toEndWith('?token=valid');
  const controller = new AbortController(); controller.abort();
  await expect(resolve(source, controller.signal)).rejects.toThrow('cancelled');
});

test('ordinary and on-demand sources do not request a protected file token', async () => {
  const resolve = createThumbnailFileTokenCache(async () => { throw new Error('unexpected token request'); });
  const source = { uri: 'https://example.test/api/media/id/thumb', headers: { Authorization: 'auth' } };
  expect(await resolve(source, signal())).toBe(source);
});
