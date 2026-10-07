import { memo } from 'react';
import { FlashList, useRecyclingState } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native';
import { Button } from '@/components/ui';
import { BottomTabInset } from '@/constants/theme';
import { extract_message } from '@/helpers/api';
import { mediaAspectRatio, mediaName, mediaStreamUrl } from '@/helpers/media';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import type { MediaItemResponse } from '../../../pocketbase-types';

const MediaTile = memo(function MediaTile({ item, serverUrl, token }: { item: MediaItemResponse; serverUrl: string; token: string }) {
  const colors = useTheme();
  const [failed, setFailed] = useRecyclingState(false, [item.id, serverUrl, token]);
  const video = item.mime_type.startsWith('video/');
  const available = item.upload_status === 'success' && !!item.storage_key;
  return <View accessible accessibilityLabel={`${video ? 'Video' : 'Photo'}: ${mediaName(item)}`} style={tw.style('m-0.5 overflow-hidden', { aspectRatio: mediaAspectRatio(item.metadata_json), backgroundColor: colors.backgroundElement })}>
    {available && !video && !failed ? <Image
      source={{ uri: mediaStreamUrl(serverUrl, item.id), headers: { Authorization: token } }}
      recyclingKey={`${serverUrl}:${item.id}:${item.file_hash}`}
      style={tw`w-full h-full`} contentFit="cover" cachePolicy="memory" transition={0}
      onError={() => setFailed(true)}
    /> : <View style={tw`flex-1 items-center justify-center px-3 gap-2`}>
      <Text style={tw.style('text-sm text-center font-medium', { color: colors.text })}>{video ? 'Video' : failed ? 'Image unavailable' : 'Upload pending'}</Text>
      <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>{mediaName(item)}</Text>
    </View>}
  </View>;
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
};

export function MediaGrid({ items, serverUrl, token, refreshing, onRefresh, onLoadMore, loadingMore, error }: MediaGridProps) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const columns = Math.min(6, Math.max(2, Math.floor(width / 150)));
  return <FlashList
    masonry numColumns={columns} optimizeItemArrangement={false}
    data={items} keyExtractor={(item) => item.id}
    renderItem={({ item }) => <MediaTile item={item} serverUrl={serverUrl} token={token} />}
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
  />;
}
