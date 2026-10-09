import { Modal, Pressable, Text, View } from 'react-native';
import { useStore } from 'zustand';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import type { MediaSelectionStore } from '@/lib/media-selection';
import tw from '@/lib/tw';

function Action({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => tw.style('min-h-11 px-3 rounded-full justify-center', { backgroundColor: colors.backgroundElement, opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
    <Text style={tw.style('text-sm font-medium', { color: colors.text })}>{label}</Text>
  </Pressable>;
}

export function ServerMediaSelectionBar({ selection, loadedIds, deleting, onDelete }: {
  selection: MediaSelectionStore; loadedIds: readonly string[]; deleting: boolean; onDelete: (ids: string[]) => void;
}) {
  const colors = useTheme();
  const selecting = useStore(selection, (state) => state.selecting);
  const selected = useStore(selection, (state) => state.selected);
  const actions = selection.getState();
  return <View style={tw`shrink-0 px-4 pb-2 flex-row items-center gap-2`}>
    {selecting ? <>
      <Action label="Done" onPress={actions.clear} disabled={deleting} />
      <Text accessibilityLiveRegion="polite" numberOfLines={1} style={tw.style('flex-1 text-sm', { color: colors.text })}>{selected.size} selected</Text>
      <Action label="All loaded" onPress={() => actions.replace(loadedIds)} disabled={deleting || !loadedIds.length} />
      <Action label="Delete" onPress={() => onDelete([...selected])} disabled={deleting || !selected.size} />
    </> : <Action label="Select" onPress={() => actions.start()} disabled={!loadedIds.length} />}
  </View>;
}

export function DeleteServerMediaConfirmation({ count, deleting, completed, onCancel, onConfirm }: {
  count: number; deleting: boolean; completed: number; onCancel: () => void; onConfirm: () => void;
}) {
  const colors = useTheme();
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!deleting) onCancel(); }}>
    <View style={tw`flex-1 justify-center items-center bg-black/60 px-6`}>
      <View accessibilityViewIsModal style={tw.style('w-full max-w-sm rounded-3xl p-6 gap-4', { backgroundColor: colors.background })}>
        <Text accessibilityRole="header" style={tw.style('text-xl font-semibold', { color: colors.text })}>Delete {count} {count === 1 ? 'item' : 'items'} from library?</Text>
        <Text style={tw.style('text-base', { color: colors.textSecondary })}>These items will be removed from your server library and albums. Copies on your device stay untouched. The backend currently keeps the original files in S3 or Telegram storage.</Text>
        {deleting && <Text accessibilityLiveRegion="polite" style={tw.style('text-sm', { color: colors.text })}>Deleting… {completed}/{count}</Text>}
        <Button label="Delete from library" loading={deleting} disabled={deleting} onPress={onConfirm} />
        <Button label="Cancel" variant="text" disabled={deleting} onPress={onCancel} />
      </View>
    </View>
  </Modal>;
}
