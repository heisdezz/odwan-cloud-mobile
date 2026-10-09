import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore, type ListResult } from 'pocketbase';
import { toast } from 'sonner-native';
import { pb } from '@/client/pb';
import { extract_message } from '@/helpers/api';
import { deleteServerMedia, removeDeletedMedia } from '@/lib/server-media-delete';
import { resetRemoteBackups } from '@/lib/reset-remote-backups';
import { useServerStore } from '@/stores/server-store';
import type { MediaItemResponse } from '../../pocketbase-types';

export function useDeleteServerMedia(serverUrl: string, onDeleted: (ids: readonly string[]) => void, progress: (completed: number, total: number) => void) {
  const queryClient = useQueryClient();
  const accountId = useServerStore((state) => state.account?.id);
  const revision = useServerStore((state) => state.revision);
  return useMutation({
    mutationFn: async (ids: readonly string[]) => {
      const current = useServerStore.getState();
      if (!current.account || current.verifiedUrl !== serverUrl || current.account.id !== accountId || current.revision !== revision || !pb.authStore.isValid)
        throw new Error('Log in again before deleting media.');
      const scope = { serverUrl, accountId: current.account.id, revision: current.revision };
      const isCurrent = () => {
        const next = useServerStore.getState();
        return next.verifiedUrl === scope.serverUrl && next.account?.id === scope.accountId && next.revision === scope.revision;
      };
      const api = new PocketBase(serverUrl, new BaseAuthStore());
      api.authStore.save(pb.authStore.token, pb.authStore.record);
      await queryClient.cancelQueries({ queryKey: ['media-items', serverUrl, scope.accountId] });
      const result = await deleteServerMedia(ids, async (id) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000);
        try { return await api.collection('media_item').delete(id, { signal: controller.signal, requestKey: null }); }
        finally { clearTimeout(timeout); }
      }, isCurrent, progress);
      if (result.deleted.length) {
        const removed = new Set(result.deleted);
        await queryClient.cancelQueries({ queryKey: ['media-items', serverUrl, scope.accountId] });
        queryClient.setQueriesData<InfiniteData<ListResult<MediaItemResponse>>>({ queryKey: ['media-items', serverUrl, scope.accountId] }, (data) => removeDeletedMedia(data, removed));
        queryClient.removeQueries({ predicate: ({ queryKey }) => queryKey[0] === 'media-thumbnail' && queryKey[1] === 'remote'
          && queryKey[2] === serverUrl && queryKey[3] === scope.accountId && removed.has(String(queryKey[4])) });
        try { await resetRemoteBackups(scope, result.deleted); }
        catch { toast.error('Deleted from the library, but device backup indicators could not be updated.'); }
        void queryClient.invalidateQueries({ queryKey: ['backup-status'] });
        void queryClient.invalidateQueries({ queryKey: ['media-items', serverUrl, scope.accountId] });
        void queryClient.invalidateQueries({ queryKey: ['albums', serverUrl, scope.accountId] });
        if (isCurrent()) onDeleted(result.deleted);
      }
      return result;
    },
    onSuccess: (result) => {
      if (result.deleted.length) toast.success(`${result.deleted.length} ${result.deleted.length === 1 ? 'item' : 'items'} deleted from the library`);
      if (result.failed.length) toast.error(`${result.failed.length} could not be deleted: ${extract_message(result.failed[0].error)}`);
      if (result.stopped) toast.error('Deletion stopped because the server session changed.');
    },
    onError: (error) => toast.error(extract_message(error)),
    retry: false,
  });
}
