import { useState } from "react";
import { SymbolView } from "expo-symbols";
import { Modal, Pressable, Text, View } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { useGridStore } from "@/stores/grid-store";
import tw from "@/lib/tw";

export function MediaTypeFilter({
  onRefresh,
  refreshing = false,
}: {
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const colors = useTheme();
  const filter = useGridStore((state) => state.mediaFilter);
  const setFilter = useGridStore((state) => state.setMediaFilter);
  const label = filter === "all" ? "All media" : filter === "videos" ? "Videos" : "Photos";
  return (
    <View style={tw`flex-row items-center px-4 gap-2 pb-2`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Media type: ${label}. Change filter`} onPress={() => setOpen(true)}
        style={tw.style('min-h-11 rounded-full px-4 flex-row items-center gap-2', { backgroundColor: colors.backgroundElement })}>
        <SymbolView name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }} size={18} tintColor={colors.text} />
        <Text style={tw.style('text-sm font-medium', { color: colors.text })}>{label}</Text>
        <SymbolView name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} size={16} tintColor={colors.textSecondary} />
      </Pressable>
      <View style={tw`flex-1`} />
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close media filter" onPress={() => setOpen(false)} style={tw`flex-1 justify-center items-center bg-black/50 px-6`}>
          <View accessibilityViewIsModal style={tw.style('w-full max-w-sm rounded-2xl p-4', { backgroundColor: colors.background })}>
            <Text accessibilityRole="header" style={tw.style('text-lg font-semibold px-3 pb-2', { color: colors.text })}>Show media</Text>
            {([{ value: 'all', label: 'All media' }, { value: 'videos', label: 'Videos' }, { value: 'images', label: 'Photos' }] as const).map((option) =>
              <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: filter === option.value }} onPress={(event) => { event.stopPropagation(); setFilter(option.value); setOpen(false); }}
                style={tw.style('min-h-12 px-3 flex-row items-center rounded-xl', { backgroundColor: filter === option.value ? colors.backgroundSelected : 'transparent' })}>
                <Text style={tw.style('flex-1 text-base', { color: colors.text })}>{option.label}</Text>
                {filter === option.value && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={20} tintColor={colors.text} />}
              </Pressable>)}
          </View>
        </Pressable>
      </Modal>
      {onRefresh && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={refreshing ? "Updating media" : "Refresh media"}
          accessibilityState={{ disabled: refreshing }}
          disabled={refreshing}
          onPress={onRefresh}
          style={({ pressed }) =>
            tw.style("min-h-11 min-w-11 items-center justify-center", {
              opacity: refreshing || pressed ? 0.5 : 1,
            })
          }
        >
          <SymbolView
            name={{
              ios: "arrow.clockwise",
              android: "refresh",
              web: "refresh",
            }}
            size={20}
            tintColor={colors.text}
          />
        </Pressable>
      )}
    </View>
  );
}
