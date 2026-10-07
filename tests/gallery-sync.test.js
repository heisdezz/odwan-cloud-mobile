import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanGallery } from '../src/lib/gallery-sync';
import { LOCAL_STORE_SCHEMA, GALLERY_INDEX_MIGRATION } from '../src/db/schema';
import { UPSERT_INDEXED_ASSET_SQL, UPSERT_GALLERY_INDEX_SQL, FINISH_GALLERY_SCAN_SQL, READ_GALLERY_SQL, READ_FULL_GALLERY_SQL, READ_GALLERY_BACKUPS_SQL } from '../src/db/queries';

const asset = (id, modifiedAt = 1, createdAt = 10) => ({ id, modifiedAt, createdAt,
  uri: `content://${id}`, filename: `${id}.jpg`, mediaType: 'image', width: 256, height: 256 });
function store() {
  const db = new Database(':memory:');
  db.exec(LOCAL_STORE_SCHEMA);
  db.exec(GALLERY_INDEX_MIGRATION);
  function write(assets, scanId) {
    db.transaction(() => {
      for (const a of assets) {
        db.run(UPSERT_INDEXED_ASSET_SQL, a.id, a.modifiedAt, a.filename, a.uri, a.mediaType, a.width, a.height, a.createdAt, 1);
        db.run(UPSERT_GALLERY_INDEX_SQL, a.id, a.modifiedAt, scanId);
      }
    })();
  }
  return { db, write, read: () => db.query(READ_GALLERY_SQL).all(121, 0) };
}

test('migration preserves versioned backup history and the gallery reads only current indexed versions', () => {
  const s = store();
  try {
    s.write([asset('old'), asset('changed')], 'first');
    s.db.run("INSERT INTO backup_status VALUES ('changed',1,'server','account','backed_up','remote','hash',NULL,1)");
    s.write([asset('new', 1, 20), asset('changed', 2)], 'second');
    s.db.run(FINISH_GALLERY_SCAN_SQL, 'second');
    expect(s.read().map((a) => [a.id, a.modifiedAt])).toEqual([['new', 1], ['changed', 2]]);
    expect(s.db.query('SELECT remote_id FROM backup_status').get()).toEqual({ remote_id: 'remote' });
    expect(s.db.query(READ_GALLERY_BACKUPS_SQL).all('server', 'account')).toHaveLength(0);
    s.db.run("INSERT INTO backup_status VALUES ('changed',2,'server','account','pending',NULL,NULL,NULL,2)");
    expect(s.db.query(READ_GALLERY_BACKUPS_SQL).all('server', 'account')).toEqual([{ asset_id: 'changed', status: 'pending' }]);
    expect(s.db.query(READ_GALLERY_BACKUPS_SQL).all('server', 'other')).toHaveLength(0);
    expect(s.db.query('SELECT COUNT(*) AS n FROM local_assets').get().n).toBe(4);
    expect(s.db.query('PRAGMA user_version').get().user_version).toBe(2);
    // Applying the migration again is safe.
    s.db.exec(GALLERY_INDEX_MIGRATION);
    expect(s.read()).toHaveLength(2);
  } finally { s.db.close(); }
});

test('subsequent scans skip unchanged metadata and still update renamed or edited assets', () => {
  const s = store();
  try {
    const a = asset('photo');
    s.write([a], 'first');
    const upsert = s.db.prepare(UPSERT_INDEXED_ASSET_SQL);
    expect(upsert.run(a.id, a.modifiedAt, a.filename, a.uri, a.mediaType, a.width, a.height, a.createdAt, 2).changes).toBe(0);
    expect(upsert.run(a.id, a.modifiedAt, 'renamed.jpg', a.uri, a.mediaType, 500, 500, a.createdAt, 3).changes).toBe(1);
    expect(s.read()[0].filename).toBe('renamed.jpg');
    expect(s.read()[0].width).toBe(500);
  } finally { s.db.close(); }
});

test('all device pages are indexed, and completing a scan removes missing phone media only', async () => {
  const s = store();
  try {
    s.write([asset('removed')], 'old');
    const count = await scanGallery({ initialCursor: 0, signal: new AbortController().signal,
      load: async (cursor) => cursor === 0 ? { assets: [asset('photo')], next: 60 } : { assets: [asset('video')] },
      write: async (assets) => s.write(assets, 'new'),
      finish: async () => s.db.run(FINISH_GALLERY_SCAN_SQL, 'new'),
    });
    expect(count).toBe(2);
    expect(s.read().map((a) => a.id)).toEqual(['video', 'photo']);
  } finally { s.db.close(); }
});

