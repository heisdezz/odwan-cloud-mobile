import { Pressable, Text, View } from 'react-native';
import { useAppTheme, type ThemeMode } from '@/providers/app-theme-provider';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export function AppearanceSettings() {
  const colors = useTheme();
  const { mode, setTheme } = useAppTheme();
  return <View style={tw`gap-3`}>
    <Text style={tw.style('text-xl font-medium', { color: colors.text })}>Appearance</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="App theme" style={tw`flex-row gap-2`}>
      {(['system', 'light', 'dark'] as ThemeMode[]).map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ checked: mode === value }}
        onPress={() => { void setTheme(value); }} style={tw.style('flex-1 min-h-12 items-center justify-center rounded-full', { backgroundColor: mode === value ? colors.backgroundSelected : colors.backgroundElement })}>
        <Text style={tw.style('text-sm font-medium capitalize', { color: colors.text })}>{value}</Text>
      </Pressable>)}
    </View>
  </View>;
}
