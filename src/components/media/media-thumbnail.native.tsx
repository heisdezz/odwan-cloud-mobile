import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { getMediaThumbnail, deleteMediaThumbnail } from '@/lib/media-thumbnails.native';
import { useServerStore } from '@/stores/server-store';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import type { MediaThumbnailProps } from './media-thumbnail.types';

export function MediaThumbnail(props: MediaThumbnailProps) {
  const colors = useTheme();
  // Unmount the query observer outside the buffer: TanStack aborts its queued
  // request. Started native jobs still finish and persist their thumbnail.
  return props.enabled === false
    ? <View style={tw.style('w-full h-full', { backgroundColor: colors.backgroundElement })} />
    : <ActiveThumbnail {...props} />;
}

function ActiveThumbnail({ source, cacheKey, name, video = false }: MediaThumbnailProps) {
  const colors = useTheme();
  const revision = useServerStore((state) => state.revision);
  const identity = JSON.stringify(cacheKey);
  const failureKey = JSON.stringify([cacheKey, revision]);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // A recycled row must not inherit a different media item's preview error.
  const failed = failedKey === failureKey;
  const preview = useQuery({ queryKey: ['media-thumbnail', ...cacheKey, revision],
    queryFn: ({ signal }) => getMediaThumbnail(source, cacheKey, video, signal),
    staleTime: Infinity, gcTime: 30_000, retry: false,
    // Disk hits must work offline. Network misses fail normally and offer retry.
    networkMode: 'always',
  });
  return <View style={tw`w-full h-full`}>
    {preview.data && !failed && !preview.isFetching ? <Image accessible accessibilityLabel={`${video ? 'Video' : 'Photo'} preview: ${name}`} source={preview.data} recyclingKey={identity} style={tw`w-full h-full`} contentFit="cover" cachePolicy="memory" onError={() => setFailedKey(failureKey)} />
      : <View style={tw`flex-1 justify-center items-center px-1 gap-2`}>
        {(preview.isPending || preview.isFetching) && !failed ? <ActivityIndicator color={colors.textSecondary} /> : <Pressable onPress={(event) => {
          event.stopPropagation();
          if (failed && preview.data) deleteMediaThumbnail(preview.data);
          setFailedKey(null); void preview.refetch();
        }} accessibilityRole="button" accessibilityLabel={`Retry preview for ${name}`} style={tw`min-h-11 justify-center px-1`}>
          <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>Retry preview</Text>
        </Pressable>}
      </View>}
  </View>;
}
