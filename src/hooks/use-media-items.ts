import { useInfiniteQuery } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { pb } from '@/client/pb';
import { useServerStore } from '@/stores/server-store';
import { useGridStore } from '@/stores/grid-store';
import { mediaMimePattern } from '@/helpers/media-filter';
import type { MediaItemResponse } from '../../pocketbase-types';

export function useMediaItems(albumId?: string) {
  const mediaFilter = useGridStore((state) => state.mediaFilter);
  const { verifiedUrl, account, revision } = useServerStore();
  return useInfiniteQuery({
    queryKey: ['media-items', verifiedUrl, account?.id, revision, albumId ?? null, mediaFilter],
    enabled: !!verifiedUrl && !!account,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      if (!verifiedUrl || !pb.authStore.isValid) throw new Error('Log in again to load your media.');
      // Isolate the client so a URL edit cannot redirect an in-flight request.
      const client = new PocketBase(verifiedUrl, new BaseAuthStore());
      client.authStore.save(pb.authStore.token, pb.authStore.record);
      const mime = mediaMimePattern(mediaFilter);
      const filter = [albumId ? client.filter('album_id = {:album}', { album: albumId }) : '',
        mime ? client.filter('mime_type ~ {:mime}', { mime }) : ''].filter(Boolean).join(' && ');
      return client.collection('media_item').getList<MediaItemResponse>(pageParam, 60, {
        sort: '-created_at,-id', filter: filter || undefined, signal, requestKey: null,
      });
    },
    getNextPageParam: (page) => page.page < page.totalPages ? page.page + 1 : undefined,
  });
}
