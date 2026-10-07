import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { closeMediaViewer } from '@/helpers/close-media-viewer';
import { pb } from '@/client/pb';
import { extract_message } from '@/helpers/api';
import { matchesViewerScope, remoteViewerItem, type ViewerSession } from '@/helpers/media-viewer';
import { useMediaViewer } from '@/providers/media-viewer-provider';
import { useServerStore } from '@/stores/server-store';
import tw from '@/lib/tw';
import type { MediaItemResponse } from '../../../pocketbase-types';
import { MediaPager } from './media-pager';

export default function MediaViewerRoute({ album = false }: { album?: boolean }) {
  const params = useLocalSearchParams<{ mediaId: string; id?: string; session?: string; source?: string }>();
  const [entry] = useState(() => ({ mediaId: params.mediaId, albumId: album ? params.id : undefined, session: params.session, source: params.source }));
  const albumId = entry.albumId;
  const viewer = useMediaViewer();
  const current = useServerStore();
  const [snapshot] = useState(() => {
    const stored = viewer.get(entry.session);
    return stored && stored.albumId === albumId && stored.items.some((item) => item.id === entry.mediaId) ? stored : null;
  });
  const remoteAllowed = !!current.verifiedUrl && !!current.account && pb.authStore.isValid;
  const validSnapshot = snapshot && matchesViewerScope(snapshot.scope, current);
  const query = useQuery({
    queryKey: ['media-viewer', current.verifiedUrl, current.account?.id, current.revision, albumId, entry.mediaId],
    enabled: !snapshot && entry.source !== 'local' && remoteAllowed,
    retry: false,
    queryFn: async ({ signal }): Promise<ViewerSession> => {
      if (!current.verifiedUrl || !current.account) throw new Error('Connect and log in to view this media.');
      const client = new PocketBase(current.verifiedUrl, new BaseAuthStore());
      client.authStore.save(pb.authStore.token, pb.authStore.record);
      const selected = await client.collection('media_item').getOne<MediaItemResponse>(entry.mediaId, { signal, requestKey: null });
      if (albumId && selected.album_id !== albumId) throw new Error('This item is not in this album.');
      // Deep links start at the requested item, followed by older items in this context.
      const position = client.filter('(created_at < {:date} || (created_at = {:date} && id < {:id}))', { date: selected.created_at, id: selected.id });
      const filter = albumId ? `${client.filter('album_id = {:album}', { album: albumId })} && ${position}` : position;
      let page = await client.collection('media_item').getList<MediaItemResponse>(1, 60, { sort: '-created_at,-id', filter, signal, requestKey: null });
      return {
        id: `link:${current.revision}:${albumId ?? ''}:${selected.id}`, selectedId: selected.id, albumId,
        scope: { serverUrl: current.verifiedUrl, accountId: current.account.id, revision: current.revision },
        items: [remoteViewerItem(selected), ...page.items.map(remoteViewerItem)],
        loadMore: async () => {
          if (page.page >= page.totalPages) return undefined;
          page = await client.collection('media_item').getList<MediaItemResponse>(page.page + 1, 60, { sort: '-created_at,-id', filter, requestKey: null });
          return page.items.map(remoteViewerItem);
        },
      };
    },
  });
  useEffect(() => () => { if (snapshot) viewer.release(snapshot.id); }, [snapshot, viewer]);
  const session = validSnapshot ? snapshot : !snapshot && query.data && matchesViewerScope(query.data.scope, current) ? query.data : null;
  if (session) return <MediaPager key={session.id} session={session} />;
  const message = snapshot ? 'Your server or login changed. Close this viewer and reopen the item.'
    : entry.source === 'local' ? 'This gallery session has ended. Open the item again from Gallery.'
    : !remoteAllowed ? 'Connect to your server and log in to view this media.'
    : query.isError ? extract_message(query.error) : null;
  return <SafeAreaView style={tw`flex-1 bg-black justify-center items-center px-6 gap-4`}>
    {message ? <Text accessibilityRole="alert" style={tw`text-white text-base text-center`}>{message}</Text> : <ActivityIndicator color="white" accessibilityLabel="Loading media" />}
    {query.isError && <Pressable accessibilityRole="button" onPress={() => { void query.refetch(); }} style={tw`min-h-12 px-6 justify-center rounded-full bg-white/15`}><Text style={tw`text-white text-base`}>Retry</Text></Pressable>}
    <Pressable accessibilityRole="button" onPress={closeMediaViewer} style={tw`min-h-12 px-6 justify-center rounded-full bg-white/15`}><Text style={tw`text-white text-base`}>Close</Text></Pressable>
  </SafeAreaView>;
}
