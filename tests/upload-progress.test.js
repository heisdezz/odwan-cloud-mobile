import { expect, test } from 'bun:test';
import { sendUploadWithProgress } from '../src/lib/upload-request';
import { createUploadProgressReporter, uploadProgressLabel } from '../src/lib/upload-progress';
import { createUploadProgressStore } from '../src/stores/upload-progress-store';
import { UploadConnectionError, UploadError } from '../src/lib/upload-types';

const result = { backend: 's3', bucket: 'test', key: 'tests/file', etag: 'etag', size_bytes: 100,
  hash: 'a'.repeat(64), status: 'success', duplicate: false, media_id: 'media', stream_url: '', view_url: '' };
class Request {
  upload = {}; headers = {}; status = 0; responseText = ''; aborted = false;
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(key, value) { this.headers[key] = value; }
  send(body) { this.body = body; }
  abort() { this.aborted = true; this.onabort?.(); }
  progress(loaded, total, lengthComputable = true) { this.upload.onprogress?.({ loaded, total, lengthComputable }); }
  respond(status, body) { this.status = status; this.responseText = typeof body === 'string' ? body : JSON.stringify(body); this.onload?.(); }
}
function transfer() {
  const request = new Request(), controller = new AbortController(), updates = [];
  const body = new FormData(); body.append('file', new Blob(['data']), 'clip.mp4');
  const promise = sendUploadWithProgress({ serverUrl: 'https://example.test/pb', testToken: 'test-secret',
    objectKey: 'tests/clip with space.mp4', body, signal: controller.signal, onProgress: (update) => updates.push(update) }, () => request);
  return { request, controller, updates, promise, body };
}

test('multipart progress preserves the upload contract and 100 percent waits for server confirmation', async () => {
  const { request, updates, promise, body } = transfer(); let completed = false;
  void promise.then(() => { completed = true; });
  expect(request.method).toBe('POST');
  expect(request.url).toBe('https://example.test/pb/api/test/s3/upload?key=tests%2Fclip+with+space.mp4');
  expect(request.headers).toEqual({ 'X-S3-Test-Token': 'test-secret', Accept: 'application/json' });
  expect(request.body).toBe(body); // Transport supplies its own multipart boundary.
  request.progress(30, 100); request.progress(100, 100); await Promise.resolve();
  expect(updates.map((update) => update.percent)).toEqual([30, 100]); expect(completed).toBe(false);
  expect(uploadProgressLabel(updates.at(-1))).toContain('Saving to cloud');
  request.respond(200, result); expect(await promise).toEqual(result);
  expect(request.upload.onprogress).toBeNull(); expect(request.onload).toBeNull();
});

test('aborting a sending request cancels native work and ignores late progress or success', async () => {
  const { request, controller, updates, promise } = transfer();
  const lateProgress = request.upload.onprogress, lateLoad = request.onload;
  controller.abort(); await expect(promise).rejects.toThrow('paused'); expect(request.aborted).toBe(true);
  lateProgress({ loaded: 100, total: 100, lengthComputable: true });
  request.status = 200; request.responseText = JSON.stringify(result); lateLoad();
  expect(updates).toEqual([]);
});

test('an already-paused request does not construct or send an upload', async () => {
  const controller = new AbortController(); controller.abort(); let constructed = 0;
  await expect(sendUploadWithProgress({ serverUrl: 'https://example.test', testToken: '', objectKey: 'key',
    body: new FormData(), signal: controller.signal, onProgress: () => {} }, () => { constructed++; return new Request(); })).rejects.toThrow('paused');
  expect(constructed).toBe(0);
});

test('connection failures remain retryable while HTTP errors preserve backend messages', async () => {
  const lost = transfer(); lost.request.onerror();
  await expect(lost.promise).rejects.toBeInstanceOf(UploadConnectionError);
  const denied = transfer(); denied.request.respond(401, { error: 'Upload token rejected.' });
  await expect(denied.promise).rejects.toMatchObject({ status: 401, message: 'Upload token rejected.' });
  const invalid = transfer(); invalid.request.respond(200, { status: 'success' });
  await expect(invalid.promise).rejects.toBeInstanceOf(UploadError);
  const html = transfer(); html.request.respond(502, '<html>Gateway error</html>');
  await expect(html.promise).rejects.toMatchObject({ status: 502 });
});

test('unknown request lengths show bytes without inventing a percentage', async () => {
  const { request, updates, promise } = transfer(); request.progress(2048, 0, false);
  expect(updates[0]).toEqual({ loaded: 2048, total: null, percent: null });
  expect(uploadProgressLabel(updates[0])).toBe('2 KB sent');
  request.respond(200, { ...result, status: 'duplicate', duplicate: true });
  expect((await promise).duplicate).toBe(true);
});

test('progress is bounded, throttled and always publishes the first completion event', () => {
  let time = 0; const updates = [];
  const report = createUploadProgressReporter((value) => updates.push(value), () => time);
  report(10, 100); report(20, 100); expect(updates).toHaveLength(1);
  time = 250; report(50, 100); report(100, 100); report(100, 100);
  report(NaN, 100); report(-1, 100);
  expect(updates.map((value) => value.percent)).toEqual([10, 50, 100]);
  time = 500; report(20, 100); expect(updates.at(-1).loaded).toBe(100);
});

test('only the active upload receives progress and retries reset its previous percentage', () => {
  const store = createUploadProgressStore(); store.start('first');
  store.update('first', { loaded: 100, total: 100, percent: 100 });
  store.start('second'); store.update('first', { loaded: 100, total: 100, percent: 100 });
  expect(store.getState()).toMatchObject({ id: 'second', progress: { loaded: 0, percent: null } });
  store.clear(); store.update('second', { loaded: 50, total: 100, percent: 50 });
  expect(store.getState().progress).toBeNull();
  store.start('first'); expect(store.getState().progress.loaded).toBe(0);
});
