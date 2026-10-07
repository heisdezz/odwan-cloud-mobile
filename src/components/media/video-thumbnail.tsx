import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import type { VideoThumbnailProps } from './video-thumbnail.types';
// Browser previews need a backend poster endpoint; native decoding is mobile-only.
export function VideoThumbnail({ name }: VideoThumbnailProps) {
  const colors = useTheme();
  return <View style={tw`flex-1 items-center justify-center px-3 gap-2`}>
    <Text style={tw.style('text-sm font-medium', { color: colors.text })}>Video</Text>
    <Text numberOfLines={2} style={tw.style('text-xs text-center', { color: colors.textSecondary })}>{name}</Text>
  </View>;
}
