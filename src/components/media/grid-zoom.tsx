import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { clampColumns, columnsAfterPinch, MAX_GRID_COLUMNS, MIN_GRID_COLUMNS } from '@/helpers/grid-zoom';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export function GridZoom({ children }: { children: (columns: number) => ReactNode }) {
  const colors = useTheme();
  const { width } = useWindowDimensions();
  const [columns, setColumns] = useState(() => Math.max(2, clampColumns(Math.floor(width / 150))));
  const gesture = useMemo(() => Gesture.Simultaneous(
    Gesture.Native(),
    Gesture.Pinch().runOnJS(true).onEnd((event, success) => {
      if (success) setColumns((current) => columnsAfterPinch(current, event.scale));
    }),
  ), []);
  return <View style={tw`flex-1`}>
    <View style={tw`flex-row items-center justify-between px-4 pb-2 gap-2`}>
      <Text accessibilityLiveRegion="polite" style={tw.style('text-sm', { color: colors.textSecondary })}>{columns} {columns === 1 ? 'column' : 'columns'}</Text>
      <View style={tw`flex-row gap-2`}>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom in: fewer columns" accessibilityState={{ disabled: columns === MIN_GRID_COLUMNS }}
          disabled={columns === MIN_GRID_COLUMNS} onPress={() => setColumns((current) => clampColumns(current - 1))}
          style={({ pressed }) => tw.style('min-h-11 px-3 rounded-full justify-center', { backgroundColor: colors.backgroundElement, opacity: columns === MIN_GRID_COLUMNS ? 0.4 : pressed ? 0.7 : 1 })}>
          <Text style={tw.style('text-sm font-medium', { color: colors.text })}>Zoom in</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Zoom out: more columns" accessibilityState={{ disabled: columns === MAX_GRID_COLUMNS }}
          disabled={columns === MAX_GRID_COLUMNS} onPress={() => setColumns((current) => clampColumns(current + 1))}
          style={({ pressed }) => tw.style('min-h-11 px-3 rounded-full justify-center', { backgroundColor: colors.backgroundElement, opacity: columns === MAX_GRID_COLUMNS ? 0.4 : pressed ? 0.7 : 1 })}>
          <Text style={tw.style('text-sm font-medium', { color: colors.text })}>Zoom out</Text>
        </Pressable>
      </View>
    </View>
    <GestureDetector gesture={gesture}><View collapsable={false} style={tw`flex-1`}>{children(columns)}</View></GestureDetector>
  </View>;
}
