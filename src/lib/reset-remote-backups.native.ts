import { runLocalDatabase } from '@/db/local-store.native';
import { RESET_REMOTE_BACKUPS_SQL, TRASH_REMOTE_BACKUPS_SQL, RESTORE_REMOTE_BACKUPS_SQL } from '@/db/remote-backup-reset';
import type { BackupScope } from '@/db/schema';

export async function resetRemoteBackups(scope: BackupScope, ids: readonly string[], action: "trash" | "restore" | "permanent" = "permanent") {
  if (!ids.length) return;
  await runLocalDatabase((db) => db.runAsync(action === "trash" ? TRASH_REMOTE_BACKUPS_SQL : action === "restore" ? RESTORE_REMOTE_BACKUPS_SQL : RESET_REMOTE_BACKUPS_SQL, Date.now(), scope.serverUrl, scope.accountId, JSON.stringify(ids)));
}
