import type { BackupScope } from '@/db/schema';

// Browser builds have no device backup database.
export async function resetRemoteBackups(_scope: BackupScope, _ids: readonly string[], action: "trash" | "restore" | "permanent" = "permanent") {}
