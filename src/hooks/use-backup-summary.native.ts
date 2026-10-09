import { READ_BACKUP_SUMMARY_SQL } from '@/db/backup-summary';
import { useQuery } from '@tanstack/react-query';
import { runLocalDatabase } from '@/db/local-store.native';
import { useServerStore } from '@/stores/server-store';

export function useBackupSummary() {
  const serverUrl = useServerStore((state) => state.verifiedUrl);
  const accountId = useServerStore((state) => state.account?.id);
  return useQuery({ queryKey: ['backup-status', 'summary', serverUrl, accountId], enabled: !!serverUrl && !!accountId,
    networkMode: 'always', staleTime: 60_000, refetchOnWindowFocus: false,
    queryFn: () => runLocalDatabase(async (db) => (await db.getFirstAsync<{ total: number; backedUp: number }>(READ_BACKUP_SUMMARY_SQL, serverUrl!, accountId!)) ?? { total: 0, backedUp: 0 }),
  });
}
