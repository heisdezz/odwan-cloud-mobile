import { useQuery } from '@tanstack/react-query';
import { useRecyclingState } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { getMediaThumbnail, deleteMediaThumbnail } from '@/lib/media-thumbnails.native';
import { useServerStore } from '@/stores/server-store';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import type { MediaThumbnailProps } from './media-thumbnail.types';

export function MediaThumbnail({ source, cacheKey, name, video = false, enabled = true }: MediaThumbnailProps) {
  const colors = useTheme();
  const revision = useServerStore((state) => state.revision);
  const identity = JSON.stringify(cacheKey);
  const [failed, setFailed] = useRecyclingState(false, [identity, revision]);
  const preview = useQuery({ queryKey: ['media-thumbnail', ...cacheKey, revision],
    queryFn: ({ signal }) => getMediaThumbnail(source, cacheKey, video, signal),
    enabled, staleTime: Infinity, gcTime: 30_000, retry: false,
    // Disk hits must work offline. Network misses fail normally and offer retry.
    networkMode: 'always',
  });
  return <View style={tw`w-full h-full`}>
    {preview.data && !failed && !preview.isFetching ? <Image accessible accessibilityLabel={`${video ? 'Video' : 'Photo'} preview: ${name}`} source={preview.data} recyclingKey={identity} style={tw`w-full h-full`} contentFit="cover" cachePolicy="memory" onError={() => setFailed(true)} />
      : <View style={tw`flex-1 justify-center items-center px-1 gap-2`}>
        {(preview.isPending || preview.isFetching) && !failed ? <ActivityIndicator color={colors.textSecondary} /> : <Pressable onPress={(event) => {
          event.stopPropagation();
          if (failed && preview.data) deleteMediaThumbnail(preview.data);
          setFailed(false); void preview.refetch();
        }} accessibilityRole="button" accessibilityLabel={`Retry preview for ${name}`} style={tw`min-h-11 justify-center px-1`}>
          <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>Retry preview</Text>
        </Pressable>}
      </View>}
    {video && <View pointerEvents="none" style={tw`absolute top-1 right-1 bg-black/70 rounded p-1`}>
      <Image source={require('@/assets/images/tabIcons/explore-outline.svg')} tintColor="white" style={tw`h-4 w-4`} contentFit="contain" />
    </View>}
  </View>;
}
