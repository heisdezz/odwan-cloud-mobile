import { memo, useEffect, useRef } from 'react';
import { FlashList, useRecyclingState } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useMediaViewer } from '@/providers/media-viewer-provider';
import { remoteViewerItem } from '@/helpers/media-viewer';
import { GridZoom } from './grid-zoom';
import { VideoThumbnail } from './video-thumbnail';
import { useServerStore } from '@/stores/server-store';
import { Button } from '@/components/ui';
import { BottomTabInset } from '@/constants/theme';
import { extract_message } from '@/helpers/api';
import { mediaAspectRatio, mediaName, mediaStreamUrl } from '@/helpers/media';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import type { MediaItemResponse } from '../../../pocketbase-types';

const MediaTile = memo(function MediaTile({ item, serverUrl, token, previewEnabled, onPress }: { item: MediaItemResponse; serverUrl: string; token: string; previewEnabled: boolean; onPress: (id: string) => void }) {
  const colors = useTheme();
  const [failed, setFailed] = useRecyclingState(false, [item.id, serverUrl, token]);
  const revision = useServerStore((state) => state.revision);
  const accountId = useServerStore((state) => state.account?.id);
  const video = item.mime_type.startsWith('video/');
  const available = item.upload_status === 'success' && !!item.storage_backend && !!item.storage_bucket && !!item.storage_key;
  return <Pressable onPress={() => onPress(item.id)} accessibilityRole="button" accessible accessibilityLabel={`${video ? 'Video' : 'Photo'}: ${mediaName(item)}`} style={tw.style('m-0.5 overflow-hidden', { aspectRatio: mediaAspectRatio(item.metadata_json), backgroundColor: colors.backgroundElement })}>
    {available && video ? <VideoThumbnail source={{ uri: mediaStreamUrl(serverUrl, item.id), headers: { Authorization: token }, useCaching: false }}
      cacheKey={['remote', serverUrl, accountId ?? '', revision, item.id, item.file_hash, item.storage_backend, item.storage_bucket, item.storage_key]} name={mediaName(item)} enabled={previewEnabled} /> : available && !video && !failed ? <Image
      source={{ uri: mediaStreamUrl(serverUrl, item.id), headers: { Authorization: token } }}
      recyclingKey={`${serverUrl}:${item.id}:${item.file_hash}`}
      style={tw`w-full h-full`} contentFit="cover" cachePolicy="memory" transition={0}
      onError={() => setFailed(true)}
    /> : <View style={tw`flex-1 items-center justify-center px-3 gap-2`}>
      <Text style={tw.style('text-sm text-center font-medium', { color: colors.text })}>{video ? 'Video' : failed ? 'Image unavailable' : 'Upload pending'}</Text>
      <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>{mediaName(item)}</Text>
    </View>}
  </Pressable>;
});

type MediaGridProps = {
  items: MediaItemResponse[];
  serverUrl: string;
  token: string;
  refreshing: boolean;
  onRefresh: () => void;
  onLoadMore: () => void;
  loadingMore: boolean;
  error?: unknown;
  albumId?: string;
  loadViewerPage?: () => Promise<MediaItemResponse[] | undefined>;
};

export function MediaGrid({ items, serverUrl, token, refreshing, onRefresh, onLoadMore, loadingMore, error, albumId, loadViewerPage }: MediaGridProps) {
  const colors = useTheme();
  const viewer = useMediaViewer();
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);
  const open = (id: string) => {
    const current = useServerStore.getState();
    if (!current.account || current.verifiedUrl !== serverUrl) return;
    viewer.open({ items: itemsRef.current.map(remoteViewerItem), selectedId: id, albumId,
      scope: { serverUrl, accountId: current.account.id, revision: current.revision },
      loadMore: loadViewerPage ? async () => (await loadViewerPage())?.map(remoteViewerItem) : undefined });
  };
  return <GridZoom>{(columns) => <FlashList
    masonry numColumns={columns} optimizeItemArrangement={false}
    data={items} keyExtractor={(item) => item.id}
    renderItem={({ item, target }) => <MediaTile item={item} serverUrl={serverUrl} token={token} previewEnabled={target === 'Cell'} onPress={open} />}
    contentContainerStyle={tw.style('px-0.5', { paddingBottom: BottomTabInset + 24 })}
    refreshing={refreshing} onRefresh={onRefresh}
    onEndReached={onLoadMore} onEndReachedThreshold={0.5}
    ListEmptyComponent={<View style={tw`px-6 py-20 gap-3 items-center`}>
      <Text style={tw.style('text-xl font-medium', { color: colors.text })}>No media yet</Text>
      <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Items from your server will appear here.</Text>
    </View>}
    ListFooterComponent={loadingMore ? <ActivityIndicator style={tw`py-6`} color={colors.text} /> : error ? <View style={tw`px-6 py-6 gap-3`}>
      <Text accessibilityRole="alert" style={tw.style('text-base', { color: colors.text })}>{extract_message(error)}</Text>
      <Button label="Retry" onPress={onLoadMore} />
    </View> : null}
  />}</GridZoom>;
}
