import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { LOCAL_STORE_SCHEMA, type LocalAsset, type BackupScope, type BackupStatus } from './schema';

let opening: Promise<SQLiteDatabase> | undefined;
export function getLocalDatabase() {
  opening ??= (async () => {
    const db = await openDatabaseAsync('odwan-local.db');
    const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if ((version?.user_version ?? 0) > 1) throw new Error('Local database is newer than this app. Update the app.');
    await db.execAsync(LOCAL_STORE_SCHEMA);
    return db;
  })().catch((error) => { opening = undefined; throw error; });
  return opening;
}

export async function rememberAssets(assets: LocalAsset[]) {
  const db = await getLocalDatabase();
  await db.withExclusiveTransactionAsync(async (tx) => {
    for (const asset of assets) await tx.runAsync(`INSERT INTO local_assets
      (id, modified_at, filename, uri, media_type, width, height, created_at, last_seen_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id, modified_at) DO UPDATE SET uri=excluded.uri, filename=excluded.filename,
      width=excluded.width, height=excluded.height, last_seen_at=excluded.last_seen_at`,
      asset.id, asset.modifiedAt, asset.filename, asset.uri, asset.mediaType, asset.width, asset.height, asset.createdAt, Date.now());
  });
}

export async function readBackupStatuses(assets: LocalAsset[], scope: BackupScope | null) {
  if (!scope || !assets.length) return {} as Record<string, BackupStatus>;
  const db = await getLocalDatabase();
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
}

/** Called by the uploader only after the server confirms a completed upload. */
export async function recordBackupStatus(asset: LocalAsset, scope: BackupScope, status: BackupStatus, confirmation?: { remoteId: string; fileHash: string }, error?: string) {
  if (status === 'backed_up' && (!confirmation?.remoteId || !confirmation.fileHash)) throw new Error('A confirmed remote record and file hash are required.');
  await rememberAssets([asset]);
  const db = await getLocalDatabase();
  await db.runAsync(`INSERT INTO backup_status (asset_id, modified_at, server_url, account_id, status, remote_id, file_hash, error, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(asset_id, modified_at, server_url, account_id)
    DO UPDATE SET status=excluded.status, remote_id=excluded.remote_id, file_hash=excluded.file_hash, error=excluded.error, updated_at=excluded.updated_at`,
    asset.id, asset.modifiedAt, scope.serverUrl, scope.accountId, status, confirmation?.remoteId ?? null, confirmation?.fileHash ?? null, error ?? null, Date.now());
}
