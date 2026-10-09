import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { useStore } from 'zustand';
import type { MediaSelectionStore } from '@/lib/media-selection';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

function Action({ label, icon, onPress, disabled = false }: {
  label: string; icon: React.ComponentProps<typeof SymbolView>['name']; onPress: () => void; disabled?: boolean;
}) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => tw.style('h-11 w-11 items-center justify-center rounded-full', { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}>
    <SymbolView name={icon} size={23} tintColor={colors.text} />
  </Pressable>;
}

export function DeviceGallerySelection({ selection, ids, bottom, onUpload }: {
  selection: MediaSelectionStore; ids: readonly string[]; bottom: number; onUpload: (ids: readonly string[]) => void;
}) {
  const colors = useTheme();
  const selecting = useStore(selection, (state) => state.selecting);
  const count = useStore(selection, (state) => state.selected.size);
  if (!selecting) return null;
  const actions = selection.getState();
  return <View pointerEvents="box-none" style={tw.style('absolute left-3 right-3 items-center z-30', { bottom })}>
    <View style={tw.style('w-full max-w-md flex-row items-center rounded-full px-2 py-1', {
      backgroundColor: colors.backgroundElement, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8,
    })}>
      <Action label="Exit selection" icon={{ ios: 'xmark', android: 'close', web: 'close' }} onPress={actions.clear} />
      <Text accessibilityLiveRegion="polite" accessibilityLabel={`${count} selected`} numberOfLines={1} style={tw.style('flex-1 px-2 text-base font-semibold', { color: colors.text })}>{count}</Text>
      <Action label="Select all filtered media" icon={{ ios: 'checkmark.circle', android: 'select_all', web: 'select_all' }} disabled={!ids.length} onPress={() => actions.replace(ids)} />
      <Action label={`Upload ${count} selected items`} icon={{ ios: 'icloud.and.arrow.up', android: 'cloud_upload', web: 'cloud_upload' }} disabled={!count} onPress={() => onUpload([...selection.getState().selected])} />
    </View>
  </View>;
}
