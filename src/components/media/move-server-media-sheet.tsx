import { patchMovedMedia } from '@/lib/server-media-move';
import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore, type ListResult } from 'pocketbase';
import { Text, View, Pressable } from 'react-native';
import { toast } from 'sonner-native';
import { pb } from '@/client/pb';
import UploadSheet from '@/components/overlays/upload-sheet';
import PageLoader from '@/components/layouts/PageLoader';
import { Button } from '@/components/ui';
import { useAlbums } from '@/hooks/use-albums';
import { useTheme } from '@/hooks/use-theme';
import { useServerStore } from '@/stores/server-store';
import { extract_message } from '@/helpers/api';
import tw from '@/lib/tw';
import { FlashList } from '@shopify/flash-list';
import type { MediaItemResponse } from '../../../pocketbase-types';

export function MoveServerMediaSheet({ ids, serverUrl, onMoved, onClose }: {
  ids: readonly string[]; serverUrl: string; onMoved: (ids: readonly string[]) => void; onClose: () => void;
}) {
  const colors = useTheme();
  const albums = useAlbums();
  const cache = useQueryClient();
  const accountId = useServerStore((state) => state.account?.id);
  const revision = useServerStore((state) => state.revision);
  const move = useMutation({ retry: false, mutationFn: async (albumId: string) => {
    const current = useServerStore.getState();
    if (!accountId || current.verifiedUrl !== serverUrl || current.account?.id !== accountId || current.revision !== revision || !pb.authStore.isValid) throw new Error('Log in again to move media.');
    const api = new PocketBase(serverUrl, new BaseAuthStore()); api.authStore.save(pb.authStore.token, pb.authStore.record);
    const moved: string[] = []; const failures: unknown[] = [];
    for (const id of new Set(ids)) {
      const session = useServerStore.getState();
      if (session.verifiedUrl !== serverUrl || session.account?.id !== accountId || session.revision !== revision) { failures.push(new Error('The server session changed.')); break; }
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30_000);
      try { await api.collection('media_item').update(id, { album_id: albumId }, { requestKey: null, signal: controller.signal }); moved.push(id); }
      catch (error) { failures.push(error); }
      finally { clearTimeout(timer); }
    }
    if (moved.length) {
      const changed = new Set(moved);
      await cache.cancelQueries({ queryKey: ['media-items', serverUrl, accountId] });
      for (const query of cache.getQueryCache().findAll({ queryKey: ['media-items', serverUrl, accountId] })) {
        const sourceAlbum = query.queryKey[4];
        cache.setQueryData<InfiniteData<ListResult<MediaItemResponse>>>(query.queryKey, (data) => patchMovedMedia(data, changed, albumId, sourceAlbum));
      }
      void cache.invalidateQueries({ queryKey: ['media-items', serverUrl, accountId] });
      void cache.invalidateQueries({ queryKey: ['albums', serverUrl, accountId] });
      if (useServerStore.getState().revision === revision) onMoved(moved);
    }
    return { moved, failures };
  }, onSuccess: ({ moved, failures }) => {
    if (moved.length) toast.success(`${moved.length} ${moved.length === 1 ? 'item' : 'items'} moved`);
    if (failures.length) toast.error(extract_message(failures[0]));
    onClose();
  }, onError: (error) => toast.error(extract_message(error)) });
  return <UploadSheet onClose={() => { if (!move.isPending) onClose(); }}>
    <View style={tw`px-6 pt-4 pb-2 gap-2`}>
      <Text accessibilityRole="header" style={tw.style('text-xl font-semibold', { color: colors.text })}>Move {ids.length} {ids.length === 1 ? 'item' : 'items'} to album</Text>
      {move.isPending && <Text accessibilityLiveRegion="polite" style={tw.style('text-sm', { color: colors.textSecondary })}>Moving selected media…</Text>}
    </View>
    <View style={tw`flex-1`}><PageLoader query={albums}>{() => <FlashList data={albums.data?.pages.flatMap((page) => page.items) ?? []} keyExtractor={(album) => album.id}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Move to ${item.name}`} disabled={move.isPending}
        onPress={() => move.mutate(item.id)} style={({ pressed }) => tw.style('min-h-14 px-6 justify-center', { opacity: move.isPending ? 0.4 : pressed ? 0.6 : 1 })}>
        <Text style={tw.style('text-base', { color: colors.text })}>{item.name}</Text>
      </Pressable>}
      onEndReached={() => { if (albums.hasNextPage && !albums.isFetching) void albums.fetchNextPage(); }}
      ListFooterComponent={albums.isFetchNextPageError ? <Button label="Retry albums" onPress={() => { void albums.fetchNextPage(); }} /> : null}
      ListEmptyComponent={<Text style={tw.style('px-6 py-4', { color: colors.textSecondary })}>Create an album in Explore first.</Text>} />}</PageLoader></View>
    <View style={tw`px-6 pb-4`}><Button label="Cancel" variant="text" disabled={move.isPending} onPress={onClose} /></View>
  </UploadSheet>;
}
