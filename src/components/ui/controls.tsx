import { ActivityIndicator, Pressable, Switch as NativeSwitch, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import type { ButtonProps, InputProps, ToggleProps } from './types';

export function Button({ label, onPress, variant = 'filled', disabled, loading, style }: ButtonProps) {
  const colors = useTheme();
  const filled = variant === 'filled';
  const foreground = filled ? colors.onPrimary : colors.primary;
  return <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }}
    style={({ pressed }) => [tw`min-h-12 px-6 py-3 rounded-full flex-row items-center justify-center gap-2`, { backgroundColor: filled ? colors.primary : variant === 'tonal' ? colors.backgroundSelected : 'transparent', borderWidth: variant === 'outlined' ? 1 : 0, borderColor: colors.outline, opacity: disabled ? 0.38 : pressed ? 0.7 : 1 }, style]}>
    {loading && <ActivityIndicator color={foreground} />}
    <Text style={[tw`text-base font-medium`, { color: foreground }]}>{label}</Text>
  </Pressable>;
}
export function Input({ label, value, onChangeText, placeholder, helperText, error, disabled, secureTextEntry, keyboardType, onSubmitEditing, style }: InputProps) {
  const colors = useTheme();
  return <View style={[tw`gap-2`, style]}>
    <Text style={[tw`text-sm font-medium`, { color: error ? colors.error : colors.text }]}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.textSecondary} editable={!disabled} secureTextEntry={secureTextEntry} keyboardType={keyboardType} onSubmitEditing={onSubmitEditing} accessibilityLabel={label} accessibilityHint={error || helperText}
      style={[tw`min-h-14 rounded px-4 py-3 text-base border`, { color: colors.text, borderColor: error ? colors.error : colors.outline, opacity: disabled ? 0.38 : 1 }]} />
    {(error || helperText) && <Text accessibilityLiveRegion="polite" style={[tw`text-sm`, { color: error ? colors.error : colors.textSecondary }]}>{error || helperText}</Text>}
  </View>;
}
export function Switch({ label, value, onValueChange, disabled, style }: ToggleProps) {
  const colors = useTheme();
  return <View style={[tw`min-h-12 flex-row items-center gap-3`, style]}><NativeSwitch value={value} onValueChange={onValueChange} disabled={disabled} accessibilityLabel={label} trackColor={{ true: colors.primary }} /><Text style={{ color: colors.text, flexShrink: 1 }}>{label}</Text></View>;
}
export function Checkbox({ label, value, onValueChange, disabled, style }: ToggleProps) {
  const colors = useTheme();
  return <Pressable onPress={() => onValueChange(!value)} disabled={disabled} accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked: value, disabled: !!disabled }} style={[tw`min-h-12 flex-row items-center gap-3`, { opacity: disabled ? 0.38 : 1 }, style]}>
    <View style={[tw`w-6 h-6 rounded border-2 items-center justify-center`, { borderColor: colors.primary, backgroundColor: value ? colors.primary : 'transparent' }]}>{value && <View style={{ width: 8, height: 13, borderRightWidth: 2, borderBottomWidth: 2, borderColor: colors.onPrimary, transform: [{ rotate: '45deg' }], marginTop: -3 }} />}</View>
    <Text style={{ color: colors.text, flexShrink: 1 }}>{label}</Text>
  </Pressable>;
}
