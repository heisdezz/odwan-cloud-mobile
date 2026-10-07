import { forwardRef, useCallback, useMemo, useRef, useState, type ReactElement } from 'react';
import { ScrollView, useWindowDimensions, View, type ScrollViewProps } from 'react-native';
import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { clampColumns, gridPinchTarget, gridWindow } from '@/helpers/grid-zoom';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

type GridZoomProps<T> = {
  data: T[];
  renderItem: (props: { item: T; index: number; size: number; previewEnabled: boolean }) => ReactElement | null;
  keyExtractor: (item: T) => string;
  extraData?: unknown;
  contentInsets?: { top?: number; bottom?: number };
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  ListEmptyComponent?: ReactElement;
  ListFooterComponent?: ReactElement | null;
};

/** One recycler. Pinch preview stays on UI; layout changes once at release. */
export function GridZoom<T>({ data, renderItem, keyExtractor, extraData, contentInsets, ...props }: GridZoomProps<T>) {
  const window = useWindowDimensions();
  const colors = useTheme();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const [columns, setColumns] = useState(() => clampColumns(Math.floor(window.width / 150)));
  const size = viewport.width / columns;
  const top = contentInsets?.top ?? 0, bottom = contentInsets?.bottom ?? 0;
  const list = useRef<FlashListRef<T>>(null);
  const pending = useRef<{ columns: number; offset: number } | null>(null);
  const [visible, setVisible] = useState({ first: 0, last: -1 });
  const scale = useSharedValue(1), scroll = useSharedValue(0), startScroll = useSharedValue(0);
  const focalX = useSharedValue(0), focalY = useSharedValue(0), pinching = useSharedValue(false);
  const busy = useSharedValue(false);

  // Attach Native directly to the actual ScrollView. Keep it simultaneous with
  // the parent pinch so one-finger scrolling is never waiting for a pinch.
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const ScrollComponent = useMemo(() => {
    const Component = forwardRef<ScrollView, ScrollViewProps>((scrollProps, ref) => (
      <GestureDetector gesture={nativeScroll}><Animated.ScrollView {...scrollProps} ref={ref} /></GestureDetector>
    ));
    Component.displayName = 'GridScrollView';
    return Component;
  }, [nativeScroll]);
  const updateWindow = useCallback((offset: number) => {
    const next = gridWindow(data.length, columns, viewport.width, viewport.height, offset, top);
    setVisible((old) => old.first === next.first && old.last === next.last ? old : next);
  }, [data.length, columns, viewport.width, viewport.height, top]);
  const commitPinch = useCallback((amount: number, x: number, y: number, offset: number) => {
    const target = gridPinchTarget({ count: data.length, columns, scale: amount, width: viewport.width, height: viewport.height, offset, x, y, top, bottom });
    if (target.columns === columns) {
      scale.set(withTiming(1, { duration: 160 }));
      busy.set(false);
      return;
    }
    pending.current = target;
    setColumns(target.columns);
  }, [data.length, columns, viewport.width, viewport.height, top, bottom, scale, busy]);
  const pinch = Gesture.Pinch().enabled(data.length > 0)
    .simultaneousWithExternalGesture(nativeScroll)
    .onStart((event) => {
      if (busy.value) return;
      pinching.set(true);
      focalX.set(event.focalX);
      focalY.set(event.focalY);
      startScroll.set(scroll.value);
    })
    .onUpdate((event) => {
      if (!pinching.value || busy.value) return;
      scale.set(Math.max(columns / 6, Math.min(columns / 2, event.scale)));
    })
    // Native gesture registration stores this callback; it does not invoke it during render.
    // eslint-disable-next-line react-hooks/refs
    .onEnd(() => {
      if (!pinching.value || busy.value) return;
      busy.set(true);
      runOnJS(commitPinch)(scale.value, focalX.value, focalY.value, startScroll.value);
    })
    .onFinalize((_event, success) => {
      pinching.set(false);
      if (!success) { scale.set(withTiming(1, { duration: 160 })); busy.set(false); }
    });
  const previewStyle = useAnimatedStyle(() => ({ transform: [
    { translateX: (focalX.value - viewport.width / 2) * (1 - scale.value) },
    { translateY: (focalY.value - viewport.height / 2) * (1 - scale.value) },
    { scale: scale.value },
  ] }));
  const initial = gridWindow(data.length, columns, viewport.width, viewport.height, 0, top);
  const range = visible.last < 0 ? initial : visible;
  const listExtra = useMemo(() => ({ extraData, columns, range }), [extraData, columns, range]);
  return <View style={tw.style('flex-1 overflow-hidden', { backgroundColor: colors.background })}
    onLayout={({ nativeEvent: { layout } }) => {
      if (layout.width > 0 && layout.height > 0) setViewport((old) => old.width === layout.width && old.height === layout.height ? old : { width: layout.width, height: layout.height });
    }}>
    <GestureDetector gesture={pinch}>
      <Animated.View style={[tw`flex-1`, previewStyle]}>
        <FlashList ref={list} {...props} data={data} keyExtractor={keyExtractor} numColumns={columns}
          extraData={listExtra} renderScrollComponent={ScrollComponent}
          drawDistance={size * 2} maintainVisibleContentPosition={{ disabled: true }}
          contentContainerStyle={tw.style({ paddingTop: top, paddingBottom: bottom })}
          renderItem={({ item, index, target }) => renderItem({ item, index, size,
            previewEnabled: target === 'Cell' && index >= range.first && index <= range.last })}
          onScroll={({ nativeEvent }) => {
            scroll.set(nativeEvent.contentOffset.y);
            updateWindow(nativeEvent.contentOffset.y);
          }} scrollEventThrottle={32}
          onLoad={() => updateWindow(scroll.value)}
          onCommitLayoutEffect={() => {
            if (pending.current?.columns !== columns) return;
            const offset = pending.current.offset;
            pending.current = null;
            list.current?.scrollToOffset({ offset, animated: false });
            scroll.set(offset);
            updateWindow(offset);
            scale.set(1);
            busy.set(false);
          }}
        />
      </Animated.View>
    </GestureDetector>
  </View>;
}