test('a failed scan keeps unseen cached media and allows a later successful retry', async () => {
  const s = store();
  try {
    s.write([asset('cached')], 'old');
    const options = { initialCursor: 0, signal: new AbortController().signal,
      load: async (cursor) => { if (cursor) throw new Error('media permission changed'); return { assets: [asset('new')], next: 60 }; },
      write: async (assets) => s.write(assets, 'retry'),
      finish: async () => s.db.run(FINISH_GALLERY_SCAN_SQL, 'retry'),
    };
    await expect(scanGallery(options)).rejects.toThrow('media permission changed');
    expect(s.read().map((a) => a.id)).toEqual(['new', 'cached']);
    await scanGallery({ ...options, load: async () => ({ assets: [asset('new')] }) });
    expect(s.read().map((a) => a.id)).toEqual(['new']);
  } finally { s.db.close(); }
});

test('cancellation while native media metadata loads prevents writes and pruning', async () => {
  const controller = new AbortController();
  let writes = 0, finishes = 0;
  await expect(scanGallery({ initialCursor: 0, signal: controller.signal,
    load: async () => { controller.abort(); return { assets: [asset('photo')] }; },
    write: async () => { writes++; }, finish: async () => { finishes++; },
  })).rejects.toThrow('cancelled');
  expect(writes).toBe(0);
  expect(finishes).toBe(0);
});

test('cancellation after a saved batch and repeated cursors never prune the cached gallery', async () => {
  let finishes = 0;
  const controller = new AbortController();
  await expect(scanGallery({ initialCursor: 0, signal: controller.signal,
    load: async () => ({ assets: [asset('photo')] }),
    write: async () => { controller.abort(); }, finish: async () => { finishes++; },
  })).rejects.toThrow('cancelled');
  await expect(scanGallery({ initialCursor: 0, signal: new AbortController().signal,
    load: async () => ({ assets: [], next: 0 }), write: async () => {}, finish: async () => { finishes++; },
  })).rejects.toThrow('repeated page cursor');
  expect(finishes).toBe(0);
});

test('a successful empty library scan clears the gallery without erasing historical asset records', async () => {
  const s = store();
  try {
    s.write([asset('removed')], 'old');
    await scanGallery({ initialCursor: 0, signal: new AbortController().signal,
      load: async () => ({ assets: [] }), write: async () => {},
      finish: async () => s.db.run(FINISH_GALLERY_SCAN_SQL, 'empty'),
    });
    expect(s.read()).toHaveLength(0);
    expect(s.db.query('SELECT COUNT(*) AS n FROM local_assets').get().n).toBe(1);
  } finally { s.db.close(); }
});

test('the next app session can page its saved gallery without querying the phone library', () => {
  const directory = mkdtempSync(join(tmpdir(), 'odwan-gallery-'));
  const path = join(directory, 'gallery.db');
  let db = new Database(path);
  try {
    db.exec(LOCAL_STORE_SCHEMA);
    db.exec(GALLERY_INDEX_MIGRATION);
    db.transaction(() => {
      for (let i = 0; i < 250; i++) {
        const a = asset(`photo-${i}`, 1, i);
        db.run(UPSERT_INDEXED_ASSET_SQL, a.id, a.modifiedAt, a.filename, a.uri, a.mediaType, a.width, a.height, a.createdAt, 1);
        db.run(UPSERT_GALLERY_INDEX_SQL, a.id, a.modifiedAt, 'saved');
      }
    })();
    db.close();
    db = new Database(path);
    const first = db.query(READ_GALLERY_SQL).all(121, 0);
    const next = db.query(READ_GALLERY_SQL).all(121, 120);
    expect(first).toHaveLength(121);
    expect(first[0].id).toBe('photo-249');
    expect(next[0].id).toBe('photo-129');
    expect(db.query(READ_GALLERY_SQL).all(121, 240)).toHaveLength(10);
    const full = db.query(READ_FULL_GALLERY_SQL).all();
    expect(full).toHaveLength(250);
    expect(full[249].id).toBe('photo-0');
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
