import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import { useServerStore } from '@/stores/server-store';
import { createTaskQueue } from '@/lib/task-queue';
import { withRemoteThumbnailSource } from '@/lib/remote-thumbnail-source';
import { fetchServerThumbnail, retryServerThumbnail, serverThumbnailRetryDelay } from '@/lib/server-thumbnail';
import tw from '@/lib/tw';
import type { MediaThumbnailProps } from './media-thumbnail.types';

const enqueue = createTaskQueue(1);

export function MediaThumbnail(props: MediaThumbnailProps) {
  const colors = useTheme();
  if (props.enabled === false) return <View style={tw.style('w-full h-full', { backgroundColor: colors.backgroundElement })} />;
  if (props.cacheKey[0] === 'remote') return <ServerThumbnail {...props} />;
  if (!props.video) return <Image source={props.source} recyclingKey={JSON.stringify(props.cacheKey)} style={tw`w-full h-full`} contentFit="cover" cachePolicy="memory" />;
  return <View style={tw`flex-1 items-center justify-center px-3 gap-2`}>
    <Text style={tw.style('text-sm font-medium', { color: colors.text })}>Video</Text>
    <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>{props.name}</Text>
  </View>;
}

/** Fetch headers explicitly: browser image elements cannot attach Authorization. */
function ServerThumbnail({ source, cacheKey, name, video }: MediaThumbnailProps) {
  const colors = useTheme();
  const revision = useServerStore((state) => state.revision);
  const identity = JSON.stringify([...cacheKey, revision, 'pocketbase-thumb-v2']);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const [object, setObject] = useState<{ bytes: Uint8Array; uri: string } | null>(null);
  const preview = useQuery({
    queryKey: ['media-thumbnail', ...cacheKey, revision, 'pocketbase-thumb-v2'],
    queryFn: ({ signal }) => enqueue(() => withRemoteThumbnailSource({
      download: (downloadSignal, progress) => fetchServerThumbnail(source, downloadSignal, progress),
      publish: async (bytes) => bytes, cleanup: () => {},
    }, { timeoutMs: 60_000, maxBytes: 1024 * 1024 }), signal),
    staleTime: Infinity, gcTime: 30_000, retry: retryServerThumbnail,
    retryDelay: serverThumbnailRetryDelay, networkMode: 'always',
  });
  useEffect(() => {
    if (!preview.data) return;
    const uri = URL.createObjectURL(new Blob([new Uint8Array(preview.data)], { type: 'image/jpeg' }));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Publish the browser resource owned and revoked by this effect.
    setObject({ bytes: preview.data, uri });
    return () => URL.revokeObjectURL(uri);
  }, [preview.data]);
  const failed = failedKey === identity;
  return <View style={tw`w-full h-full`}>
    {object && object.bytes === preview.data && !failed ? <Image key={preview.dataUpdatedAt} source={object.uri}
      accessible accessibilityLabel={`${video ? 'Video' : 'Photo'} preview: ${name}`} recyclingKey={identity}
      style={tw`w-full h-full`} contentFit="cover" cachePolicy="memory" onError={() => setFailedKey(identity)} />
      : <View style={tw`flex-1 items-center justify-center`}>
        {(preview.isPending || preview.isFetching) && !failed ? <ActivityIndicator color={colors.textSecondary} />
          : <Pressable accessibilityRole="button" accessibilityLabel={`Retry preview for ${name}`} style={tw`min-h-11 justify-center px-1`}
            onPress={(event) => { event.stopPropagation(); setFailedKey(null); void preview.refetch(); }}>
            <Text style={tw.style('text-xs text-center', { color: colors.textSecondary })}>Retry preview</Text>
          </Pressable>}
      </View>}
  </View>;
}
