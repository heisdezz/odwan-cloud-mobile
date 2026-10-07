import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { syncGalleryUpdates } from '../src/lib/gallery-updates';
import { createGallerySyncQueue } from '../src/lib/gallery-sync-queue';
import { LOCAL_STORE_SCHEMA, GALLERY_INDEX_MIGRATION, GALLERY_SYNC_MIGRATION } from '../src/db/schema';
import { RECONCILE_GALLERY_IDS_SQL, SAVE_GALLERY_SYNC_SQL } from '../src/db/queries';
import { writeGalleryBatch } from '../src/db/gallery-index';

const asset = (id, modifiedAt = 1) => ({ id, modifiedAt, filename: `${id}.jpg`, uri: `content://${id}`, mediaType: 'image', width: 10, height: 10, createdAt: 1 });
test('update pass reads only changed/new metadata, detects old imports and safely removes deleted IDs', async () => {
  const db = new Database(':memory:');
  db.exec(LOCAL_STORE_SCHEMA + GALLERY_INDEX_MIGRATION + GALLERY_SYNC_MIGRATION);
  const adapter = { runAsync: async (sql, ...values) => db.run(sql, ...values), withTransactionAsync: async (fn) => { db.exec('BEGIN'); try { await fn(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; } } };
  try {
    await writeGalleryBatch(adapter, [asset('unchanged'), asset('edited'), asset('deleted')], 'initial');
    db.run("INSERT INTO backup_status VALUES ('deleted',1,'server','account','backed_up','remote','hash',NULL,1)");
    db.run(SAVE_GALLERY_SYNC_SQL, 100, 'all');
    const written = [], loaded = [];
    const count = await syncGalleryUpdates({ signal: new AbortController().signal, knownIds: ['unchanged', 'edited', 'deleted'],
      loadChanged: async () => ({ assets: [asset('edited', 2)] }),
      loadIds: async () => ({ ids: ['unchanged', 'edited', 'old-import'] }),
      loadMissing: async (ids) => { loaded.push(...ids); return ids.map((id) => asset(id)); },
      write: async (assets) => { written.push(...assets.map((a) => a.id)); await writeGalleryBatch(adapter, assets, 'delta'); },
      finish: async (ids) => adapter.withTransactionAsync(async () => {
        db.run(RECONCILE_GALLERY_IDS_SQL, JSON.stringify(ids)); db.run(SAVE_GALLERY_SYNC_SQL, 200, 'all');
      }), waitForTurn: async () => {},
    });
    expect(count).toBe(2);
    expect(written).toEqual(['edited', 'old-import']);
    expect(loaded).toEqual(['old-import']);
    expect(db.query('SELECT asset_id FROM gallery_index ORDER BY asset_id').all()).toEqual([{ asset_id: 'edited' }, { asset_id: 'old-import' }, { asset_id: 'unchanged' }]);
    expect(db.query('SELECT remote_id FROM backup_status').get().remote_id).toBe('remote');
    expect(db.query('SELECT checked_at FROM gallery_sync_state').get().checked_at).toBe(200);
  } finally { db.close(); }
});

test('cancelled or failed ID reconciliation never commits a checkpoint or prunes cached items', async () => {
  for (const failure of ['cancel', 'error']) {
    const controller = new AbortController();
    let finished = false;
    await expect(syncGalleryUpdates({ signal: controller.signal, knownIds: ['cached'],
      loadChanged: async () => ({ assets: [] }),
      loadIds: async () => { if (failure === 'error') throw new Error('MediaStore unavailable'); controller.abort(); return { ids: [] }; },
      loadMissing: async () => [], write: async () => {}, finish: async () => { finished = true; }, waitForTurn: async () => {},
    })).rejects.toThrow();
    expect(finished).toBe(false);
  }
});

test('library event bursts wait for the initial scan and merge into one update pass', async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const runs = [];
  const queue = createGallerySyncQueue(async (mode) => { runs.push(mode); if (runs.length === 1) await gate; }, new AbortController().signal);
  const done = queue.request('full');
  await Promise.resolve();
  queue.request('updates'); queue.request('updates'); queue.request('updates');
  expect(runs).toEqual(['full']);
  release(); await done;
  expect(runs).toEqual(['full', 'updates']);
});

test('an explicit full refresh takes precedence over pending incremental work', async () => {
  const runs = [];
  const queue = createGallerySyncQueue(async (mode) => { runs.push(mode); }, new AbortController().signal);
  const done = queue.request('updates'); queue.request('full'); queue.request('updates');
  await done;
  expect(runs).toEqual(['full']);
});

test('aborting a sync queue prevents pending scans from running', async () => {
  const controller = new AbortController();
  const runs = [];
  const queue = createGallerySyncQueue(async (mode) => { runs.push(mode); controller.abort(); queue.request('updates'); }, controller.signal);
  await queue.request('full');
  expect(runs).toEqual(['full']);
});
