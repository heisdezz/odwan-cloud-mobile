import { galleryDay, galleryMonths } from '@/helpers/media-timeline';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, useWindowDimensions, View, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedRef, useAnimatedStyle, useScrollOffset, useSharedValue, withTiming } from 'react-native-reanimated';
import { useStore } from 'zustand';
import { clampColumns, gridPinchTarget, gridWindow } from '@/helpers/grid-zoom';
import { createGridVisibilityStore, updateGridVisibility, type GridRange, type GridVisibilityStore } from '@/lib/grid-visibility';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import { useGridStore } from '@/stores/grid-store';
import { galleryInteraction } from '@/lib/gallery-interaction';
import { useFocusedGridColumns } from '@/hooks/use-focused-grid-columns';
import { useFocusEffect } from 'expo-router';

type RenderGridItem<T> = (props: { item: T; index: number; size: number; previewEnabled: boolean }) => ReactElement | null;
type GridZoomProps<T> = {
  data: T[]; renderItem: RenderGridItem<T>; keyExtractor: (item: T) => string;
  extraData?: unknown; contentInsets?: { top?: number; bottom?: number };
  /** Return to the top for a new filter without destroying the recycler. */
  resetKey?: string | number;
  dateForItem?: (item: T) => string | number | undefined;
  getItemType?: (item: T, index: number) => string | number;
  onEndReached?: () => void; onEndReachedThreshold?: number;
  ListEmptyComponent?: ReactElement; ListFooterComponent?: ReactElement | null;
};

function GridPreviewCell<T>({ item, index, size, target, renderItem, visibility }: {
  item: T; index: number; size: number; target: ListRenderItemInfo<T>['target'];
  renderItem: RenderGridItem<T>; visibility: GridVisibilityStore;
}) {
  const previewEnabled = useStore(visibility, (range) => target === 'Cell' && index >= range.first && index <= range.last);
  return renderItem({ item, index, size, previewEnabled });
}
const PreviewCell = memo(GridPreviewCell) as typeof GridPreviewCell;

