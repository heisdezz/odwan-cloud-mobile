import { AlbumBrowserTools, type AlbumSort } from './album-browser-tools';
import { AlbumActions } from './album-actions';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { pocketbaseThumbnailSource } from '@/lib/pocketbase-thumbnail';
import { useMemo, useState } from 'react';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { pb } from '@/client/pb';
import PageLoader from '@/components/layouts/PageLoader';
import { MediaThumbnail } from '@/components/media/media-thumbnail';
import { MediaTileBadges } from '@/components/media/media-tile-badges';
import { Button } from '@/components/ui';
import { BottomTabInset } from '@/constants/theme';
import { extract_message } from '@/helpers/api';
import { mediaName } from '@/helpers/media';
import { useAlbums, type AlbumWithCover } from '@/hooks/use-albums';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import { useServerStore } from '@/stores/server-store';
import { CreateAlbumSheet } from './CreateAlbumSheet';

function AlbumTile({ album, serverUrl, accountId, previewEnabled, onMenu }: {
  album: AlbumWithCover; serverUrl: string; accountId: string; previewEnabled: boolean; onMenu: (album: AlbumWithCover) => void;
}) {
  const colors = useTheme();
  const cover = album.expand?.cover_media_id;
  const available = cover?.upload_status === 'success' && !!cover.storage_backend && !!cover.storage_bucket && !!cover.storage_key;
  const count = album.media_count ?? 0;
  const label = `${count.toLocaleString()} ${count === 1 ? 'item' : 'items'}`;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${album.name}, ${label}`}
    onLongPress={() => onMenu(album)}
    accessibilityHint="Hold for album actions"
    onPress={() => router.push({ pathname: '/album/[id]', params: { id: album.id } })}
    style={({ pressed }) => tw.style('flex-1 mx-2 mb-6', { opacity: pressed ? 0.7 : 1 })}>
    <View style={tw.style('w-full aspect-square rounded-2xl overflow-hidden items-center justify-center', { backgroundColor: colors.backgroundElement })}>
      {cover && available ? <>
        <MediaThumbnail
          source={pocketbaseThumbnailSource(serverUrl, cover, pb.authStore.token)}
          cacheKey={['remote', serverUrl, accountId, cover.id, cover.thumbs ?? "", cover.file_hash, cover.storage_backend, cover.storage_bucket, cover.storage_key, cover.storage_etag ?? '', cover.file_size ?? 0]}
          name={mediaName(cover)} video={cover.mime_type.startsWith('video/')} enabled={previewEnabled} />
        <MediaTileBadges video={cover.mime_type.startsWith('video/')} />
      </> : <SymbolView name={{ ios: 'rectangle.stack', android: 'photo_library', web: 'photo_library' }} size={40} tintColor={colors.textSecondary} />}
    </View>
    <View style={tw`flex-row items-center mt-2`}>
      <Text numberOfLines={2} style={tw.style('flex-1 text-base font-semibold', { color: colors.text })}>{album.name}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${album.name}`} onPress={(event) => { event.stopPropagation(); onMenu(album); }} style={tw`min-h-11 min-w-11 items-center justify-center`}>
        <SymbolView name={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }} size={22} tintColor={colors.textSecondary} />
      </Pressable>
    </View>
    <Text style={tw.style('text-sm mt-1', { color: colors.textSecondary })}>{label}</Text>
  </Pressable>;
}

export default function RemoteAlbums() {
  const colors = useTheme();
  const { verifiedUrl, account, revision } = useServerStore();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AlbumSort>("name");
  const scope = `${verifiedUrl}:${account?.id}:${revision}`;
  const [menu, setMenu] = useState<{ album: AlbumWithCover; scope: string } | null>(null);
  const settledSearch = useDebouncedValue(search);
  const query = useAlbums(settledSearch, sort);
  const [creating, setCreating] = useState(false);
  const albums = useMemo(() => [...new Map((query.data?.pages.flatMap((page) => page.items) ?? []).map((album) => [album.id, album])).values()], [query.data]);
  const retry = () => {
    if (query.isFetching) return;
    if (query.isFetchNextPageError) void query.fetchNextPage();
    else void query.refetch();
  };
  return <View style={tw`flex-1`}>
    {verifiedUrl && account && <View style={tw`px-6 pb-3 flex-row items-center gap-3 shrink-0`}>
      <Text style={tw.style('flex-1 text-lg font-medium', { color: colors.text })}>Cloud albums</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Create new cloud album" onPress={() => setCreating(true)}
        style={({ pressed }) => tw.style('min-h-11 px-4 rounded-full flex-row items-center gap-2', { backgroundColor: colors.backgroundSelected, opacity: pressed ? 0.7 : 1 })}>
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={20} tintColor={colors.text} />
        <Text style={tw.style('text-sm font-medium', { color: colors.text })}>New album</Text>
      </Pressable>
    </View>}
    {verifiedUrl && account && <AlbumBrowserTools search={search} onSearch={setSearch} sort={sort} onSort={setSort} remote />}
    {!verifiedUrl || !account ? <View style={tw`flex-1 justify-center px-6 gap-4 pb-24`}>
      <Text style={tw.style('text-xl font-medium text-center', { color: colors.text })}>Your albums</Text>
      <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Connect to your server and log in to browse your albums.</Text>
      <Button label="Open Settings" onPress={() => router.navigate('/settings')} />
    </View> : <PageLoader query={query}>
      {() => <FlashList
        key={`${verifiedUrl}:${account.id}:${revision}`}
        data={albums} numColumns={2} keyExtractor={(album) => album.id}
        renderItem={({ item, target }) => <AlbumTile album={item} serverUrl={verifiedUrl} accountId={account.id} previewEnabled={target === 'Cell'} onMenu={(album) => setMenu({ album, scope })} />}
        contentContainerStyle={tw.style('px-4 pt-1', { paddingBottom: BottomTabInset + 24 })}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => { void query.refetch(); }}
        onEndReached={() => { if (query.hasNextPage && !query.isFetching && !query.isFetchNextPageError) void query.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<View style={tw`px-6 py-20 gap-3 items-center`}>
          <SymbolView name={{ ios: 'rectangle.stack', android: 'photo_library', web: 'photo_library' }} size={40} tintColor={colors.textSecondary} />
          <Text style={tw.style('text-xl font-medium', { color: colors.text })}>{settledSearch ? "No matching albums" : "No albums yet"}</Text>
          <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Albums from your server will appear here.</Text>
        </View>}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator style={tw`py-6`} color={colors.text} />
          : query.error ? <View style={tw`px-2 py-6 gap-3`}>
            <Text accessibilityRole="alert" style={tw.style('text-base', { color: colors.text })}>{extract_message(query.error)}</Text>
            <Button label="Retry" loading={query.isFetching} onPress={retry} />
          </View> : null}
      />}
    </PageLoader>}
    {menu?.scope === scope && <AlbumActions key={`${scope}:${menu.album.id}`} album={menu.album} onClose={() => setMenu(null)} />}
    {creating && verifiedUrl && account && <CreateAlbumSheet key={`${verifiedUrl}:${account.id}:${revision}`} onClose={() => setCreating(false)} />}
  </View>;
}
