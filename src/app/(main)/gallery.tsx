import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DeviceGallery from '@/components/gallery/device-gallery';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
export default function GalleryScreen() {
  const colors = useTheme();
  return <SafeAreaView edges={['top']} style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <Text style={tw.style('text-3xl font-semibold px-6 pt-6 pb-4', { color: colors.text })}>Gallery</Text>
    <DeviceGallery />
  </SafeAreaView>;
}
