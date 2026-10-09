import { useQuery } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { pb } from '@/client/pb';
import { useServerStore } from '@/stores/server-store';

export function useMediaCapabilities() {
  const serverUrl = useServerStore((state) => state.verifiedUrl);
  const accountId = useServerStore((state) => state.account?.id);
  const revision = useServerStore((state) => state.revision);
  return useQuery({
    queryKey: ['media-capabilities', serverUrl, accountId, revision],
    enabled: !!serverUrl && !!accountId,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async ({ signal }) => {
      const client = new PocketBase(serverUrl!, new BaseAuthStore());
      client.authStore.save(pb.authStore.token, pb.authStore.record);
      try {
        const result = await client.send<{ trash?: boolean; retention_days?: number }>('/api/media/capabilities', { signal, requestKey: null });
        return { trash: result.trash === true, retentionDays: result.retention_days ?? 30 };
      } catch (error) {
        if ((error as { status?: number }).status === 404) return { trash: false, retentionDays: 0 };
        throw error;
      }
    },
  });
}
