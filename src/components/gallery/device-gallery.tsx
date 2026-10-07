import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
export default function DeviceGallery() {
  const colors = useTheme();
  return <View style={tw`flex-1 items-center justify-center px-6`}><Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>The device gallery is available in the Android and iOS app.</Text></View>;
}
