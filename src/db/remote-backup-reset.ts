export const RESET_REMOTE_BACKUPS_SQL = `UPDATE backup_status SET status='pending', remote_id=NULL, file_hash=NULL, error=NULL, updated_at=?
WHERE server_url=? AND account_id=? AND remote_id IN (SELECT value FROM json_each(?))`;

export const TRASH_REMOTE_BACKUPS_SQL = `UPDATE backup_status SET status='pending', error=NULL, updated_at=?
WHERE server_url=? AND account_id=? AND remote_id IN (SELECT value FROM json_each(?))`;
export const RESTORE_REMOTE_BACKUPS_SQL = `UPDATE backup_status SET status='backed_up', error=NULL, updated_at=?
WHERE server_url=? AND account_id=? AND file_hash IS NOT NULL AND remote_id IN (SELECT value FROM json_each(?))`;
