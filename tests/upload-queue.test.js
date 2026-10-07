import { afterEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createUploadRepository } from '../src/db/upload-queue';
import { UPLOAD_QUEUE_MIGRATION, UPLOAD_HISTORY_MIGRATION } from '../src/db/schema';
import { createUploadWorker } from '../src/lib/upload-worker';
import { resolveUploadAlbum, sendUpload } from '../src/lib/upload-api';
import { UploadError } from '../src/lib/upload-types';
import PocketBase, { BaseAuthStore } from 'pocketbase';

const connections = [];
afterEach(() => { for (const db of connections.splice(0)) db.close(); });
const scope = { serverUrl: 'https://cloud.example/pb', accountId: 'admin' };
const result = { backend: 's3', bucket: 'photos', key: 'tests/confirmed/photo.jpg', etag: 'etag', size_bytes: 5,
  hash: 'a'.repeat(64), status: 'success', duplicate: false, media_id: 'remote-photo', stream_url: '/stream', view_url: '/view' };
const job = (id, other = {}) => ({ ...scope, id, asset: { id, modifiedAt: 100, filename: `${id}.jpg`, uri: `file:///${id}.jpg`, mediaType: 'image', width: 10, height: 20, createdAt: 50 },
  albumId: 'album', albumName: 'Camera', objectKey: `tests/${id}/${id}.jpg`, state: 'queued', result: null, error: null, createdAt: 500, ...other });
const setup = () => {
  const db = new Database(':memory:'); connections.push(db); db.exec(UPLOAD_QUEUE_MIGRATION); db.exec(UPLOAD_HISTORY_MIGRATION);
  const adapter = { runAsync: async (sql, ...params) => db.query(sql).run(...params), getAllAsync: async (sql, ...params) => db.query(sql).all(...params) };
  const repository = createUploadRepository((task) => task(adapter));
  return { db, repository };
};

function worker(repository, overrides = {}) {
  return createUploadWorker({ repository, scope: () => scope,
    upload: async () => result, organize: async () => {}, confirm: async () => {}, changed: () => {}, ...overrides });
}

test('bulk enqueue preserves original snapshots and deduplicates each asset version/destination/account', async () => {
  const { repository } = setup();
  await repository.enqueue([job('one'), job('two'), job('ignored', { asset: job('one').asset }), job('other-account', { accountId: 'other' }), job('other-version', { asset: { ...job('one').asset, modifiedAt: 200 } })]);
  const jobs = await repository.list(scope);
  expect(jobs.map((item) => item.id)).toEqual(['one', 'two', 'other-version']);
  expect(jobs[0].asset).toEqual(job('one').asset);
  expect(jobs[0].objectKey).toBe(job('one').objectKey);
  expect((await repository.list({ ...scope, accountId: 'other' })).length).toBe(1);
});

test('recovery keeps confirmed server results and keys without confusing another account', async () => {
  const { repository, db } = setup();
  await repository.enqueue([job('one'), job('two')]);
  await repository.update('one', 'organizing', result);
  await repository.update('two', 'uploading');
  const reopened = createUploadRepository((task) => task({ runAsync: async (sql, ...params) => db.query(sql).run(...params), getAllAsync: async (sql, ...params) => db.query(sql).all(...params) }));
  await reopened.recover();
  const saved = await reopened.list(scope);
  expect(saved.map((item) => item.state)).toEqual(['queued', 'queued']);
  expect(saved[0].result).toEqual(result);
  expect(saved[1].objectKey).toBe(job('two').objectKey);
});

test('repeated wakeups never overlap transfers or start a second item before organization completes', async () => {
  const { repository } = setup();
  await repository.enqueue([job('one'), job('two'), job('other', { accountId: 'different' })]);
  const events = [];
  let release, active = 0, maximum = 0;
  const queue = worker(repository, { upload: async (item) => {
    active++; maximum = Math.max(active, maximum); events.push(`upload:${item.id}`);
    if (item.id === 'one') await new Promise((resolve) => { release = resolve; });
    active--; return result;
  }, organize: async (item) => { events.push(`album:${item.id}`); }, confirm: async (item) => { events.push(`confirm:${item.id}`); } });
  const first = queue.wake();
  while (!release) await Promise.resolve();
  const second = queue.wake();
  expect(events).toEqual(['upload:one']);
  release(); await Promise.all([first, second]);
  expect(maximum).toBe(1);
  expect(events).toEqual(['upload:one', 'confirm:one', 'album:one', 'upload:two', 'confirm:two', 'album:two']);
  expect((await repository.list(scope)).every((item) => item.state === 'success')).toBe(true);
  expect((await repository.list({ ...scope, accountId: 'different' }))[0].state).toBe('queued');
});

