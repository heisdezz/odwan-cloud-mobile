import { useQuery } from '@tanstack/react-query';
export function useBackupSummary() {
  return useQuery({ queryKey: ['backup-status', 'summary', 'unsupported'], queryFn: async () => ({ total: 0, backedUp: 0 }), staleTime: Infinity });
}
