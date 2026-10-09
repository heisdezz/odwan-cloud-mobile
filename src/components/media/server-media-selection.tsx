import { SymbolView } from "expo-symbols";
import { Modal, Pressable, Text, View } from "react-native";
import { useStore } from "zustand";
import { Button } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import type { MediaSelectionStore } from "@/lib/media-selection";
import tw from "@/lib/tw";

function IconAction({ label, icon, onPress, disabled = false }: {
  label: string; icon: React.ComponentProps<typeof SymbolView>['name']; onPress: () => void; disabled?: boolean;
}) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => tw.style('h-11 w-11 items-center justify-center rounded-full', { opacity: disabled ? 0.35 : pressed ? 0.6 : 1 })}>
    <SymbolView name={icon} size={23} tintColor={colors.text} />
  </Pressable>;
}

export function ServerMediaSelectionBar({ selection, loadedIds, deleting, onDelete, onRestore, onMove, trashAvailable = false, bottom }: {
  selection: MediaSelectionStore; loadedIds: readonly string[]; deleting: boolean; onDelete: (ids: string[]) => void;
  onRestore?: (ids: string[]) => void; onMove?: (ids: string[]) => void; trashAvailable?: boolean; bottom: number;
}) {
  const colors = useTheme();
  const selecting = useStore(selection, (state) => state.selecting);
  const selected = useStore(selection, (state) => state.selected);
  const actions = selection.getState();
  if (!selecting) return null;
  return <View pointerEvents="box-none" style={tw.style('absolute left-3 right-3 items-center z-30', { bottom })}>
    <View style={tw.style('max-w-md w-full flex-row items-center px-2 py-1 rounded-full', {
      backgroundColor: colors.backgroundElement, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8,
    })}>
      <IconAction label="Exit selection" icon={{ ios: 'xmark', android: 'close', web: 'close' }} onPress={actions.clear} disabled={deleting} />
      <Text accessibilityLiveRegion="polite" accessibilityLabel={`${selected.size} selected`} numberOfLines={1} style={tw.style('flex-1 text-base font-semibold px-1', { color: colors.text })}>{selected.size}</Text>
      <IconAction label="Select all loaded media" icon={{ ios: 'checkmark.circle', android: 'select_all', web: 'select_all' }} onPress={() => actions.replace(loadedIds)} disabled={deleting || !loadedIds.length} />
      {onMove && <IconAction label="Move to album" icon={{ ios: 'folder', android: 'drive_file_move', web: 'drive_file_move' }} onPress={() => onMove([...selected])} disabled={deleting || !selected.size} />}
      {onRestore && <IconAction label="Restore selected media" icon={{ ios: 'arrow.uturn.backward', android: 'restore', web: 'restore' }} onPress={() => onRestore([...selected])} disabled={deleting || !selected.size || !trashAvailable} />}
      <IconAction label={onRestore ? 'Delete permanently' : 'Move selected media to trash'} icon={{ ios: 'trash', android: 'delete', web: 'delete' }} onPress={() => onDelete([...selected])} disabled={deleting || !selected.size || !trashAvailable} />
    </View>
    {!trashAvailable && <Text style={tw.style('text-xs px-3 py-1 rounded-full mt-1', { color: colors.text, backgroundColor: colors.backgroundElement })}>Update the server to enable Trash.</Text>}
  </View>;
}

export function DeleteServerMediaConfirmation({
  count,
  deleting,
  completed,
  onCancel,
  onConfirm,
  permanent = false,
}: {
  count: number;
  deleting: boolean;
  completed: number;
  onCancel: () => void;
  onConfirm: () => void;
  permanent?: boolean;
}) {
  const colors = useTheme();
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!deleting) onCancel();
      }}
    >
      <View style={tw`flex-1 justify-center items-center bg-black/60 px-6`}>
        <View
          accessibilityViewIsModal
          style={tw.style("w-full max-w-sm rounded-3xl p-6 gap-4", {
            backgroundColor: colors.background,
          })}
        >
          <Text
            accessibilityRole="header"
            style={tw.style("text-xl font-semibold", { color: colors.text })}
          >
            {permanent ? "Permanently delete" : "Move to trash:"} {count}{" "}
            {count === 1 ? "item" : "items"}?
          </Text>
          <Text style={tw.style("text-base", { color: colors.textSecondary })}>
            {permanent
              ? "These items cannot be restored. Cloud file cleanup will run in the background. Device copies stay untouched."
              : "Recover these items from Trash for 30 days. Copies on your device stay untouched."}
          </Text>
          {deleting && (
            <Text
              accessibilityLiveRegion="polite"
              style={tw.style("text-sm", { color: colors.text })}
            >
              Deleting… {completed}/{count}
            </Text>
          )}
          <Button
            label={permanent ? "Delete permanently" : "Move to trash"}
            loading={deleting}
            disabled={deleting}
            onPress={onConfirm}
          />
          <Button
            label="Cancel"
            variant="text"
            disabled={deleting}
            onPress={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
}
