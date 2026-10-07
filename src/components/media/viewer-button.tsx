import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable } from 'react-native';
import tw from '@/lib/tw';

export function ViewerButton({ label, icon, onPress, disabled = false, prominent = false, selected = false }: {
  label: string; icon: SymbolViewProps['name']; onPress: () => void; disabled?: boolean; prominent?: boolean; selected?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, selected }}
    disabled={disabled} onPress={onPress}
    style={({ pressed }) => tw.style('items-center justify-center rounded-full',
      prominent ? 'h-12 w-12 bg-white/20' : 'h-12 w-12 border border-white/20',
      disabled && 'opacity-30', pressed && 'opacity-60')}>
    <SymbolView name={icon} size={prominent ? 26 : 22} tintColor={selected ? '#fda4af' : 'white'} />
  </Pressable>;
}
