import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useQuery } from '@tanstack/react-query';
import { useMediaViewer } from '@/providers/media-viewer-provider';
import { localViewerItem } from '@/helpers/media-viewer';
import { MediaTypeFilter } from '@/components/media/media-filter';
import { indexMediaFilters } from '@/helpers/media-filter';
import { useGridStore } from '@/stores/grid-store';
import { GridZoom } from '@/components/media/grid-zoom';
import { MediaThumbnail } from '@/components/media/media-thumbnail';
import { MediaTileBadges } from '@/components/media/media-tile-badges';
import { presentPermissionsPicker } from '@/lib/device-media.native';
import { useGallerySync } from '@/providers/gallery-sync-provider.native';
import { ActivityIndicator, Linking, Platform, Pressable, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import PageLoader from '@/components/layouts/PageLoader';
import { Button } from '@/components/ui';
import { BottomTabInset } from '@/constants/theme';
import { readFullGallery, readGalleryBackupStatuses } from '@/db/local-store.native';
import { backupLabel, type BackupStatus, type LocalAsset } from '@/db/schema';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import { useServerStore } from '@/stores/server-store';
import { useAssetBackupStatus } from '@/providers/upload-activity-provider';

const EMPTY_ASSETS: LocalAsset[] = [];
const assetKey = (asset: LocalAsset) => asset.id;
const assetType = (asset: LocalAsset) => asset.mediaType;

const GalleryTile = memo(function GalleryTile({ asset, status: savedStatus, previewEnabled, onPress, size }: { asset: LocalAsset; status?: BackupStatus; previewEnabled: boolean; onPress: (id: string) => void; size: number }) {
  const colors = useTheme();
  const status = useAssetBackupStatus(asset, savedStatus);
  return <Pressable onPress={() => onPress(asset.id)} accessibilityRole="button" accessible accessibilityLabel={`${asset.mediaType === 'video' ? 'Video' : 'Photo'}: ${asset.filename}. ${backupLabel(status)}`} style={tw.style('m-0.5 overflow-hidden', {
    width: size - 4, height: size - 4,
    backgroundColor: colors.backgroundElement,
  })}>
    {asset.mediaType === 'video' || asset.mediaType === 'image' ? <MediaThumbnail source={{ uri: asset.uri }} cacheKey={['local', asset.id, asset.modifiedAt]} name={asset.filename} local video={asset.mediaType === 'video'} enabled={previewEnabled} />
      : <View style={tw`flex-1 justify-center items-center px-3 gap-2`}>
        <Text style={tw.style('text-sm font-medium', { color: colors.text })}>{asset.mediaType === 'video' ? 'Video' : 'Preview unavailable'}</Text>
        <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>{asset.filename}</Text>
      </View>}
    <MediaTileBadges video={asset.mediaType === 'video'} showBackup status={status} />
  </Pressable>;
});

function GalleryContent() {
  const colors = useTheme();
  const { permission, requestPermission, refresh, allowed, cacheReadable, database, sync } = useGallerySync();
  const [requesting, setRequesting] = useState(false);
  const { verifiedUrl, account } = useServerStore();
  const gallery = useQuery({
    queryKey: ['device-gallery', 'all'], enabled: cacheReadable && database.isSuccess,
    queryFn: readFullGallery, networkMode: 'always', staleTime: Infinity,
  });
  const mediaFilter = useGridStore((state) => state.mediaFilter);
  const allAssets = gallery.data ?? EMPTY_ASSETS;
  const displayedFilter = useDeferredValue(mediaFilter);
  const indexedAssets = useMemo(() => indexMediaFilters(allAssets, assetType), [allAssets]);
  const assets = indexedAssets[displayedFilter];
  const viewer = useMediaViewer();
  const assetsRef = useRef(assets);
  useEffect(() => { assetsRef.current = assets; }, [assets]);
  const open = useCallback((id: string) => viewer.open({ items: assetsRef.current.map(localViewerItem), selectedId: id }), [viewer]);
  const statuses = useQuery({
    queryKey: ['backup-status', 'gallery', verifiedUrl, account?.id, gallery.dataUpdatedAt],
    queryFn: () => readGalleryBackupStatuses(verifiedUrl && account ? { serverUrl: verifiedUrl, accountId: account.id } : null),
    enabled: cacheReadable && database.isSuccess && assets.length > 0,
  });
  const renderItem = useCallback(({ item, size, previewEnabled }: { item: LocalAsset; size: number; previewEnabled: boolean }) =>
    <GalleryTile asset={item} status={statuses.data?.[item.id]} previewEnabled={previewEnabled} onPress={open} size={size} />,
  [statuses.data, open]);
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
    <MediaTypeFilter refreshing={sync.running} onRefresh={() => { void refresh().catch((error) => toast.error(extract_message(error))); }} />
    {!cacheReadable ? <ActivityIndicator color={colors.text} style={tw`py-4`} /> : null}
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
      {() => <GridZoom resetKey={displayedFilter} data={assets}
        extraData={statuses.data} keyExtractor={assetKey} getItemType={assetType}
        renderItem={renderItem}
        contentInsets={{ bottom: BottomTabInset + 24 }}
        ListEmptyComponent={<Text style={tw.style('px-6 py-16 text-center text-base', { color: colors.textSecondary })}>{sync.running ? 'Indexing your photos and videos…' : displayedFilter === 'all' ? 'No photos or videos are accessible.' : `No ${displayedFilter} are accessible.`}</Text>}
        ListFooterComponent={gallery.error ? <View style={tw`px-6 py-4 gap-3`}>
          <Text style={tw.style('text-base', { color: colors.text })}>{extract_message(gallery.error)}</Text>
          <Button label="Retry" onPress={() => { void gallery.refetch(); }} />
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
