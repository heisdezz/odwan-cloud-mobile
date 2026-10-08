import { memo, useCallback, useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import LocalMediaAccess from './LocalMediaAccess.native';
import PageLoader from '@/components/layouts/PageLoader';
import { MediaTypeFilter } from '@/components/media/media-filter';
import { indexMediaFilters } from '@/helpers/media-filter';
import { useGridStore } from '@/stores/grid-store';
import { GridZoom } from '@/components/media/grid-zoom';
import { MediaThumbnail } from '@/components/media/media-thumbnail';
import { MediaTileBadges } from '@/components/media/media-tile-badges';
import { UploadDestinationSheet } from '@/components/uploads/upload-destination-sheet';
import { UploadQueueSheet } from '@/components/uploads/upload-queue-sheet';
import { Button } from '@/components/ui';
import { extract_message } from '@/helpers/api';
import { localViewerItem } from '@/helpers/media-viewer';
import { useTheme } from '@/hooks/use-theme';
import { useDeviceAlbumAssets } from '@/hooks/use-device-album-assets.native';
import { loadDeviceAlbums } from '@/lib/device-albums.native';
import { readBackupStatuses } from '@/db/local-store.native';
import { backupLabel, type BackupStatus, type LocalAsset } from '@/db/schema';
import tw from '@/lib/tw';
import { useMediaViewer } from '@/providers/media-viewer-provider';
import { useAssetBackupStatus, useUploadPendingCount } from '@/providers/upload-activity-provider';
import { useServerStore } from '@/stores/server-store';

const assetKey = (asset: LocalAsset) => asset.id;
const assetType = (asset: LocalAsset) => asset.mediaType;
const EMPTY_ASSETS: LocalAsset[] = [];

const AlbumTile = memo(function AlbumTile({ item, size, previewEnabled, selecting, selected, status: savedStatus, onToggle, onOpen, onSelect }: {
  item: LocalAsset; size: number; previewEnabled: boolean; selecting: boolean; selected: boolean; status?: BackupStatus;
  onToggle: (id: string) => void; onOpen: (id: string) => void; onSelect: (id: string) => void;
}) {
  const colors = useTheme();
  const status = useAssetBackupStatus(item, savedStatus);
  return <Pressable accessibilityRole={selecting ? 'checkbox' : 'button'}
    accessibilityLabel={`${item.mediaType === 'video' ? 'Video' : 'Photo'}: ${item.filename}. ${backupLabel(status)}`}
    accessibilityHint={selecting ? 'Toggle selection' : 'Hold to select for upload'} accessibilityState={selecting ? { checked: selected } : undefined}
    onPress={() => selecting ? onToggle(item.id) : onOpen(item.id)} onLongPress={() => onSelect(item.id)}
    style={tw.style('m-0.5 overflow-hidden', { width: size - 4, height: size - 4, backgroundColor: colors.backgroundElement })}>
    <MediaThumbnail source={{ uri: item.uri }} cacheKey={['local', item.id, item.modifiedAt]}
      name={item.filename} local video={item.mediaType === 'video'} enabled={previewEnabled} />
    <MediaTileBadges video={item.mediaType === 'video'} showBackup status={status} />
    {selected && <View pointerEvents="none" style={tw.style('absolute inset-0 border-2', { borderColor: colors.primary })} />}
    {selecting && <View pointerEvents="none" style={tw.style('absolute top-1 left-1 h-6 w-6 rounded-full items-center justify-center', { backgroundColor: selected ? colors.primary : '#00000088', borderWidth: 1, borderColor: 'white' })}>
      {selected && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} tintColor={colors.onPrimary} />}
    </View>}
  </Pressable>;
});

/** Keep toolbar actions in Yoga so native control measurement cannot expand this row. */
function AlbumAction({ label, accessibilityLabel = label, onPress, disabled = false }: {
  label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean;
}) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => tw.style('min-h-11 shrink-0 px-3 rounded-full items-center justify-center', {
      backgroundColor: colors.backgroundElement, opacity: disabled ? 0.38 : pressed ? 0.7 : 1,
    })}>
    <Text style={tw.style('text-sm font-medium', { color: colors.text })}>{label}</Text>
  </Pressable>;
}

