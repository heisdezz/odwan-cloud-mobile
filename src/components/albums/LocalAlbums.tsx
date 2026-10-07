import { Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
export default function LocalAlbums() {
  const colors = useTheme();
  return <View style={tw`flex-1 justify-center items-center px-6 pb-24`}>
    <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Device albums are available in the Android and iOS app.</Text>
  </View>;
}
