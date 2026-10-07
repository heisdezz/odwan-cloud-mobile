import { useEffect, useMemo, useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { FlashList, useRecyclingState } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { addListener, presentPermissionsPicker, usePermissions, loadDeviceMedia, type GalleryCursor } from '@/lib/device-media.native';
import { ActivityIndicator, AppState, Linking, Platform, Text, View, useWindowDimensions } from 'react-native';
import { toast } from 'sonner-native';
import PageLoader from '@/components/layouts/PageLoader';
import { Button } from '@/components/ui';
import { BottomTabInset } from '@/constants/theme';
import { getLocalDatabase, readBackupStatuses, rememberAssets } from '@/db/local-store.native';
import { backupLabel, type BackupStatus, type LocalAsset } from '@/db/schema';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import { useServerStore } from '@/stores/server-store';

function GalleryTile({ asset, status }: { asset: LocalAsset; status?: BackupStatus }) {
  const colors = useTheme();
  const [failed, setFailed] = useRecyclingState(false, [asset.id, asset.modifiedAt]);
  return <View accessible accessibilityLabel={`${asset.filename}. ${backupLabel(status)}`} style={tw.style('m-0.5 overflow-hidden', {
    aspectRatio: asset.width > 0 && asset.height > 0 ? Math.max(0.5, Math.min(2, asset.width / asset.height)) : 1,
    backgroundColor: colors.backgroundElement,
  })}>
    {!failed && asset.mediaType === 'image' ? <Image source={asset.uri} recyclingKey={`${asset.id}:${asset.modifiedAt}`} contentFit="cover" style={tw`w-full h-full`} cachePolicy="memory" onError={() => setFailed(true)} />
      : <View style={tw`flex-1 justify-center items-center px-3 gap-2`}>
        <Text style={tw.style('text-sm font-medium', { color: colors.text })}>{asset.mediaType === 'video' ? 'Video' : 'Preview unavailable'}</Text>
        <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>{asset.filename}</Text>
      </View>}
    <View style={tw`absolute bottom-1 left-1 right-1 rounded px-1 py-1 bg-black/70`}>
      <Text style={tw`text-white text-xs`} numberOfLines={1}>{backupLabel(status)}</Text>
    </View>
  </View>;
}

function GalleryContent() {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const [permission, requestPermission, getPermission] = usePermissions({ granularPermissions: ['photo', 'video'] });
  const [requesting, setRequesting] = useState(false);
  const [generation, setGeneration] = useState(0);
  const { verifiedUrl, account } = useServerStore();
  const allowed = permission?.granted || permission?.accessPrivileges === 'limited';
  const database = useQuery({ queryKey: ['local-database'], queryFn: getLocalDatabase, staleTime: Infinity });
  const gallery = useInfiniteQuery({
    queryKey: ['device-gallery', generation], enabled: !!allowed,
    initialPageParam: 0 as GalleryCursor,
    queryFn: async ({ pageParam }) => {
      const page = await loadDeviceMedia(pageParam);
      await rememberAssets(page.assets);
      return page;
    },
    getNextPageParam: (page) => page.next,
  });
  const assets = useMemo(() => [...new Map((gallery.data?.pages.flatMap((page) => page.assets) ?? []).map((asset) => [asset.id, asset])).values()], [gallery.data]);
  const statuses = useQuery({
    queryKey: ['backup-status', verifiedUrl, account?.id, assets.map((asset) => [asset.id, asset.modifiedAt])],
    queryFn: () => readBackupStatuses(assets, verifiedUrl && account ? { serverUrl: verifiedUrl, accountId: account.id } : null),
    enabled: assets.length > 0,
  });
  useEffect(() => {
    const refresh = () => { void getPermission(); setGeneration((value) => value + 1); queryClient.removeQueries({ queryKey: ['device-gallery'], type: 'inactive' }); };
    const app = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    let timer: ReturnType<typeof setTimeout>;
    const library = allowed ? addListener(() => { clearTimeout(timer); timer = setTimeout(refresh, 500); }) : null;
    return () => { app.remove(); library?.remove(); clearTimeout(timer); };
  }, [allowed, getPermission, queryClient]);
  async function grantAccess() {
    setRequesting(true);
    try {
      if (permission && !permission.canAskAgain) await Linking.openSettings();
      else await requestPermission();
    } catch (error) { toast.error(extract_message(error)); }
    finally { setRequesting(false); }
  }
  if (database.isError) return <PageLoader query={database} />;
  if (!permission) return <ActivityIndicator color={colors.text} style={tw`flex-1`} />;
  if (!allowed) return <View style={tw`flex-1 justify-center px-6 gap-4 pb-24`}>
    <Text style={tw.style('text-xl font-medium text-center', { color: colors.text })}>Your phone gallery</Text>
    <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Allow access to photos and videos to browse them and track backups on this device.</Text>
    <Button label={permission.canAskAgain ? 'Allow gallery access' : 'Open app settings'} loading={requesting} onPress={() => { void grantAccess(); }} />
  </View>;
  return <View style={tw`flex-1`}>
    {permission.accessPrivileges === 'limited' && <View style={tw`px-6 pb-3 gap-2`}>
      <Text style={tw.style('text-sm', { color: colors.textSecondary })}>Showing only photos and videos you allowed.</Text>
      <Button variant="text" label="Manage access" onPress={() => { void presentPermissionsPicker().then(() => getPermission()).then(() => setGeneration((value) => value + 1)).catch((error) => toast.error(extract_message(error))); }} />
    </View>}
    {statuses.isError && <Text style={tw.style('px-6 text-sm', { color: colors.text })}>{extract_message(statuses.error)}</Text>}
    <PageLoader query={gallery}>
      {() => <FlashList data={assets} masonry numColumns={Math.min(6, Math.max(2, Math.floor(width / 150)))} optimizeItemArrangement={false}
        extraData={statuses.data} keyExtractor={(asset) => asset.id}
        renderItem={({ item }) => <GalleryTile asset={item} status={statuses.data?.[item.id]} />}
        contentContainerStyle={tw.style('px-0.5', { paddingBottom: BottomTabInset + 24 })}
        refreshing={gallery.isRefetching && !gallery.isFetchingNextPage}
        onRefresh={() => { void getPermission(); setGeneration((value) => value + 1); void queryClient.invalidateQueries({ queryKey: ['backup-status'] }); }}
        onEndReached={() => { if (gallery.hasNextPage && !gallery.isFetching && !gallery.isFetchNextPageError) void gallery.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={<Text style={tw.style('px-6 py-16 text-center text-base', { color: colors.textSecondary })}>No photos or videos are accessible.</Text>}
        ListFooterComponent={gallery.isFetchingNextPage ? <ActivityIndicator color={colors.text} style={tw`py-6`} /> : gallery.error ? <View style={tw`px-6 py-4 gap-3`}>
          <Text style={tw.style('text-base', { color: colors.text })}>{extract_message(gallery.error)}</Text>
          <Button label="Retry" onPress={() => { if (gallery.isFetchNextPageError) void gallery.fetchNextPage(); else void gallery.refetch(); }} />
        </View> : null}
      />}
    </PageLoader>
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
