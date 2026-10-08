import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createDeviceAlbumCache } from '../src/db/device-album-cache';
import { DEVICE_ALBUM_MIGRATION, LOCAL_STORE_SCHEMA } from '../src/db/schema';
import { createCachedAlbumLoader } from '../src/lib/cached-album-loader';

const asset = (id, modifiedAt = 1) => ({ id, modifiedAt, uri: `content://media/${id}`, filename: `Photo ${id}.jpg`,
  mediaType: 'image', width: 200, height: 100, createdAt: Number(id) });
function setup() {
  const db = new Database(':memory:'); db.exec(LOCAL_STORE_SCHEMA); db.exec(DEVICE_ALBUM_MIGRATION);
  const adapter = {
    runAsync: async (sql, ...params) => db.run(sql, ...params),
    getFirstAsync: async (sql, ...params) => db.query(sql).get(...params),
    getAllAsync: async (sql, ...params) => db.query(sql).all(...params),
    withTransactionAsync: async (task) => {
      db.exec('BEGIN');
      try { await task(); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, adapter, cache: createDeviceAlbumCache((task) => task(adapter)) };
}

test('album migration and snapshots preserve backup history, ordering, edited versions and empty albums', async () => {
  const { db, cache } = setup();
  try {
    const signal = new AbortController().signal;
    expect(await cache.read('camera', 'all')).toBeNull();
    await cache.save('camera', 'all', [asset('2'), asset('1')], signal);
    db.run("INSERT INTO backup_status VALUES ('1',1,'server','account','backed_up','remote','hash',NULL,1)");
    expect((await cache.read('camera', 'all')).assets).toEqual([asset('2'), asset('1')]);
    expect(await cache.read('camera', 'limited')).toBeNull();
    await cache.save('camera', 'all', [asset('1', 2)], signal);
    expect((await cache.read('camera', 'all')).assets).toEqual([asset('1', 2)]);
    expect(db.query('SELECT remote_id FROM backup_status').get().remote_id).toBe('remote');
    await cache.save('empty', 'all', [], signal);
    expect((await cache.read('empty', 'all')).assets).toEqual([]);
    const largeAlbum = Array.from({ length: 251 }, (_, index) => asset(String(1000 - index)));
    await cache.save('large', 'all', largeAlbum, signal);
    expect((await cache.read('large', 'all')).assets).toEqual(largeAlbum);
    db.exec(DEVICE_ALBUM_MIGRATION);
    expect((await cache.read('camera', 'all')).assets).toHaveLength(1);
    db.run('DELETE FROM device_album_snapshots');
    expect(db.query('SELECT COUNT(*) AS n FROM device_album_assets').get().n).toBe(0);
  } finally { db.close(); }
});

test('cancelling or failing a new album snapshot leaves its previous complete membership intact', async () => {
  const { db, adapter, cache } = setup();
  try {
    const controller = new AbortController();
    await cache.save('camera', 'all', [asset('1')], controller.signal);
    const run = adapter.runAsync;
    adapter.runAsync = async (sql, ...params) => {
      const result = await run(sql, ...params);
      if (sql.startsWith('DELETE FROM device_album_assets')) controller.abort();
      return result;
    };
    await expect(cache.save('camera', 'all', [asset('2')], controller.signal)).rejects.toThrow('cancelled');
    expect((await cache.read('camera', 'all')).assets).toEqual([asset('1')]);
  } finally { db.close(); }
});

test('cached albums display without device queries, then refresh once; misses avoid scanning twice', async () => {
  let scanned = 0, saved = 0;
  const loader = createCachedAlbumLoader({ read: async () => ({ assets: [asset('1')] }),
    scan: async () => { scanned++; return [asset('2')]; }, save: async () => { saved++; } });
  const options = { signal: new AbortController().signal };
  expect(await loader.load(options)).toEqual([asset('1')]); expect(scanned).toBe(0);
  expect(loader.takeRefresh()).toBe(true); expect(loader.takeRefresh()).toBe(false);
  expect(await loader.load(options)).toEqual([asset('2')]); expect(scanned).toBe(1); expect(saved).toBe(1);
  const miss = createCachedAlbumLoader({ read: async () => null,
    scan: async () => { scanned++; return []; }, save: async () => { saved++; } });
  expect(await miss.load(options)).toEqual([]); expect(miss.takeRefresh()).toBe(false);
  expect(scanned).toBe(2); expect(saved).toBe(2);
});
