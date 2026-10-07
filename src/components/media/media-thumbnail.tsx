import { Image } from 'expo-image';
import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import type { MediaThumbnailProps } from './media-thumbnail.types';
// Native thumbnails are persisted in app storage. Web uses the original image/poster fallback.
export function MediaThumbnail({ source, name, video, enabled = true }: MediaThumbnailProps) {
  const colors = useTheme();
  if (!video) return enabled ? <Image source={source} recyclingKey={JSON.stringify(source)} style={tw`w-full h-full`} contentFit="cover" cachePolicy="memory" /> : null;
  return <View style={tw`flex-1 items-center justify-center px-3 gap-2`}>
    <Text style={tw.style('text-sm font-medium', { color: colors.text })}>Video</Text>
    <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>{name}</Text>
  </View>;
}
