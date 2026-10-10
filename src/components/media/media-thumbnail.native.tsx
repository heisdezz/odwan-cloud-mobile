import { useThumbnailCacheStore } from '@/stores/thumbnail-cache-store';
import { ThumbnailRetry } from './thumbnail-retry';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { ActivityIndicator, View } from 'react-native';
import { getMediaThumbnail, deleteMediaThumbnail, invalidateMediaThumbnail, retainMediaThumbnail } from '@/lib/media-thumbnails.native';
import { useServerStore } from '@/stores/server-store';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import type { MediaThumbnailProps } from './media-thumbnail.types';
import { retryServerThumbnail, serverThumbnailRetryDelay } from '@/lib/server-thumbnail';

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
  // Login changes remote authorization, not device thumbnail identity or observers.
  const epoch = useThumbnailCacheStore((state) => state.epoch);
  const revision = useServerStore((state) => cacheKey[0] === 'remote' ? state.revision : 0);
  const backend = cacheKey[0] === 'remote' ? ['pocketbase-thumb-v2'] : [];
  const identity = JSON.stringify([...cacheKey, ...backend]);
  const failureKey = JSON.stringify([identity, revision, epoch]);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  // A recycled row must not inherit a different media item's preview error.
  const failed = failedKey === failureKey;
  const preview = useQuery({ queryKey: ['media-thumbnail', ...cacheKey, revision, ...backend, epoch],
    queryFn: ({ signal }) => getMediaThumbnail(source, cacheKey, video, signal),
    staleTime: Infinity, gcTime: 0,
    retry: cacheKey[0] === 'remote' ? retryServerThumbnail : false,
    retryDelay: serverThumbnailRetryDelay,
    // Disk hits must work offline. Network misses fail normally and offer retry.
    networkMode: 'always',
  });
  useEffect(() => preview.data ? retainMediaThumbnail(preview.data) : undefined, [preview.data]);
  return <View style={tw`w-full h-full`}>
    {preview.data && !failed && !preview.isFetching ? <Image accessible accessibilityLabel={`${video ? 'Video' : 'Photo'} preview: ${name}`} source={preview.data} recyclingKey={identity} style={tw`w-full h-full`} contentFit="cover" cachePolicy="memory" onError={() => { invalidateMediaThumbnail(preview.data!); setFailedKey(failureKey); }} />
      : <View style={tw`flex-1 justify-center items-center px-1 gap-2`}>
        {(preview.isPending || preview.isFetching) && !failed ? <ActivityIndicator color={colors.textSecondary} /> : <ThumbnailRetry name={name} error={preview.error} onRetry={() => {
          if (failed && preview.data) deleteMediaThumbnail(preview.data);
          setFailedKey(null); void preview.refetch();
        }} />}
      </View>}
  </View>;
}