function AlbumContent({ id, title }: { id: string; title?: string }) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const viewer = useMediaViewer();
  const pending = useUploadPendingCount();
  const { verifiedUrl, account, revision } = useServerStore();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [sheet, setSheet] = useState<'destination' | 'queue' | null>(null);
  const query = useDeviceAlbumAssets(id);
  const deviceAlbums = useQuery({ queryKey: ['device-albums', 'list'], queryFn: loadDeviceAlbums,
    enabled: !title, staleTime: Infinity, networkMode: 'always' });
  const albumName = title ?? deviceAlbums.data?.find((album) => album.id === id)?.title ?? '';
  const scope = useMemo(() => verifiedUrl && account ? { serverUrl: verifiedUrl, accountId: account.id } : null, [verifiedUrl, account]);
  const backup = useQuery({ queryKey: ['backup-status', 'device-album', id, verifiedUrl, account?.id, query.dataUpdatedAt],
    enabled: !!scope && query.isSuccess, queryFn: () => readBackupStatuses(query.data ?? [], scope), staleTime: Infinity, networkMode: 'always' });
  const statuses = backup.data;
  const mediaFilter = useGridStore((state) => state.mediaFilter);
  // Let the filter chips respond before the recycler updates a large dataset.
  const displayedFilter = useDeferredValue(mediaFilter);
  const indexedAssets = useMemo(() => indexMediaFilters(query.data ?? EMPTY_ASSETS, assetType), [query.data]);
  const assets = indexedAssets[displayedFilter];
  const selectedAssets = useMemo(() => (query.data ?? []).filter((asset) => selected.has(asset.id)), [query.data, selected]);
  const toggle = useCallback((assetId: string) => setSelected((old) => { const next = new Set(old); if (next.has(assetId)) next.delete(assetId); else next.add(assetId); return next; }), []);
  const select = useCallback((assetId: string) => { setSelecting(true); setSelected((old) => new Set(old).add(assetId)); }, []);
  const open = useCallback((assetId: string) => viewer.open({ items: assets.map(localViewerItem), selectedId: assetId }), [assets, viewer]);
  const cancel = useCallback(() => { setSelecting(false); setSelected(new Set()); }, []);
  const renderItem = useCallback(({ item, size, previewEnabled }: { item: LocalAsset; size: number; previewEnabled: boolean }) =>
    <AlbumTile item={item} size={size} previewEnabled={previewEnabled} selecting={selecting} selected={selected.has(item.id)}
      status={statuses?.[item.id]} onToggle={toggle} onOpen={open} onSelect={select} />,
  [selecting, selected, statuses, toggle, open, select]);
  return <View style={tw`flex-1`}>
    <View style={tw`shrink-0 px-4 py-1 flex-row items-center gap-2`}>
      {selecting ? <>
        <AlbumAction label="Done" accessibilityLabel="Exit selection mode" onPress={cancel} />
        <Text accessibilityLiveRegion="polite" numberOfLines={1} style={tw.style('flex-1 text-base font-medium', { color: colors.text })}>{selectedAssets.length} selected</Text>
        <AlbumAction label="All" accessibilityLabel="Select all filtered media" onPress={() => setSelected(new Set(assets.map((asset) => asset.id)))} />
      </> : <>
        <AlbumAction label="Select" disabled={!assets.length} onPress={() => setSelecting(true)} />
        <View style={tw`flex-1`} />
        <AlbumAction label={pending ? `Uploads (${pending})` : 'Uploads'} onPress={() => setSheet('queue')} />
      </>}
    </View>
    <MediaTypeFilter refreshing={query.isFetching} onRefresh={() => { void query.refetch(); }} />
    <PageLoader query={query}>{() => <GridZoom resetKey={displayedFilter} data={assets} keyExtractor={assetKey} getItemType={assetType} renderItem={renderItem}
      extraData={selected} contentInsets={{ bottom: selecting ? 100 + insets.bottom : 24 }}
      ListEmptyComponent={<Text style={tw.style('px-6 py-16 text-base text-center', { color: colors.textSecondary })}>{displayedFilter === 'all' ? 'No accessible photos or videos in this album.' : `No ${displayedFilter} in this album.`}</Text>}
      ListFooterComponent={query.error ? <View style={tw`px-6 py-4 gap-3`}>
        <Text accessibilityRole="alert" style={tw.style('text-base', { color: colors.text })}>{extract_message(query.error)}</Text>
        <Button label="Retry" loading={query.isFetching} onPress={() => { void query.refetch(); }} />
      </View> : null}
    />}</PageLoader>
    {selecting && <View style={tw.style('absolute bottom-0 left-0 right-0 px-6 pt-3', { paddingBottom: Math.max(12, insets.bottom), backgroundColor: colors.background })}>
      <Button label={`Upload ${selectedAssets.length} ${selectedAssets.length === 1 ? 'item' : 'items'}`} disabled={!selectedAssets.length} onPress={() => setSheet('destination')} />
    </View>}
    {sheet === 'destination' && <UploadDestinationSheet key={`${verifiedUrl}:${account?.id}:${revision}`} assets={selectedAssets} albumName={albumName}
      onClose={() => setSheet(null)} onQueued={() => { cancel(); setSheet('queue'); }} />}
    {sheet === 'queue' && <UploadQueueSheet onClose={() => setSheet(null)} />}
  </View>;
}

export default function LocalAlbumGallery({ id, title }: { id: string; title?: string }) {
  return <LocalMediaAccess><AlbumContent key={id} id={id} title={title} /></LocalMediaAccess>;
}
