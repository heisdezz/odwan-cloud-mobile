import { Stack, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import LocalAlbumGallery from '@/components/albums/LocalAlbumGallery';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export default function DeviceAlbumScreen() {
  const { id, title } = useLocalSearchParams<{ id: string; title?: string }>();
  const colors = useTheme();
  return <View style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <Stack.Screen options={{ title: title || 'Device album' }} />
    <LocalAlbumGallery id={id} />
  </View>;
}
