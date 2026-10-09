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

export function ServerMediaSelectionBar({ selection, loadedIds, deleting, onDelete, onRestore, trashAvailable = false }: {
  selection: MediaSelectionStore; loadedIds: readonly string[]; deleting: boolean; onDelete: (ids: string[]) => void; onRestore?: (ids: string[]) => void; trashAvailable?: boolean;
}) {
  const colors = useTheme();
  const selecting = useStore(selection, (state) => state.selecting);
  const selected = useStore(selection, (state) => state.selected);
  const actions = selection.getState();
  if (!selecting) return null;
  return <View style={tw`shrink-0 px-4 pb-2 gap-2`}>
    <View style={tw`flex-row items-center gap-2`}>
      <Action label="Done" onPress={actions.clear} disabled={deleting} />
      <Text accessibilityLiveRegion="polite" numberOfLines={1} style={tw.style('flex-1 text-sm', { color: colors.text })}>{selected.size} selected</Text>
      <Action label="All loaded" onPress={() => actions.replace(loadedIds)} disabled={deleting || !loadedIds.length} />
    </View>
    <View style={tw`flex-row justify-end gap-2`}>
      {onRestore && <Action label="Restore" onPress={() => onRestore([...selected])} disabled={deleting || !selected.size || !trashAvailable} />}
      <Action label={onRestore ? "Delete" : "Trash"} onPress={() => onDelete([...selected])} disabled={deleting || !selected.size || !trashAvailable} />
    </View>
    {!trashAvailable && <Text style={tw.style('text-xs', { color: colors.textSecondary })}>Update your server to enable recoverable trash.</Text>}
  </View>;
}

export function DeleteServerMediaConfirmation({ count, deleting, completed, onCancel, onConfirm, permanent = false }: {
  count: number; deleting: boolean; completed: number; onCancel: () => void; onConfirm: () => void; permanent?: boolean;
}) {
  const colors = useTheme();
  return <Modal visible transparent animationType="fade" onRequestClose={() => { if (!deleting) onCancel(); }}>
    <View style={tw`flex-1 justify-center items-center bg-black/60 px-6`}>
      <View accessibilityViewIsModal style={tw.style('w-full max-w-sm rounded-3xl p-6 gap-4', { backgroundColor: colors.background })}>
        <Text accessibilityRole="header" style={tw.style('text-xl font-semibold', { color: colors.text })}>{permanent ? "Permanently delete" : "Move to trash:"} {count} {count === 1 ? 'item' : 'items'}?</Text>
        <Text style={tw.style('text-base', { color: colors.textSecondary })}>{permanent ? "These items cannot be restored. Cloud file cleanup will run in the background. Device copies stay untouched." : "Recover these items from Trash for 30 days. Copies on your device stay untouched."}</Text>
        {deleting && <Text accessibilityLiveRegion="polite" style={tw.style('text-sm', { color: colors.text })}>Deleting… {completed}/{count}</Text>}
        <Button label={permanent ? "Delete permanently" : "Move to trash"} loading={deleting} disabled={deleting} onPress={onConfirm} />
        <Button label="Cancel" variant="text" disabled={deleting} onPress={onCancel} />
      </View>
    </View>
  </Modal>;
}
