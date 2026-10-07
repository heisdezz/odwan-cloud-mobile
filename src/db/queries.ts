/** Shared with integration tests so the statements prepared on-device are exercised by SQLite. */
export const UPSERT_LOCAL_ASSET_SQL = `INSERT INTO local_assets
  (id, modified_at, filename, uri, media_type, width, height, created_at, last_seen_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id, modified_at) DO UPDATE SET uri=excluded.uri, filename=excluded.filename,
  width=excluded.width, height=excluded.height, last_seen_at=excluded.last_seen_at`;

// Subsequent scans don't rewrite unchanged metadata. Scan membership is tracked
// separately in gallery_index, so it does not depend on last_seen_at.
export const UPSERT_INDEXED_ASSET_SQL = `${UPSERT_LOCAL_ASSET_SQL},
  media_type=excluded.media_type, created_at=excluded.created_at
  WHERE local_assets.uri != excluded.uri OR local_assets.filename != excluded.filename
  OR local_assets.width != excluded.width OR local_assets.height != excluded.height
  OR local_assets.media_type != excluded.media_type OR local_assets.created_at != excluded.created_at`;

export const UPSERT_BACKUP_STATUS_SQL = `INSERT INTO backup_status
  (asset_id, modified_at, server_url, account_id, status, remote_id, file_hash, error, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(asset_id, modified_at, server_url, account_id)
  DO UPDATE SET status=excluded.status, remote_id=excluded.remote_id, file_hash=excluded.file_hash,
  error=excluded.error, updated_at=excluded.updated_at`;

export const UPSERT_GALLERY_INDEX_SQL = `INSERT INTO gallery_index (asset_id, modified_at, scan_id)
  VALUES (?, ?, ?) ON CONFLICT(asset_id) DO UPDATE SET modified_at=excluded.modified_at, scan_id=excluded.scan_id`;
export const READ_GALLERY_SQL = `SELECT a.id, a.modified_at AS modifiedAt, a.filename, a.uri,
  a.media_type AS mediaType, a.width, a.height, a.created_at AS createdAt
  FROM local_assets a JOIN gallery_index g ON a.id=g.asset_id AND a.modified_at=g.modified_at
  ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?`;
export const FINISH_GALLERY_SCAN_SQL = 'DELETE FROM gallery_index WHERE scan_id != ?';