test('retrying album assignment uses the confirmed record without uploading bytes again', async () => {
  const { repository } = setup(); await repository.enqueue([job('one')]);
  let uploads = 0, assignments = 0, confirmations = 0;
  const queue = worker(repository, { upload: async () => { uploads++; return { ...result, duplicate: true, status: 'duplicate' }; },
    confirm: async () => { confirmations++; },
    organize: async () => { assignments++; if (assignments === 1) throw new Error('Album permission denied'); } });
  await queue.wake();
  let saved = (await repository.list(scope))[0];
  expect(confirmations).toBe(1);
  expect(saved.state).toBe('error'); expect(saved.result.media_id).toBe(result.media_id);
  await repository.retry(scope); await queue.wake();
  saved = (await repository.list(scope))[0];
  expect(saved.state).toBe('success'); expect(uploads).toBe(1); expect(assignments).toBe(2);
});

test('pause aborts an active transfer, preserves its key, and resumes exactly once', async () => {
  const { repository } = setup(); await repository.enqueue([job('one')]);
  let started, calls = 0;
  const queue = worker(repository, { upload: async (_, signal) => {
    calls++; if (calls > 1) return result;
    started = true;
    return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }));
  } });
  const sending = queue.wake(); while (!started) await Promise.resolve(); queue.stop(); await sending;
  expect((await repository.list(scope))[0].state).toBe('queued');
  expect((await repository.list(scope))[0].objectKey).toBe(job('one').objectKey);
  await queue.wake(); expect((await repository.list(scope))[0].state).toBe('success'); expect(calls).toBe(2);
});

test('queued removal and a late claim cannot start a cancelled item', async () => {
  const { repository } = setup(); await repository.enqueue([job('one')]);
  const claimed = await repository.claim(scope);
  await repository.remove('one');
  expect((await repository.list(scope)).length).toBe(1);
  expect(claimed.id).toBe('one');
  await repository.update('one', 'queued');
  let release, uploads = 0;
  const original = repository.claim;
  repository.claim = async (scope) => {
    const next = await original(scope);
    await new Promise((resolve) => { release = resolve; });
    return next;
  };
  const queue = worker(repository, { upload: async () => { uploads++; return result; } });
  const pending = queue.wake(); while (!release) await Promise.resolve(); queue.stop(); release(); await pending;
  expect(uploads).toBe(0); expect((await repository.list(scope))[0].state).toBe('queued');
  await repository.remove('one'); expect(await repository.list(scope)).toEqual([]);
});

test('switching accounts stops the previous upload before assigning an album or confirming backup', async () => {
  const { repository } = setup(); await repository.enqueue([job('one')]);
  let current = scope, assignments = 0, confirmations = 0;
  await worker(repository, { scope: () => current,
    upload: async () => { current = { ...scope, accountId: 'different' }; return result; },
    confirm: async () => { confirmations++; },
    organize: async () => { assignments++; }, confirm: async () => { confirmations++; },
  }).wake();
  const saved = (await repository.list(scope))[0];
  expect(saved.state).toBe('queued'); expect(saved.result).toEqual(result);
  expect(assignments).toBe(0); expect(confirmations).toBe(0);
});

test('a rejected upload token fails one item and leaves the rest queued for retry', async () => {
  const { repository } = setup(); await repository.enqueue([job('one'), job('two')]);
  let calls = 0;
  await worker(repository, { upload: async () => { calls++; throw new UploadError('Upload token rejected', 401); } }).wake();
  expect(calls).toBe(1);
  expect((await repository.list(scope)).map((item) => item.state)).toEqual(['error', 'queued']);
});

test('multipart upload sends only the test credential, preserves base paths, and trusts confirmed duplicate ids', async () => {
  const body = new FormData(); body.append('file', new Blob(['photo']), 'one.jpg');
  const response = await sendUpload({ ...scope, testToken: 'test-secret', objectKey: job('one').objectKey, body, signal: new AbortController().signal }, async (url, options) => {
    expect(url).toBe('https://cloud.example/pb/api/test/s3/upload?key=tests%2Fone%2Fone.jpg');
    expect(options.headers).toEqual({ 'X-S3-Test-Token': 'test-secret' });
    expect(options.body).toBe(body);
    return Response.json({ ...result, status: 'duplicate', duplicate: true });
  });
  expect(response.media_id).toBe(result.media_id); expect(response.key).toBe(result.key);
});

