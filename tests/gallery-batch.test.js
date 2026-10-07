import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { writeGalleryBatch } from '../src/db/gallery-index';
import { LOCAL_STORE_SCHEMA, GALLERY_INDEX_MIGRATION } from '../src/db/schema';
import { FINISH_GALLERY_SCAN_SQL, READ_GALLERY_SQL } from '../src/db/queries';
import { scanGallery } from '../src/lib/gallery-sync';
import { waitForGalleryIdle } from '../src/lib/gallery-scheduler';

const asset = (i) => ({ id: `id-${i}`, modifiedAt: 1, createdAt: i, filename: `photo's ${i}.jpg`,
  uri: `content://media/${i}`, mediaType: 'image', width: 100, height: 200 });
function store(failIndex = false) {
  const db = new Database(':memory:');
  db.exec(LOCAL_STORE_SCHEMA);
  db.exec(GALLERY_INDEX_MIGRATION);
  let calls = 0;
  const native = {
    runAsync: async (sql, ...params) => {
      calls++;
      if (failIndex && sql.startsWith('INSERT INTO gallery_index')) throw new Error('index write failed');
      return db.run(sql, ...params);
    },
    withTransactionAsync: async (work) => {
      db.exec('BEGIN');
      try { await work(); db.exec('COMMIT'); }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, native, calls: () => calls };
}

test('a 60-asset scan page uses two native writes and safely binds names/URIs', async () => {
  const s = store();
  try {
    const assets = Array.from({ length: 60 }, (_, i) => asset(i));
    assets[0].filename = "quote's \"name\" 😀\n.jpg";
    await writeGalleryBatch(s.native, assets, 'scan', 123);
    expect(s.calls()).toBe(2);
    expect(s.db.query(READ_GALLERY_SQL).all(121, 0)).toHaveLength(60);
    expect(s.db.query("SELECT filename, last_seen_at FROM local_assets WHERE id='id-0'").get()).toEqual({ filename: assets[0].filename, last_seen_at: 123 });
  } finally { s.db.close(); }
});

test('bulk rescans preserve backup history, skip unchanged metadata, and select the edited version', async () => {
  const s = store();
  try {
    const a = asset(1);
    await writeGalleryBatch(s.native, [a], 'first', 1);
    s.db.run("INSERT INTO backup_status VALUES ('id-1',1,'server','account','backed_up','remote','hash',NULL,1)");
    await writeGalleryBatch(s.native, [a], 'second', 2);
    expect(s.db.query('SELECT last_seen_at FROM local_assets').get().last_seen_at).toBe(1);
    await writeGalleryBatch(s.native, [{ ...a, modifiedAt: 2, filename: 'edited.jpg' }], 'third', 3);
    s.db.run(FINISH_GALLERY_SCAN_SQL, 'third');
    expect(s.db.query(READ_GALLERY_SQL).all(121, 0)[0].modifiedAt).toBe(2);
    expect(s.db.query('SELECT remote_id FROM backup_status').get().remote_id).toBe('remote');
  } finally { s.db.close(); }
});

test('bulk metadata and index writes roll back together, and empty pages make no writes', async () => {
  const s = store(true);
  try {
    await writeGalleryBatch(s.native, [], 'empty');
    expect(s.calls()).toBe(0);
    await expect(writeGalleryBatch(s.native, [asset(1)], 'failed')).rejects.toThrow('index write failed');
    expect(s.db.query('SELECT COUNT(*) AS n FROM local_assets').get().n).toBe(0);
  } finally { s.db.close(); }
});

test('each scan page waits its turn before loading or writing native metadata', async () => {
  const events = [];
  await scanGallery({ initialCursor: 0, signal: new AbortController().signal,
    waitForTurn: async () => { events.push('idle'); },
    load: async (cursor) => { events.push(`load-${cursor}`); return { assets: [asset(cursor)], next: cursor === 0 ? 1 : undefined }; },
    write: async () => { events.push('write'); }, finish: async () => { events.push('finish'); },
  });
  expect(events).toEqual(['idle', 'load-0', 'write', 'idle', 'load-1', 'write', 'finish']);
});

test('cancelling a scheduled page prevents native media work and completes promptly', async () => {
  const controller = new AbortController();
  let loaded = false;
  const request = scanGallery({ initialCursor: 0, signal: controller.signal,
    waitForTurn: () => waitForGalleryIdle(controller.signal, 1000),
    load: async () => { loaded = true; return { assets: [] }; }, write: async () => {}, finish: async () => {},
  });
  controller.abort();
  await expect(request).rejects.toThrow('cancelled');
  expect(loaded).toBe(false);
});
