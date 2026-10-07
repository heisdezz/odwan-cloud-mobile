import { Pressable, Text, View } from "react-native";
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
  const colors = useTheme();
  const filter = useGridStore((state) => state.mediaFilter);
  const setFilter = useGridStore((state) => state.setMediaFilter);
  return (
    <View style={tw`flex-row items-center px-4 gap-2 pb-3`}>
      <View
        accessibilityRole="tablist"
        accessibilityLabel="Media type"
        style={tw`flex-1 flex-row flex-wrap gap-2`}
      >
        {(
          [
            { value: "all", label: "All" },
            { value: "videos", label: "Videos" },
            { value: "images", label: "Images" },
          ] as const
        ).map(({ value, label }) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={({ pressed }) =>
              tw.style(
                "min-h-11 min-w-11 rounded-full px-4 justify-center items-center",
                {
                  backgroundColor:
                    filter === value
                      ? colors.backgroundSelected
                      : colors.backgroundElement,
                  opacity: pressed ? 0.7 : 1,
                },
              )
            }
          >
            <Text
              style={tw.style("text-sm font-medium", {
                color: filter === value ? colors.text : colors.textSecondary,
              })}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      {onRefresh && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh media"
          accessibilityState={{ disabled: refreshing }}
          disabled={refreshing}
          onPress={onRefresh}
          style={({ pressed }) =>
            tw.style("min-h-11 px-2 justify-center", {
              opacity: refreshing || pressed ? 0.5 : 1,
            })
          }
        >
          <Text style={tw.style("text-sm font-medium", { color: colors.text })}>
            {refreshing ? "Updating…" : "Refresh"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