test('malformed success responses and backend errors cannot mark an upload complete', async () => {
  const options = { ...scope, testToken: 'test', objectKey: job('one').objectKey, body: new FormData(), signal: new AbortController().signal };
  await expect(sendUpload(options, async () => Response.json({ status: 'success', media_id: 'id' }))).rejects.toThrow('did not confirm');
  await expect(sendUpload(options, async () => Response.json({ error: 'Too large' }, { status: 413 }))).rejects.toThrow('Too large');
});

test('matching album names reuses an existing case-insensitive name and creates missing ones', async () => {
  const api = new PocketBase(scope.serverUrl, new BaseAuthStore());
  let created = 0;
  const collection = { getFullList: async () => [{ id: 'existing', name: 'CAMERA' }], create: async (data) => { created++; return { id: 'new', name: data.name }; } };
  api.collection = () => collection;
  expect(await resolveUploadAlbum(api, ' Camera ')).toEqual({ id: 'existing', name: 'CAMERA' }); expect(created).toBe(0);
  expect(await resolveUploadAlbum(api, 'Travel')).toEqual({ id: 'new', name: 'Travel' }); expect(created).toBe(1);
  await expect(resolveUploadAlbum(api, ' ')).rejects.toThrow('album name');
});


test('queue survives closing and reopening its SQLite file', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'odwan-upload-'));
  const path = join(directory, 'queue.db');
  let db = new Database(path);
  const openRepository = () => createUploadRepository((task) => task({
    runAsync: async (sql, ...params) => db.query(sql).run(...params),
    getAllAsync: async (sql, ...params) => db.query(sql).all(...params),
  }));
  try {
    db.exec(UPLOAD_QUEUE_MIGRATION); db.exec(UPLOAD_HISTORY_MIGRATION);
    const original = openRepository();
    await original.enqueue([job('durable')]);
    await original.update('durable', 'organizing', result);
    db.close();
    db = new Database(path);
    const restored = openRepository();
    await restored.recover();
    const [saved] = await restored.list(scope);
    expect(saved.state).toBe('queued');
    expect(saved.objectKey).toBe(job('durable').objectKey);
    expect(saved.asset).toEqual(job('durable').asset);
    expect(saved.result).toEqual(result);
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});


test('successful uploads are archived atomically and survive clearing the queue, scoped to each account', async () => {
  const { repository, db } = setup();
  await repository.enqueue([job('one'), job('two'), job('other', { accountId: 'other' })]);
  await repository.update('one', 'success', result);
  await repository.update('two', 'organizing', result);
  await repository.update('other', 'success', result);
  let history = await repository.history(scope);
  expect(history.map((item) => item.id)).toEqual(['one']);
  expect((await repository.current(scope)).map((item) => item.id)).toEqual(['two']);
  expect(history[0].result).toEqual(result);
  expect(history[0].completedAt).toBeGreaterThan(0);
  await repository.clearCompleted(scope);
  expect((await repository.list(scope)).map((item) => item.id)).toEqual(['two']);
  expect((await repository.history(scope)).map((item) => item.id)).toEqual(['one']);
  expect((await repository.history({ ...scope, accountId: 'other' })).map((item) => item.id)).toEqual(['other']);
  db.exec(UPLOAD_HISTORY_MIGRATION);
  expect(await repository.history(scope)).toHaveLength(1);
});

test('history migration adopts existing completed queue entries but never pending or failed ones', async () => {
  const db = new Database(':memory:'); connections.push(db); db.exec(UPLOAD_QUEUE_MIGRATION);
  const adapter = { runAsync: async (sql, ...params) => db.query(sql).run(...params), getAllAsync: async (sql, ...params) => db.query(sql).all(...params) };
  const repository = createUploadRepository((task) => task(adapter));
  await repository.enqueue([job('done'), job('failed')]);
  await repository.update('done', 'success', result);
  await repository.update('failed', 'error', result, 'Album assignment failed');
  db.exec(UPLOAD_HISTORY_MIGRATION);
  expect((await repository.history(scope)).map((item) => item.id)).toEqual(['done']);
  await repository.clearCompleted(scope);
  expect((await repository.history(scope))[0].result.media_id).toBe(result.media_id);
});
