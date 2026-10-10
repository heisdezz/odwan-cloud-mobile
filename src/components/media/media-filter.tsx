import { useRef, useState } from "react";
import { SymbolView } from "expo-symbols";
import { Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useTheme } from "@/hooks/use-theme";
import { useGridStore } from "@/stores/grid-store";
import { selectionFeedback } from '@/lib/haptics';
import tw from "@/lib/tw";

export function MediaTypeFilter({
  onRefresh,
  refreshing = false,
}: {
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  const trigger = useRef<View>(null);
  const window = useWindowDimensions();
  const [anchor, setAnchor] = useState({ left: 16, top: 80 });
  const [open, setOpen] = useState(false);
  const colors = useTheme();
  const filter = useGridStore((state) => state.mediaFilter);
  const setFilter = useGridStore((state) => state.setMediaFilter);
  const label = filter === "all" ? "All media" : filter === "videos" ? "Videos" : "Photos";
  return (
    <View style={tw`flex-row items-center px-4 gap-2 pb-2`}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Media type: ${label}. Change filter`} ref={trigger} onPress={() => trigger.current?.measureInWindow((x, y, _width, height) => {
        setAnchor({ left: Math.max(8, Math.min(x, window.width - 232)), top: Math.max(8, Math.min(y + height + 6, window.height - 200)) });
        setOpen(true);
      })}
        style={tw.style('min-h-11 rounded-full px-4 flex-row items-center gap-2', { backgroundColor: colors.backgroundElement })}>
        <SymbolView name={{ ios: 'line.3.horizontal.decrease', android: 'filter_list', web: 'filter_list' }} size={18} tintColor={colors.text} />
        <Text style={tw.style('text-sm font-medium', { color: colors.text })}>{label}</Text>
        <SymbolView name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} size={16} tintColor={colors.textSecondary} />
      </Pressable>
      <View style={tw`flex-1`} />
      <Modal visible={open} transparent statusBarTranslucent navigationBarTranslucent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={tw`flex-1`}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close media filter" onPress={() => setOpen(false)} style={tw`absolute inset-0`} />
          <View accessibilityViewIsModal style={tw.style('absolute w-56 rounded-2xl p-2 border', { left: anchor.left, top: anchor.top, backgroundColor: colors.backgroundElement, borderColor: colors.outline })}>
            {([{ value: 'all', label: 'All media' }, { value: 'videos', label: 'Videos' }, { value: 'images', label: 'Photos' }] as const).map((option) =>
              <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: filter === option.value }} onPress={(event) => { event.stopPropagation(); selectionFeedback(); setFilter(option.value); setOpen(false); }}
                style={tw.style('min-h-12 px-3 flex-row items-center rounded-xl', { backgroundColor: filter === option.value ? colors.backgroundSelected : 'transparent' })}>
                <Text style={tw.style('flex-1 text-base', { color: colors.text })}>{option.label}</Text>
                {filter === option.value && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={20} tintColor={colors.text} />}
              </Pressable>)}
          </View>
        </View>
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