/** UI-thread scroll tracking; only cells entering/leaving the thumbnail window update. */
export function GridZoom<T>({ data, renderItem, keyExtractor, extraData, contentInsets, resetKey, dateForItem, ...props }: GridZoomProps<T>) {
  const window = useWindowDimensions();
  const { background, text: textColor, textSecondary } = useTheme();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const [interaction] = useState(() => ({ scroll: {}, pinch: {} }));
  const setPinchInteraction = useCallback((busy: boolean) => galleryInteraction.setBusy(interaction.pinch, busy), [interaction]);
  const startScrollInteraction = useCallback(() => galleryInteraction.setBusy(interaction.scroll, true), [interaction]);
  const endScrollInteraction = useCallback(() => galleryInteraction.setBusy(interaction.scroll, false), [interaction]);
  useEffect(() => () => {
    galleryInteraction.release(interaction.scroll); galleryInteraction.release(interaction.pinch);
  }, [interaction]);
  const savedColumns = useFocusedGridColumns();
  const setColumns = useGridStore((state) => state.setColumns);
  const columns = savedColumns ?? clampColumns(Math.floor(window.width / 150));
  const size = viewport.width / columns;
  const top = contentInsets?.top ?? 0, bottom = contentInsets?.bottom ?? 0;
  const count = data.length;
  const [dateLabel, setDateLabel] = useState(() => data[0] && dateForItem ? galleryDay(dateForItem(data[0])) : "");
  const publishedDate = useRef(dateLabel);
  const [datePicker, setDatePicker] = useState(false);
  const months = useMemo(() => dateForItem ? galleryMonths(data, dateForItem) : [], [data, dateForItem]);
  const scrubHeight = useRef(1);
  const scrubTrackHeight = useSharedValue(1);
  const list = useRef<FlashListRef<T>>(null);
  const pending = useRef<{ columns: number; offset: number } | null>(null);
  const appliedResetKey = useRef(resetKey);
  const [visibility] = useState(() => createGridVisibilityStore(gridWindow(count, columns, viewport.width, viewport.height, 0, top)));
  const nativeRef = useAnimatedRef<ScrollView>();
  // This attaches a separate native listener, preserving FlashList's JS onScroll.
  const scroll = useScrollOffset(nativeRef);
  const scale = useSharedValue(1), startScroll = useSharedValue(0);
  const focalX = useSharedValue(0), focalY = useSharedValue(0), pinching = useSharedValue(false), busy = useSharedValue(false);
  const viewportWidth = useSharedValue(viewport.width), viewportHeight = useSharedValue(viewport.height);
  useFocusEffect(useCallback(() => () => {
    pending.current = null;
    pinching.set(false); busy.set(false); scale.set(1);
    galleryInteraction.release(interaction.scroll); galleryInteraction.release(interaction.pinch);
  }, [pinching, busy, scale, interaction]));
  useEffect(() => { viewportWidth.set(viewport.width); viewportHeight.set(viewport.height); }, [viewport.width, viewport.height, viewportWidth, viewportHeight]);
  const nativeScroll = useMemo(() => Gesture.Native(), []);
  const ScrollComponent = useMemo(() => {
    const Component = forwardRef<ScrollView, ScrollViewProps>((scrollProps, ref) => {
      const attachRef = useCallback((node: ScrollView | null) => {
        nativeRef(node);
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }, [ref]);
      return <GestureDetector gesture={nativeScroll}>
        <Animated.ScrollView {...scrollProps} ref={attachRef} scrollEventThrottle={16} />
      </GestureDetector>;
    });
    Component.displayName = 'GridScrollView';
    return Component;
  }, [nativeScroll, nativeRef]);
  const publishWindow = useCallback((next: GridRange) => {
    updateGridVisibility(visibility, next);
    if (dateForItem && count) {
      const index = Math.min(count - 1, Math.max(0, Math.floor((scroll.value - top) / size) * columns));
      const label = galleryDay(dateForItem(data[index]));
      if (publishedDate.current !== label) { publishedDate.current = label; setDateLabel(label); }
    }
  }, [visibility, dateForItem, count, scroll, top, size, columns, data]);
  useAnimatedReaction(
    // Freeze preview subscriptions until the new density and focal offset agree.
    () => pinching.value || busy.value ? null : gridWindow(count, columns, viewportWidth.value, viewportHeight.value, scroll.value, top),
    (next, previous) => {
      if (next && (!previous || next.first !== previous.first || next.last !== previous.last)) runOnJS(publishWindow)(next);
    }, [count, columns, top, publishWindow],
  );
  const updateWindow = useCallback((offset: number) => {
    publishWindow(gridWindow(count, columns, viewport.width, viewport.height, offset, top));
  }, [count, columns, viewport.width, viewport.height, top, publishWindow]);
  const commitPinch = useCallback((amount: number, x: number, y: number, offset: number) => {
    const target = gridPinchTarget({ count, columns, scale: amount, width: viewport.width, height: viewport.height, offset, x, y, top, bottom });
    if (target.columns === columns) { scale.set(withTiming(1, { duration: 160 })); busy.set(false); setPinchInteraction(false); return; }
    pending.current = target;
    setColumns(target.columns);
  }, [count, columns, viewport.width, viewport.height, top, bottom, scale, busy, setColumns, setPinchInteraction]);
  const pinch = useMemo(() => Gesture.Pinch().enabled(count > 0)
    .simultaneousWithExternalGesture(nativeScroll)
    .onStart((event) => {
      if (busy.value) return;
      runOnJS(setPinchInteraction)(true);
      pinching.set(true); focalX.set(event.focalX); focalY.set(event.focalY); startScroll.set(scroll.value);
    })
    .onUpdate((event) => {
      if (!pinching.value || busy.value) return;
      scale.set(Math.max(columns / 6, Math.min(columns / 2, event.scale)));
    })
    // Registration stores this event callback; refs are read only when the gesture ends.
    // eslint-disable-next-line react-hooks/refs
    .onEnd(() => {
      if (!pinching.value || busy.value) return;
      busy.set(true); runOnJS(commitPinch)(scale.value, focalX.value, focalY.value, startScroll.value);
    })
    .onFinalize((_event, success) => {
      pinching.set(false);
      if (!success) {
        runOnJS(setPinchInteraction)(false);
        scale.set(withTiming(1, { duration: 160 })); busy.set(false);
      }
    }), [count, columns, nativeScroll, commitPinch, setPinchInteraction, scale, focalX, focalY, startScroll, scroll, busy, pinching]);
  const previewStyle = useAnimatedStyle(() => ({ transform: [
    { translateX: (focalX.value - viewportWidth.value / 2) * (1 - scale.value) },
    { translateY: (focalY.value - viewportHeight.value / 2) * (1 - scale.value) }, { scale: scale.value },
  ] }));
  const rootStyle = useMemo(() => tw.style('flex-1 overflow-hidden', { backgroundColor: background }), [background]);
  const contentStyle = useMemo(() => tw.style({ paddingTop: top, paddingBottom: bottom }), [top, bottom]);
  const listExtra = useMemo(() => ({ extraData, columns }), [extraData, columns]);
  const renderCell = useCallback(({ item, index, target }: ListRenderItemInfo<T>) => <PreviewCell
    item={item} index={index} target={target} size={size} renderItem={renderItem} visibility={visibility} />,
  [size, renderItem, visibility]);
  const onLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    if (layout.width > 0 && layout.height > 0) setViewport((old) => old.width === layout.width && old.height === layout.height ? old : { width: layout.width, height: layout.height });
  }, []);
  const onLoad = useCallback(() => updateWindow(scroll.value), [updateWindow, scroll]);
  const onCommitLayoutEffect = useCallback(() => {
    if (appliedResetKey.current !== resetKey) {
      appliedResetKey.current = resetKey;
      pending.current = null;
      list.current?.scrollToOffset({ offset: 0, animated: false });
      scroll.set(0); updateWindow(0); scale.set(1); pinching.set(false); busy.set(false);
      setPinchInteraction(false);
      return;
    }
    if (pending.current?.columns !== columns) return;
    const offset = pending.current.offset;
    pending.current = null;
    list.current?.scrollToOffset({ offset, animated: false });
    scroll.set(offset); updateWindow(offset); scale.set(1); busy.set(false);
    setPinchInteraction(false);
  }, [resetKey, columns, scroll, updateWindow, scale, pinching, busy, setPinchInteraction]);
  const jumpTo = useCallback((index: number) => {
    const maxOffset = Math.max(0, Math.ceil(count / columns) * size + top + bottom - viewport.height);
    const offset = Math.min(maxOffset, Math.max(0, Math.floor(index / columns) * size + top));
    list.current?.scrollToOffset({ offset, animated: false });
    scroll.set(offset); updateWindow(offset);
  }, [columns, size, count, top, bottom, viewport.height, scroll, updateWindow]);
  const scrubStyle = useAnimatedStyle(() => {
    const maxOffset = Math.max(1, Math.ceil(count / columns) * size + top + bottom - viewportHeight.value);
    return { transform: [{ translateY: Math.max(0, Math.min(1, scroll.value / maxOffset)) * Math.max(0, scrubTrackHeight.value - 48) }] };
  });
  return <View style={rootStyle} onLayout={onLayout}>
    <GestureDetector gesture={pinch}><Animated.View style={[tw`flex-1`, previewStyle]}>
      <FlashList ref={list} {...props} data={data} keyExtractor={keyExtractor} numColumns={columns}
        extraData={listExtra} renderScrollComponent={ScrollComponent} renderItem={renderCell}
        drawDistance={size * 2} maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={contentStyle} scrollEventThrottle={16}
        onScrollBeginDrag={startScrollInteraction} onScrollEndDrag={endScrollInteraction}
        onMomentumScrollBegin={startScrollInteraction} onMomentumScrollEnd={endScrollInteraction}
        onLoad={onLoad} onCommitLayoutEffect={onCommitLayoutEffect} />
    </Animated.View></GestureDetector>
    {!!months.length && <>
      <Pressable accessibilityRole="button" accessibilityLabel={`Jump to date. ${dateLabel}`} onPress={() => setDatePicker(true)}
        style={tw.style('absolute top-2 left-3 min-h-11 px-3 rounded-full justify-center', { backgroundColor: background })}>
        <Text style={tw.style('text-xs font-semibold', { color: textColor })}>{dateLabel || months[0].label}</Text>
      </Pressable>
      <View accessibilityRole="adjustable" accessibilityLabel="Gallery timeline" accessibilityHint="Drag to move quickly through dates"
        style={tw`absolute top-16 right-0 bottom-28 w-8 items-center`}
        onLayout={(event) => { scrubHeight.current = Math.max(1, event.nativeEvent.layout.height); scrubTrackHeight.set(scrubHeight.current); }}
        onStartShouldSetResponder={() => true} onResponderGrant={(event) => { startScrollInteraction(); jumpTo(Math.floor(Math.max(0, Math.min(1, event.nativeEvent.locationY / scrubHeight.current)) * (count - 1))); }}
        onResponderMove={(event) => jumpTo(Math.floor(Math.max(0, Math.min(1, event.nativeEvent.locationY / scrubHeight.current)) * (count - 1)))}
        onResponderRelease={endScrollInteraction} onResponderTerminate={endScrollInteraction}>
        <Animated.View style={[tw.style('w-1 h-12 rounded-full', { backgroundColor: textSecondary }), scrubStyle]} />
      </View>
      <Modal visible={datePicker} transparent animationType="fade" onRequestClose={() => setDatePicker(false)}>
        <View style={tw`flex-1 bg-black/60 justify-center px-6`}><View style={tw.style('rounded-2xl p-5 h-2/3', { backgroundColor: background })}>
          <Text accessibilityRole="header" style={tw.style('text-xl font-semibold pb-3', { color: textColor })}>Jump to month</Text>
          <FlatList data={months} keyExtractor={(item) => item.key} renderItem={({ item }) => <Pressable accessibilityRole="button"
            onPress={() => { jumpTo(item.index); setDatePicker(false); }} style={tw`min-h-12 justify-center`}><Text style={tw.style('text-base', { color: textColor })}>{item.label}</Text></Pressable>} />
          <Pressable accessibilityRole="button" onPress={() => setDatePicker(false)} style={tw`min-h-11 justify-center`}><Text style={tw.style('text-base', { color: textColor })}>Close</Text></Pressable>
        </View></View>
      </Modal>
    </>}
  </View>;
}
