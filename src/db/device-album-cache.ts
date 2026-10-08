import type { LocalAsset } from './schema';
import { BULK_INDEXED_ASSETS_SQL } from './queries';

type Database = {
  runAsync: (sql: string, ...params: (string | number)[]) => Promise<unknown>;
  getFirstAsync: <T>(sql: string, ...params: (string | number)[]) => Promise<T | null>;
  getAllAsync: <T>(sql: string, ...params: (string | number)[]) => Promise<T[]>;
  withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
};

export function createDeviceAlbumCache(run: <T>(task: (db: Database) => Promise<T>) => Promise<T>) {
  return {
    read(albumId: string, accessScope: string) {
      return run(async (db) => {
        const snapshot = await db.getFirstAsync<{ checkedAt: number }>(
          'SELECT checked_at AS checkedAt FROM device_album_snapshots WHERE album_id=? AND access_scope=?', albumId, accessScope);
        if (!snapshot) return null; // A saved empty album is distinct from a cache miss.
        const assets = await db.getAllAsync<LocalAsset>(`SELECT a.id, a.modified_at AS modifiedAt, a.filename, a.uri,
          a.media_type AS mediaType, a.width, a.height, a.created_at AS createdAt
          FROM device_album_assets m JOIN local_assets a ON a.id=m.asset_id AND a.modified_at=m.modified_at
          WHERE m.album_id=? ORDER BY m.position`, albumId);
        return { assets, checkedAt: snapshot.checkedAt };
      });
    },
    save(albumId: string, accessScope: string, assets: LocalAsset[], signal: AbortSignal) {
      return run((db) => db.withTransactionAsync(async () => {
        if (signal.aborted) throw new Error('Album loading cancelled.');
        const now = Date.now();
        await db.runAsync(`INSERT INTO device_album_snapshots (album_id,access_scope,checked_at) VALUES (?,?,?)
          ON CONFLICT(album_id) DO UPDATE SET access_scope=excluded.access_scope,checked_at=excluded.checked_at`, albumId, accessScope, now);
        await db.runAsync('DELETE FROM device_album_assets WHERE album_id=?', albumId);
        // Bounded bulk writes retain the previous complete snapshot if any page fails.
        for (let offset = 0; offset < assets.length; offset += 100) {
          if (signal.aborted) throw new Error('Album loading cancelled.');
          const json = JSON.stringify(assets.slice(offset, offset + 100));
          await db.runAsync(BULK_INDEXED_ASSETS_SQL, now, json);
          await db.runAsync(`INSERT OR IGNORE INTO device_album_assets (album_id,asset_id,modified_at,position)
            SELECT ?,json_extract(value,'$.id'),json_extract(value,'$.modifiedAt'),CAST(key AS INTEGER)+?
            FROM json_each(?)`, albumId, offset, json);
        }
        if (signal.aborted) throw new Error('Album loading cancelled.');
      }));
    },
  };
}
