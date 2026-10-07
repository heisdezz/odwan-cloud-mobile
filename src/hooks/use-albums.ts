import { useInfiniteQuery } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { pb } from '@/client/pb';
import { useServerStore } from '@/stores/server-store';
import type { AlbumResponse, MediaItemResponse } from '../../pocketbase-types';

export type AlbumWithCover = AlbumResponse<{ cover_media_id?: MediaItemResponse }>;

export function useAlbums() {
  const { verifiedUrl, account, revision } = useServerStore();
  return useInfiniteQuery({
    queryKey: ['albums', verifiedUrl, account?.id, revision],
    enabled: !!verifiedUrl && !!account,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      if (!verifiedUrl || !pb.authStore.isValid) throw new Error('Log in again to load your albums.');
      // Capture the connection so changing Settings cannot redirect a request.
      const client = new PocketBase(verifiedUrl, new BaseAuthStore());
      client.authStore.save(pb.authStore.token, pb.authStore.record);
      return client.collection('album').getList<AlbumWithCover>(pageParam, 60, {
        sort: 'name,id', expand: 'cover_media_id', signal, requestKey: null,
      });
    },
    getNextPageParam: (page) => page.page < page.totalPages ? page.page + 1 : undefined,
  });
}
