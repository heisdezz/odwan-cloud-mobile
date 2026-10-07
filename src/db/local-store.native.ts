import { UPSERT_LOCAL_ASSET_SQL, UPSERT_INDEXED_ASSET_SQL, UPSERT_BACKUP_STATUS_SQL, UPSERT_GALLERY_INDEX_SQL, READ_GALLERY_SQL, FINISH_GALLERY_SCAN_SQL } from './queries';
import { createDatabaseAccess } from './database-access';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { LOCAL_STORE_TABLES, GALLERY_INDEX_MIGRATION, type LocalAsset, type BackupScope, type BackupStatus } from './schema';

// Keep the connection/queue through Fast Refresh; a second JS module must not race it.
type DatabaseAccess = ReturnType<typeof createDatabaseAccess<SQLiteDatabase>>;
const runtime = globalThis as typeof globalThis & { __odwanLocalDatabaseAccess?: DatabaseAccess };
const access = runtime.__odwanLocalDatabaseAccess ??= createDatabaseAccess({
  open: () => openDatabaseAsync('odwan-local.db', { useNewConnection: true }),
  initialize: async (db) => {
    await db.execAsync('PRAGMA busy_timeout = 3000; PRAGMA foreign_keys = ON;');
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 2) throw new Error('Local database is newer than this app. Update the app.');
    const journal = await db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode');
    if (journal?.journal_mode.toLowerCase() !== 'wal') await db.execAsync('PRAGMA journal_mode = WAL;');
    if ((version?.user_version ?? 0) < 1) await db.withTransactionAsync(() => db.execAsync(LOCAL_STORE_TABLES));
    if ((version?.user_version ?? 0) < 2) await db.withTransactionAsync(() => db.execAsync(GALLERY_INDEX_MIGRATION));
  },
  close: (db) => db.closeAsync(),
});
export function getLocalDatabase() { return access.run(async (db) => db); }

async function writeAssets(db: SQLiteDatabase, assets: LocalAsset[], sql = UPSERT_LOCAL_ASSET_SQL) {
  const statement = await db.prepareAsync(sql);
  try {
    const now = Date.now();
    for (const asset of assets) await statement.executeAsync(
      asset.id, asset.modifiedAt, asset.filename, asset.uri, asset.mediaType, asset.width, asset.height, asset.createdAt, now);
  } finally { await statement.finalizeAsync(); }
}
export function rememberAssets(assets: LocalAsset[]) {
  if (!assets.length) return Promise.resolve();
  return access.run((db) => db.withTransactionAsync(() => writeAssets(db, assets)));
}

/** Short queued transactions let gallery reads run between scan batches. */
export function indexGalleryPage(assets: LocalAsset[], scanId: string) {
  return access.run((db) => db.withTransactionAsync(async () => {
    await writeAssets(db, assets, UPSERT_INDEXED_ASSET_SQL);
    const statement = await db.prepareAsync(UPSERT_GALLERY_INDEX_SQL);
    try { for (const asset of assets) await statement.executeAsync(asset.id, asset.modifiedAt, scanId); }
    finally { await statement.finalizeAsync(); }
  }));
}
export function finishGalleryScan(scanId: string, signal?: AbortSignal) {
  return access.run((db) => {
    if (signal?.aborted) throw new Error('Gallery sync cancelled.');
    return db.runAsync(FINISH_GALLERY_SCAN_SQL, scanId);
  });
}
export function clearGalleryIndex() {
  return access.run((db) => db.runAsync('DELETE FROM gallery_index'));
}
export function readGalleryPage(offset = 0) {
  return access.run(async (db) => {
    const rows = await db.getAllAsync<LocalAsset>(READ_GALLERY_SQL, 121, offset);
    return { assets: rows.slice(0, 120), next: rows.length > 120 ? offset + 120 : undefined };
  });
}

export async function readBackupStatuses(assets: LocalAsset[], scope: BackupScope | null) {
  if (!scope || !assets.length) return {} as Record<string, BackupStatus>;
  return access.run(async (db) => {
    const statuses: Record<string, BackupStatus> = {};
    // Keep each query below SQLite's parameter limit even for large libraries.
    for (let offset = 0; offset < assets.length; offset += 300) {
      const batch = assets.slice(offset, offset + 300);
      const versions = new Map(batch.map((asset) => [asset.id, asset.modifiedAt]));
      const rows = await db.getAllAsync<{ asset_id: string; modified_at: number; status: BackupStatus }>(
        `SELECT asset_id, modified_at, status FROM backup_status WHERE server_url=? AND account_id=? AND asset_id IN (${batch.map(() => '?').join(',')})`,
        scope.serverUrl, scope.accountId, ...batch.map((asset) => asset.id));
      for (const row of rows) if (versions.get(row.asset_id) === row.modified_at) statuses[row.asset_id] = row.status;
    }
    return statuses;
  });
}

/** Called by the uploader only after the server confirms a completed upload. */
export async function recordBackupStatus(asset: LocalAsset, scope: BackupScope, status: BackupStatus, confirmation?: { remoteId: string; fileHash: string }, error?: string) {
  if (status === 'backed_up' && (!confirmation?.remoteId || !confirmation.fileHash)) throw new Error('A confirmed remote record and file hash are required.');
  await access.run((db) => db.withTransactionAsync(async () => {
    await writeAssets(db, [asset]);
    await db.runAsync(UPSERT_BACKUP_STATUS_SQL,
      asset.id, asset.modifiedAt, scope.serverUrl, scope.accountId, status, confirmation?.remoteId ?? null, confirmation?.fileHash ?? null, error ?? null, Date.now());
  }));
}
