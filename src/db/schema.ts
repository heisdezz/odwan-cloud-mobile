export const LOCAL_STORE_TABLES = `
CREATE TABLE IF NOT EXISTS local_assets (
  id TEXT NOT NULL,
  modified_at REAL NOT NULL,
  filename TEXT NOT NULL,
  uri TEXT NOT NULL,
  media_type TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at REAL NOT NULL,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (id, modified_at)
);
CREATE TABLE IF NOT EXISTS backup_status (
  asset_id TEXT NOT NULL,
  modified_at REAL NOT NULL,
  server_url TEXT NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','uploading','backed_up','error')),
  remote_id TEXT,
  file_hash TEXT,
  error TEXT,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (asset_id, modified_at, server_url, account_id),
  FOREIGN KEY (asset_id, modified_at) REFERENCES local_assets(id, modified_at) ON DELETE CASCADE,
  CHECK (status != 'backed_up' OR (remote_id IS NOT NULL AND file_hash IS NOT NULL))
);
PRAGMA user_version = 1;
`;

// Used by standalone SQL consumers/tests. Runtime startup configures pragmas before migration.
export const LOCAL_STORE_SCHEMA = `PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; ${LOCAL_STORE_TABLES}`;

// Keep the current gallery separate from versioned backup history. Removing a
// phone photo from the gallery must never erase evidence of its remote backup.
export const GALLERY_INDEX_MIGRATION = `
CREATE TABLE IF NOT EXISTS gallery_index (
  asset_id TEXT PRIMARY KEY NOT NULL,
  modified_at REAL NOT NULL,
  scan_id TEXT NOT NULL,
  FOREIGN KEY (asset_id, modified_at) REFERENCES local_assets(id, modified_at)
);
CREATE INDEX IF NOT EXISTS local_assets_gallery_order ON local_assets(created_at DESC, id DESC);
PRAGMA user_version = 2;
`;

export const GALLERY_SYNC_MIGRATION = `
CREATE TABLE IF NOT EXISTS gallery_sync_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  checked_at INTEGER NOT NULL,
  access_scope TEXT NOT NULL
);
PRAGMA user_version = 3;
`;

export type LocalAsset = {
  id: string; modifiedAt: number; filename: string; uri: string;
  mediaType: string; width: number; height: number; createdAt: number;
};

export const UPLOAD_QUEUE_MIGRATION = `
CREATE TABLE IF NOT EXISTS upload_queue (
  id TEXT PRIMARY KEY NOT NULL,
  server_url TEXT NOT NULL,
  account_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  modified_at REAL NOT NULL,
  asset_json TEXT NOT NULL,
  album_id TEXT NOT NULL,
  album_name TEXT NOT NULL,
  object_key TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('queued','uploading','organizing','success','error')),
  result_json TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(server_url, account_id, asset_id, modified_at, album_id)
);
CREATE INDEX IF NOT EXISTS upload_queue_scope ON upload_queue(server_url, account_id, state, created_at);
PRAGMA user_version = 4;
`;
export type BackupStatus = 'pending' | 'uploading' | 'backed_up' | 'error';
export type BackupScope = { serverUrl: string; accountId: string };
export const backupLabel = (status?: BackupStatus) => !status ? 'Not tracked' : ({ pending: 'Not backed up', uploading: 'Uploading', backed_up: 'Backed up', error: 'Backup failed' })[status];

// A success transition archives its immutable snapshot in the same SQLite write.
export const UPLOAD_HISTORY_MIGRATION = `
CREATE TABLE IF NOT EXISTS upload_history AS SELECT upload_queue.*, CAST(0 AS INTEGER) AS completed_at FROM upload_queue WHERE 0;
CREATE UNIQUE INDEX IF NOT EXISTS upload_history_id ON upload_history(id);
CREATE INDEX IF NOT EXISTS upload_history_scope ON upload_history(server_url,account_id,completed_at DESC);
INSERT OR IGNORE INTO upload_history SELECT upload_queue.*,created_at FROM upload_queue WHERE state='success' AND result_json IS NOT NULL;
CREATE TRIGGER IF NOT EXISTS archive_completed_upload AFTER UPDATE OF state ON upload_queue
WHEN NEW.state='success' AND NEW.result_json IS NOT NULL
BEGIN
  INSERT OR IGNORE INTO upload_history SELECT upload_queue.*,CAST(strftime('%s','now') AS INTEGER)*1000 FROM upload_queue WHERE id=NEW.id;
END;
PRAGMA user_version = 5;
`;

export const DEVICE_ALBUM_MIGRATION = `
CREATE TABLE IF NOT EXISTS device_album_snapshots (
  album_id TEXT PRIMARY KEY NOT NULL,
  access_scope TEXT NOT NULL,
  checked_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS device_album_assets (
  album_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  modified_at REAL NOT NULL,
  position INTEGER NOT NULL,
  PRIMARY KEY (album_id, asset_id),
  FOREIGN KEY (album_id) REFERENCES device_album_snapshots(album_id) ON DELETE CASCADE,
  FOREIGN KEY (asset_id, modified_at) REFERENCES local_assets(id, modified_at)
);
CREATE INDEX IF NOT EXISTS device_album_asset_order ON device_album_assets(album_id, position);
PRAGMA user_version = 6;
`;
