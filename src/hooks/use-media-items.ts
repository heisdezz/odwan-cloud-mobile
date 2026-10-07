import { useInfiniteQuery } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { pb } from '@/client/pb';
import { useServerStore } from '@/stores/server-store';
import type { MediaItemResponse } from '../../pocketbase-types';

export function useMediaItems(albumId?: string) {
  const { verifiedUrl, account, revision } = useServerStore();
  return useInfiniteQuery({
    queryKey: ['media-items', verifiedUrl, account?.id, revision, albumId ?? null],
    enabled: !!verifiedUrl && !!account,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      if (!verifiedUrl || !pb.authStore.isValid) throw new Error('Log in again to load your media.');
      // Isolate the client so a URL edit cannot redirect an in-flight request.
      const client = new PocketBase(verifiedUrl, new BaseAuthStore());
      client.authStore.save(pb.authStore.token, pb.authStore.record);
      return client.collection('media_item').getList<MediaItemResponse>(pageParam, 60, {
        sort: '-created_at,-id', filter: albumId ? client.filter('album_id = {:album}', { album: albumId }) : undefined, signal, requestKey: null,
      });
    },
    getNextPageParam: (page) => page.page < page.totalPages ? page.page + 1 : undefined,
  });
}
