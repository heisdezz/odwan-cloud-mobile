import { useEffect, useMemo, useRef, useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useMediaViewer } from '@/providers/media-viewer-provider';
import { localViewerItem } from '@/helpers/media-viewer';
import { GridZoom } from '@/components/media/grid-zoom';
import { MediaThumbnail } from '@/components/media/media-thumbnail';
import { presentPermissionsPicker } from '@/lib/device-media.native';
import { useGallerySync } from '@/providers/gallery-sync-provider.native';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import PageLoader from '@/components/layouts/PageLoader';
import { Button } from '@/components/ui';
import { BottomTabInset } from '@/constants/theme';
import { readGalleryPage, readBackupStatuses } from '@/db/local-store.native';
import { backupLabel, type BackupStatus, type LocalAsset } from '@/db/schema';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import { useServerStore } from '@/stores/server-store';

function GalleryTile({ asset, status, previewEnabled, onPress, size }: { asset: LocalAsset; status?: BackupStatus; previewEnabled: boolean; onPress: (id: string) => void; size: number }) {
  const colors = useTheme();
  return <Pressable onPress={() => onPress(asset.id)} accessibilityRole="button" accessible accessibilityLabel={`${asset.filename}. ${backupLabel(status)}`} style={tw.style('m-0.5 overflow-hidden', {
    width: size - 4, height: size - 4,
    backgroundColor: colors.backgroundElement,
  })}>
    {asset.mediaType === 'video' || asset.mediaType === 'image' ? <MediaThumbnail source={{ uri: asset.uri }} cacheKey={['local', asset.id, asset.modifiedAt]} name={asset.filename} local video={asset.mediaType === 'video'} enabled={previewEnabled} />
      : <View style={tw`flex-1 justify-center items-center px-3 gap-2`}>
        <Text style={tw.style('text-sm font-medium', { color: colors.text })}>{asset.mediaType === 'video' ? 'Video' : 'Preview unavailable'}</Text>
        <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>{asset.filename}</Text>
      </View>}
    <View style={tw`absolute bottom-1 left-1 right-1 rounded px-1 py-1 bg-black/70`}>
      <Text style={tw`text-white text-xs`} numberOfLines={1}>{backupLabel(status)}</Text>
    </View>
  </Pressable>;
}

