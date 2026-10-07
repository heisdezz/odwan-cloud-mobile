import { useMemo, useState, type ReactNode } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { clampColumns, columnsAfterPinch } from '@/helpers/grid-zoom';
import tw from '@/lib/tw';

export function GridZoom({ children }: { children: (columns: number) => ReactNode }) {
  const { width } = useWindowDimensions();
  const [columns, setColumns] = useState(() => clampColumns(Math.floor(width / 150)));
  const gesture = useMemo(() => Gesture.Simultaneous(
    Gesture.Native(),
    Gesture.Pinch().runOnJS(true).onEnd((event, success) => {
      if (success) setColumns((current) => columnsAfterPinch(current, event.scale));
    }),
  ), []);
  return <GestureDetector gesture={gesture}>
    <View collapsable={false} style={tw`flex-1`}>{children(columns)}</View>
  </GestureDetector>;
}
