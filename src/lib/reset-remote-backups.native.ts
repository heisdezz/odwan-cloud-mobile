import { runLocalDatabase } from '@/db/local-store.native';
import { RESET_REMOTE_BACKUPS_SQL } from '@/db/remote-backup-reset';
import type { BackupScope } from '@/db/schema';

export async function resetRemoteBackups(scope: BackupScope, ids: readonly string[]) {
  if (!ids.length) return;
  await runLocalDatabase((db) => db.runAsync(RESET_REMOTE_BACKUPS_SQL, Date.now(), scope.serverUrl, scope.accountId, JSON.stringify(ids)));
}
