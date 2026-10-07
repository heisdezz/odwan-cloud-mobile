import { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LocalAlbums from '@/components/albums/LocalAlbums';
import RemoteAlbums from '@/components/albums/RemoteAlbums';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export default function ExploreScreen() {
  const colors = useTheme();
  const [source, setSource] = useState<'local' | 'remote'>(Platform.OS === 'web' ? 'remote' : 'local');
  return <SafeAreaView edges={['top', 'left', 'right']} style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <Text accessibilityRole="header" style={tw.style('text-3xl font-semibold px-6 pt-6 pb-4', { color: colors.text })}>Albums</Text>
    <View accessibilityRole="tablist" style={tw.style('flex-row mx-6 mb-5 rounded-full p-1', { backgroundColor: colors.backgroundElement })}>
      {([{ value: 'local', label: 'Device' }, { value: 'remote', label: 'Server' }] as const).map((tab) => {
        const selected = source === tab.value;
        return <Pressable key={tab.value} accessibilityRole="tab" accessibilityState={{ selected }}
          onPress={() => setSource(tab.value)}
          style={({ pressed }) => tw.style('flex-1 min-h-12 items-center justify-center rounded-full px-4 py-3', {
            backgroundColor: selected ? colors.backgroundSelected : 'transparent', opacity: pressed ? 0.7 : 1,
          })}>
          <Text style={tw.style('text-base font-medium', { color: selected ? colors.text : colors.textSecondary })}>{tab.label}</Text>
        </Pressable>;
      })}
    </View>
    {source === 'local' ? <LocalAlbums /> : <RemoteAlbums />}
  </SafeAreaView>;
}