function GalleryContent() {
  const colors = useTheme();
  const { permission, requestPermission, refresh, allowed, cacheReadable, database, sync } = useGallerySync();
  const [requesting, setRequesting] = useState(false);
  const { verifiedUrl, account } = useServerStore();
  const gallery = useInfiniteQuery({
    queryKey: ['device-gallery'], enabled: cacheReadable && database.isSuccess,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => readGalleryPage(pageParam),
    getNextPageParam: (page) => page.next,
    networkMode: 'always', staleTime: Infinity,
  });
  const assets = useMemo(() => [...new Map((gallery.data?.pages.flatMap((page) => page.assets) ?? []).map((asset) => [asset.id, asset])).values()], [gallery.data]);
  const viewer = useMediaViewer();
  const assetsRef = useRef(assets);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  const open = (id: string) => viewer.open({ items: assetsRef.current.map(localViewerItem), selectedId: id,
    loadMore: async () => {
      if (!gallery.hasNextPage) return undefined;
      const result = await gallery.fetchNextPage();
      if (result.isError) throw result.error;
      return result.data?.pages.flatMap((page) => page.assets).map(localViewerItem);
    } });
  const statuses = useQuery({
    queryKey: ['backup-status', verifiedUrl, account?.id, assets.map((asset) => [asset.id, asset.modifiedAt])],
    queryFn: () => readBackupStatuses(assets, verifiedUrl && account ? { serverUrl: verifiedUrl, accountId: account.id } : null),
    enabled: database.isSuccess && assets.length > 0,
  });
  async function grantAccess() {
    setRequesting(true);
    try {
      if (permission && !permission.canAskAgain) await Linking.openSettings();
      else { await requestPermission(); await refresh(); }
    } catch (error) { toast.error(extract_message(error)); }
    finally { setRequesting(false); }
  }
  if (database.isError || database.isPending) return <PageLoader query={database} />;
  if (!permission) return <ActivityIndicator color={colors.text} style={tw`flex-1`} />;
  if (!allowed) return <View style={tw`flex-1 justify-center px-6 gap-4 pb-24`}>
    <Text style={tw.style('text-xl font-medium text-center', { color: colors.text })}>Your phone gallery</Text>
    <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Allow access to photos and videos to browse them and track backups on this device.</Text>
    <Button label={permission.canAskAgain ? 'Allow gallery access' : 'Open app settings'} loading={requesting} onPress={() => { void grantAccess(); }} />
  </View>;
  return <View style={tw`flex-1`}>
    {!cacheReadable ? <ActivityIndicator color={colors.text} style={tw`py-4`} /> : null}
    {sync.running && <View style={tw`flex-row items-center gap-2 px-6 py-2`}>
      <ActivityIndicator size="small" color={colors.textSecondary} />
      <Text style={tw.style('text-sm', { color: colors.textSecondary })}>Updating phone gallery…</Text>
    </View>}
    {sync.error && <View style={tw`px-6 py-2 gap-2`}>
      <Text style={tw.style('text-sm', { color: colors.textSecondary })}>{sync.error}</Text>
      <Button variant="text" label="Retry gallery sync" onPress={() => { void refresh().catch((error) => toast.error(extract_message(error))); }} />
    </View>}
    {permission.accessPrivileges === 'limited' && <View style={tw`px-6 pb-3 gap-2`}>
      <Text style={tw.style('text-sm', { color: colors.textSecondary })}>Showing only photos and videos you allowed.</Text>
      <Button variant="text" label="Manage access" onPress={() => { void presentPermissionsPicker().then(() => refresh()).catch((error) => toast.error(extract_message(error))); }} />
    </View>}
    {statuses.isError && <Text style={tw.style('px-6 text-sm', { color: colors.text })}>{extract_message(statuses.error)}</Text>}
    {cacheReadable && <PageLoader query={gallery}>
      {() => <GridZoom data={assets}
        extraData={statuses.data} keyExtractor={(asset) => asset.id}
        renderItem={({ item, size }) => <GalleryTile asset={item} status={statuses.data?.[item.id]} previewEnabled onPress={open} size={size} />}
        contentInsets={{ bottom: BottomTabInset + 24 }}
        refreshing={sync.running}
        onRefresh={() => { void refresh().catch((error) => toast.error(extract_message(error))); }}
        onEndReached={() => { if (gallery.hasNextPage && !gallery.isFetching && !gallery.isFetchNextPageError) void gallery.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text style={tw.style('px-6 py-16 text-center text-base', { color: colors.textSecondary })}>{sync.running ? 'Indexing your photos and videos…' : 'No photos or videos are accessible.'}</Text>}
        ListFooterComponent={gallery.isFetchingNextPage ? <ActivityIndicator color={colors.text} style={tw`py-6`} /> : gallery.error ? <View style={tw`px-6 py-4 gap-3`}>
          <Text style={tw.style('text-base', { color: colors.text })}>{extract_message(gallery.error)}</Text>
          <Button label="Retry" onPress={() => { if (gallery.isFetchNextPageError) void gallery.fetchNextPage(); else void gallery.refetch(); }} />
        </View> : null}
      />}
    </PageLoader>}
  </View>;
}

export default function DeviceGallery() {
  const colors = useTheme();
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return <View style={tw`flex-1 justify-center px-6 gap-4 pb-24`}>
      <Text style={tw.style('text-xl font-medium text-center', { color: colors.text })}>Gallery needs a development build</Text>
      <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Expo Go on Android cannot access the full phone gallery. Install an Odwan development build to browse photos and videos and track backups.</Text>
    </View>;
  }
  return <GalleryContent />;
}
