export const LOCAL_STORE_SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
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

export type LocalAsset = {
  id: string; modifiedAt: number; filename: string; uri: string;
  mediaType: string; width: number; height: number; createdAt: number;
};
export type BackupStatus = 'pending' | 'uploading' | 'backed_up' | 'error';
export type BackupScope = { serverUrl: string; accountId: string };
export const backupLabel = (status?: BackupStatus) => !status ? 'Not tracked' : ({ pending: 'Not backed up', uploading: 'Uploading', backed_up: 'Backed up', error: 'Backup failed' })[status];
