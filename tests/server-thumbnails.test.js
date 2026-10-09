import { expect, test } from 'bun:test';
import { fetchServerThumbnail, retryServerThumbnail, serverThumbnailRetryDelay, ServerThumbnailError } from '../src/lib/server-thumbnail';
import { mediaThumbnailUrl } from '../src/helpers/media';

const jpeg = new Uint8Array([255, 216, 255, 224, 255, 217]);
const source = { uri: mediaThumbnailUrl('https://example.test/pb/', 'video/id'), headers: { Authorization: 'test-auth' } };
const controller = () => new AbortController();

test('images and video posters fetch only the authenticated thumbnail endpoint and preserve JPEG bytes', async () => {
  let url, options;
  const signal = controller().signal;
  const data = await fetchServerThumbnail(source, signal, () => {}, async (input, init) => {
    url = input; options = init; return new Response(jpeg, { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(jpeg.length) } });
  });
  expect(url).toBe('https://example.test/pb/api/media/video%2Fid/thumb');
  expect(url).not.toContain('/stream'); expect(options.headers.Authorization).toBe('test-auth');
  expect(options.signal).toBe(signal); expect(data).toEqual(jpeg);
});

test('short busy responses retry at Retry-After but long cooldowns and auth failures do not', async () => {
  let error;
  try { await fetchServerThumbnail(source, controller().signal, () => {}, async () => new Response('busy', { status: 503, headers: { 'Retry-After': '2' } })); }
  catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(ServerThumbnailError);
  expect(retryServerThumbnail(0, error)).toBe(true); expect(serverThumbnailRetryDelay(0, error)).toBe(2000);
  expect(retryServerThumbnail(3, error)).toBe(false);
  expect(retryServerThumbnail(0, new ServerThumbnailError('failed', 503, 300))).toBe(false);
  expect(retryServerThumbnail(0, new ServerThumbnailError('login', 401))).toBe(false);
});

test('errors, non-image responses and malformed JPEGs never fall back to original media', async () => {
  let requests = 0;
  for (const response of [new Response('Denied', { status: 403 }), new Response('html', { headers: { 'Content-Type': 'text/html' } }),
    new Response('not jpeg', { headers: { 'Content-Type': 'image/jpeg' } })]) {
    await expect(fetchServerThumbnail(source, controller().signal, () => {}, async (url) => {
      requests++; expect(url).toBe(source.uri); return response;
    })).rejects.toBeInstanceOf(ServerThumbnailError);
  }
  expect(requests).toBe(3);
});

test('oversized previews are rejected from headers or streamed bytes and streams are cancelled', async () => {
  await expect(fetchServerThumbnail(source, controller().signal, () => {}, async () => new Response(jpeg,
    { headers: { 'Content-Type': 'image/jpeg', 'Content-Length': String(2 * 1024 * 1024) } }))).rejects.toThrow('1 MiB');
  let cancelled = false;
  const stream = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024 + 1)); }, cancel() { cancelled = true; } });
  await expect(fetchServerThumbnail(source, controller().signal, () => {}, async () => new Response(stream,
    { headers: { 'Content-Type': 'image/jpeg' } }))).rejects.toThrow('1 MiB');
  expect(cancelled).toBe(true);
});

test('React Native response fallback still validates JPEGs without readable streams', async () => {
  expect(await fetchServerThumbnail(source, controller().signal, () => {}, async () => ({ ok: true,
    headers: new Headers({ 'Content-Type': 'image/jpeg' }), body: undefined, arrayBuffer: async () => jpeg.buffer }))).toEqual(jpeg);
});
