import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { generateVideoThumbnail } from '@/lib/video-thumbnails.native';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import type { VideoThumbnailProps } from './video-thumbnail.types';

export function VideoThumbnail({ source, cacheKey, name, local, enabled = true }: VideoThumbnailProps) {
  const colors = useTheme();
  const preview = useQuery({ queryKey: ['video-thumbnail', ...cacheKey],
    queryFn: ({ signal }) => generateVideoThumbnail(source, signal),
    enabled, staleTime: Infinity, gcTime: 30_000, retry: false, networkMode: local ? 'always' : 'online',
  });
  return <View style={tw`w-full h-full`}>
    {preview.data ? <Image accessible accessibilityLabel={`Video preview: ${name}`} source={preview.data} recyclingKey={JSON.stringify(cacheKey)} style={tw`w-full h-full`} contentFit="cover" cachePolicy="memory" />
      : <View style={tw`flex-1 justify-center items-center px-1 gap-2`}>
        {preview.isPending ? <ActivityIndicator color={colors.textSecondary} /> : <Pressable onPress={() => { void preview.refetch(); }} accessibilityRole="button" accessibilityLabel={`Retry video preview for ${name}`} style={tw`min-h-11 justify-center px-1`}>
          <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>Retry preview</Text>
        </Pressable>}
      </View>}
    <View pointerEvents="none" style={tw`absolute top-1 right-1 bg-black/70 rounded p-1`}>
      <Image source={require('@/assets/images/tabIcons/explore-outline.svg')} tintColor="white" style={tw`h-4 w-4`} contentFit="contain" />
    </View>
  </View>;
}
