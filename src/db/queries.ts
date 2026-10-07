/** Shared with integration tests so the statements prepared on-device are exercised by SQLite. */
export const UPSERT_LOCAL_ASSET_SQL = `INSERT INTO local_assets
  (id, modified_at, filename, uri, media_type, width, height, created_at, last_seen_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id, modified_at) DO UPDATE SET uri=excluded.uri, filename=excluded.filename,
  width=excluded.width, height=excluded.height, last_seen_at=excluded.last_seen_at`;

export const UPSERT_BACKUP_STATUS_SQL = `INSERT INTO backup_status
  (asset_id, modified_at, server_url, account_id, status, remote_id, file_hash, error, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(asset_id, modified_at, server_url, account_id)
  DO UPDATE SET status=excluded.status, remote_id=excluded.remote_id, file_hash=excluded.file_hash,
  error=excluded.error, updated_at=excluded.updated_at`;
