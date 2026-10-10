import { gridRangeSelection, gridSelectionIndex } from '@/helpers/grid-selection';
import type { MediaSelectionStore } from '@/lib/media-selection';
import { selectionFeedback } from '@/lib/haptics';
import { galleryDay, galleryMonths, galleryDateIndices } from '@/helpers/media-timeline';
import { forwardRef, memo, useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, useWindowDimensions, View, type LayoutChangeEvent, type ScrollViewProps } from 'react-native';
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedReaction, useAnimatedRef, useAnimatedStyle, useScrollOffset, useSharedValue, withTiming, withDelay, scrollTo, useFrameCallback } from 'react-native-reanimated';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import { clampColumns, gridPinchAnchor, gridPinchTarget, gridWindow } from '@/helpers/grid-zoom';
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
  selection?: MediaSelectionStore;
  selectionScope?: 'all' | 'loaded';
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

type PinchPreview<T> = { item: T; index: number; size: number } | null;
const PinchTile = memo(function PinchTile<T>({ store, renderItem }: {
  store: StoreApi<{ preview: PinchPreview<T> }>; renderItem: RenderGridItem<T>;
}) {
  const preview = useStore(store, (state) => state.preview);
  // Reuse the mounted tile's cached thumbnail; the paused queues prevent new decoding.
  return preview ? renderItem({ ...preview, previewEnabled: true }) : null;
}) as <T>(props: { store: StoreApi<{ preview: PinchPreview<T> }>; renderItem: RenderGridItem<T> }) => ReactElement | null;

/** UI-thread scroll tracking; only cells entering/leaving the thumbnail window update. */
export function GridZoom<T>({ data, renderItem, keyExtractor, extraData, contentInsets, resetKey, dateForItem, selection, selectionScope = 'all', ...props }: GridZoomProps<T>) {
  const [previewStore] = useState(() => createStore<{ preview: PinchPreview<T> }>(() => ({ preview: null })));
  const window = useWindowDimensions();
  const { background, text: textColor, textSecondary } = useTheme();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const [interaction] = useState(() => ({ scroll: {}, pinch: {}, drag: {} }));
  const setPinchInteraction = useCallback((busy: boolean) => galleryInteraction.setBusy(interaction.pinch, busy), [interaction]);
  const startScrollInteraction = useCallback(() => galleryInteraction.setBusy(interaction.scroll, true), [interaction]);
  const endScrollInteraction = useCallback(() => galleryInteraction.setBusy(interaction.scroll, false), [interaction]);
  useEffect(() => () => {
    galleryInteraction.release(interaction.scroll); galleryInteraction.release(interaction.pinch); galleryInteraction.release(interaction.drag);
  }, [interaction]);
  const savedColumns = useFocusedGridColumns();
  const setColumns = useGridStore((state) => state.setColumns);
  const columns = savedColumns ?? clampColumns(Math.floor(window.width / 150));
  const size = viewport.width / columns;
  const top = contentInsets?.top ?? 0, bottom = contentInsets?.bottom ?? 0;
  const count = data.length;
  const [dateLabel, setDateLabel] = useState(() => data[0] && dateForItem ? galleryDay(dateForItem(data[0])) : "");
  const publishedDate = useRef(dateLabel);
  const currentDateIndex = useRef(0);
  const [datePicker, setDatePicker] = useState(false);
  const months = useMemo(() => dateForItem ? galleryMonths(data, dateForItem) : [], [data, dateForItem]);
  const scrubHeight = useRef(1);
  const scrubTrackHeight = useSharedValue(1);
  const list = useRef<FlashListRef<T>>(null);
  const pending = useRef<{ columns: number; offset: number; index: number } | null>(null);
  const appliedResetKey = useRef(resetKey);
  const [visibility] = useState(() => createGridVisibilityStore(gridWindow(count, columns, viewport.width, viewport.height, 0, top)));
  const nativeRef = useAnimatedRef<ScrollView>();
  // This attaches a separate native listener, preserving FlashList's JS onScroll.
  const scroll = useScrollOffset(nativeRef);
  const timelineOpacity = useSharedValue(0.7);
  const showTimeline = useCallback(() => { timelineOpacity.set(withTiming(1, { duration: 100 })); }, [timelineOpacity]);
  const hideTimeline = useCallback(() => { timelineOpacity.set(withDelay(900, withTiming(0.7, { duration: 250 }))); }, [timelineOpacity]);
  const beginScroll = useCallback(() => { startScrollInteraction(); showTimeline(); }, [startScrollInteraction, showTimeline]);
  const finishScroll = useCallback(() => { endScrollInteraction(); hideTimeline(); }, [endScrollInteraction, hideTimeline]);
  const dragActive = useSharedValue(false), dragX = useSharedValue(0), dragY = useSharedValue(0), dragOffset = useSharedValue(0);
  const dragIndex = useSharedValue(-1);
  const dragSession = useRef<{ base: Set<string>; anchor: number; adding: boolean } | null>(null);
  const endSelectionDrag = useCallback(() => {
    dragSession.current = null;
    galleryInteraction.release(interaction.drag);
  }, [interaction]);
  const beginSelectionDrag = useCallback((index: number) => {
    if (!selection || !data[index] || !dragActive.value) return;
    const base = new Set(selection.getState().selected);
    dragSession.current = { base, anchor: index, adding: !base.has(keyExtractor(data[index])) };
    selection.getState().start();
    selection.setState({ selected: gridRangeSelection(data, keyExtractor, base, index, index, dragSession.current.adding) });
    galleryInteraction.setBusy(interaction.drag, true);
  }, [selection, data, keyExtractor, interaction, dragActive]);
  const extendSelectionDrag = useCallback((index: number) => {
    const session = dragSession.current;
    if (!selection || !session || index < 0) return;
    selection.setState({ selected: gridRangeSelection(data, keyExtractor, session.base, session.anchor, index, session.adding) });
  }, [selection, data, keyExtractor]);
  const scale = useSharedValue(1), startScroll = useSharedValue(0);
  const previewOpacity = useSharedValue(0), previewSize = useSharedValue(0), gestureId = useSharedValue(0);
  const focalX = useSharedValue(0), focalY = useSharedValue(0), pinching = useSharedValue(false), busy = useSharedValue(false);
  const viewportWidth = useSharedValue(viewport.width), viewportHeight = useSharedValue(viewport.height);
  const showPreview = useCallback((index: number, tileSize: number, serial: number) => {
    if (serial !== gestureId.value || (!pinching.value && !busy.value) || !data[index]) return;
    setPinchInteraction(true);
    previewStore.setState({ preview: { item: data[index], index, size: tileSize } });
  }, [data, previewStore, gestureId, pinching, busy, setPinchInteraction]);
  const finishPreview = useCallback((serial: number) => {
    if (serial !== gestureId.value) return;
    previewStore.setState({ preview: null });
    previewOpacity.set(0); scale.set(1); busy.set(false);
    setPinchInteraction(false);
  }, [gestureId, previewStore, previewOpacity, scale, busy, setPinchInteraction]);
  const dismissPreview = useCallback(() => {
    const serial = gestureId.value;
    previewOpacity.set(withTiming(0, { duration: 120 }, (finished) => {
      if (finished) runOnJS(finishPreview)(serial);
    }));
  }, [gestureId, previewOpacity, finishPreview]);
  const previousData = useRef(data);
  useEffect(() => {
    if (previousData.current === data) return;
    previousData.current = data;
    dragActive.set(false); endSelectionDrag();
    if (pinching.value || busy.value) {
      pending.current = null; pinching.set(false); finishPreview(gestureId.value); gestureId.set(gestureId.value + 1);
    }
  }, [data, pinching, busy, finishPreview, gestureId, dragActive, endSelectionDrag]);
  useFocusEffect(useCallback(() => () => {
    pending.current = null;
    dragActive.set(false); endSelectionDrag();
    gestureId.set(gestureId.value + 1); previewOpacity.set(0); previewStore.setState({ preview: null });
    pinching.set(false); busy.set(false); scale.set(1);
    galleryInteraction.release(interaction.scroll); galleryInteraction.release(interaction.pinch); galleryInteraction.release(interaction.drag);
  }, [pinching, busy, scale, interaction, gestureId, previewOpacity, previewStore, dragActive, endSelectionDrag]));
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
  const publishWindow = useCallback((next: GridRange, index: number) => {
    updateGridVisibility(visibility, next);
    currentDateIndex.current = index;
    if (dateForItem && count) {
      const label = galleryDay(dateForItem(data[index]));
      if (publishedDate.current !== label) { publishedDate.current = label; setDateLabel(label); }
    }
  }, [visibility, dateForItem, count, data]);
  useAnimatedReaction(
    // Freeze preview subscriptions until the new density and focal offset agree.
    () => pinching.value || busy.value ? null : gridWindow(count, columns, viewportWidth.value, viewportHeight.value, scroll.value, top),
    (next, previous) => {
      if (next && (!previous || next.first !== previous.first || next.last !== previous.last)) runOnJS(publishWindow)(next, Math.min(count - 1, Math.max(0, Math.floor((scroll.value - top) / (viewportWidth.value / columns)) * columns)));
    }, [count, columns, top, publishWindow],
  );
  const updateWindow = useCallback((offset: number) => {
    publishWindow(gridWindow(count, columns, viewport.width, viewport.height, offset, top), Math.min(count - 1, Math.max(0, Math.floor((offset - top) / size) * columns)));
  }, [count, columns, viewport.width, viewport.height, top, size, publishWindow]);
  useAnimatedReaction(() => pinching.value ? scroll.value : null, (offset) => {
    if (offset !== null && Math.abs(offset - startScroll.value) > 0.5) scrollTo(nativeRef, 0, startScroll.value, false);
  });
  const commitPinch = useCallback((amount: number, x: number, y: number, offset: number, serial: number) => {
    if (serial !== gestureId.value || !busy.value) return;
    const target = gridPinchTarget({ count, columns, scale: amount, width: viewport.width, height: viewport.height, offset, x, y, top, bottom });
    if (target.columns === columns) { scale.set(withTiming(1, { duration: 120 })); dismissPreview(); return; }
    pending.current = target;
    selectionFeedback();
    setColumns(target.columns);
  }, [count, columns, viewport.width, viewport.height, top, bottom, scale, busy, setColumns, dismissPreview, gestureId]);
  const pinch = useMemo(() => Gesture.Pinch().enabled(count > 0)
    .simultaneousWithExternalGesture(nativeScroll)
    .onStart((event) => {
      if (busy.value) return;
      const anchor = gridPinchAnchor(count, columns, viewportWidth.value, scroll.value, event.focalX, event.focalY, top);
      if (anchor.index < 0) return;
      gestureId.set(gestureId.value + 1);
      pinching.set(true); scale.set(1); previewOpacity.set(1); previewSize.set(anchor.size);
      focalX.set(anchor.x); focalY.set(anchor.y); startScroll.set(scroll.value);
      scrollTo(nativeRef, 0, scroll.value, false);
      runOnJS(showPreview)(anchor.index, anchor.size, gestureId.value);
    })
    .onUpdate((event) => {
      if (!pinching.value || busy.value) return;
      scale.set(Math.max(columns / 6, Math.min(columns / 2, event.scale)));
    })
    // Registration stores this event callback; refs are read only when the gesture ends.
    // eslint-disable-next-line react-hooks/refs
    .onEnd((_event, success) => {
      if (!success || !pinching.value || busy.value) return;
      pinching.set(false); busy.set(true); runOnJS(commitPinch)(scale.value, focalX.value, focalY.value, startScroll.value, gestureId.value);
    })
    .onFinalize((_event, success) => {
      pinching.set(false);
      if (!success) {
        if (!busy.value) { previewOpacity.set(0); scale.set(1); runOnJS(finishPreview)(gestureId.value); }
      }
    }), [count, columns, nativeScroll, commitPinch, scale, focalX, focalY, startScroll, scroll, busy, pinching, top, viewportWidth, gestureId, previewOpacity, previewSize, nativeRef, showPreview, finishPreview]);
  const drag = useMemo(() => Gesture.Pan().enabled(!!selection && count > 0)
    .maxPointers(1).activateAfterLongPress(450).simultaneousWithExternalGesture(nativeScroll)
    // Gesture registration stores these callbacks; refs are read only during touch events.
    // eslint-disable-next-line react-hooks/refs
    .onStart((event) => {
      if (pinching.value || busy.value) return;
      const index = gridSelectionIndex(count, columns, viewportWidth.value, scroll.value, event.x, event.y, top);
      if (index < 0) return;
      dragActive.set(true); dragX.set(event.x); dragY.set(event.y); dragOffset.set(scroll.value); dragIndex.set(index);
      scrollTo(nativeRef, 0, scroll.value, false);
      runOnJS(beginSelectionDrag)(index);
    })
    .onUpdate((event) => { if (dragActive.value) { dragX.set(event.x); dragY.set(event.y); } })
    // eslint-disable-next-line react-hooks/refs -- Runs after the drag finishes, never during render.
    .onFinalize(() => { if (dragActive.value) { dragActive.set(false); runOnJS(endSelectionDrag)(); } }),
  [selection, count, columns, nativeScroll, pinching, busy, viewportWidth, scroll, top, dragActive, dragX, dragY, dragOffset, dragIndex, nativeRef, beginSelectionDrag, endSelectionDrag]);
  const gestures = useMemo(() => Gesture.Simultaneous(pinch, drag), [pinch, drag]);
  // Only hit-test/notify when the finger enters another cell. Edge scrolling stays on UI.
  const dragFrame = useFrameCallback(useCallback((frame: { timeSincePreviousFrame: number | null }) => {
    'worklet';
    if (!dragActive.value) return;
    const edge = Math.min(64, viewportHeight.value / 4);
    const velocity = dragY.value < edge ? -Math.min(1, (edge - dragY.value) / edge)
      : dragY.value > viewportHeight.value - edge ? Math.min(1, (dragY.value - viewportHeight.value + edge) / edge) : 0;
    const cellSize = viewportWidth.value / columns;
    const maxOffset = Math.max(0, Math.ceil(count / columns) * cellSize + top + bottom - viewportHeight.value);
    dragOffset.set(Math.max(0, Math.min(maxOffset, dragOffset.value + velocity * 600 * Math.min(32, frame.timeSincePreviousFrame ?? 16) / 1000)));
    if (Math.abs(scroll.value - dragOffset.value) > 0.5) scrollTo(nativeRef, 0, dragOffset.value, false);
    const index = gridSelectionIndex(count, columns, viewportWidth.value, dragOffset.value, dragX.value, Math.max(0, Math.min(viewportHeight.value - 1, dragY.value)), top);
    if (index >= 0 && index !== dragIndex.value) { dragIndex.set(index); runOnJS(extendSelectionDrag)(index); }
  }, [dragActive, dragY, viewportHeight, viewportWidth, columns, count, top, bottom, dragOffset, nativeRef, dragX, dragIndex, extendSelectionDrag, scroll]), false);
  useEffect(() => selection?.subscribe((state) => {
    if (!state.selecting) { dragActive.set(false); endSelectionDrag(); }
  }), [selection, dragActive, endSelectionDrag]);
  const activateDragFrame = useCallback((active: boolean) => dragFrame.setActive(active), [dragFrame]);
  useAnimatedReaction(() => dragActive.value, (active) => runOnJS(activateDragFrame)(active));
  useEffect(() => () => dragFrame.setActive(false), [dragFrame]);
  const timelineStyle = useAnimatedStyle(() => ({ opacity: timelineOpacity.value }));
  const overlayStyle = useAnimatedStyle(() => ({ opacity: previewOpacity.value }));
  const previewStyle = useAnimatedStyle(() => ({
    width: previewSize.value, height: previewSize.value,
    left: focalX.value - previewSize.value / 2, top: focalY.value - previewSize.value / 2,
    transform: [{ scale: scale.value }],
  }));
  const rootStyle = useMemo(() => tw.style('flex-1 overflow-hidden', { backgroundColor: background }), [background]);
  const contentStyle = useMemo(() => tw.style({ paddingTop: top, paddingBottom: bottom }), [top, bottom]);
  const listExtra = useMemo(() => ({ extraData, columns }), [extraData, columns]);
  const renderCell = useCallback(({ item, index, target }: ListRenderItemInfo<T>) => <PreviewCell
    item={item} index={index} target={target} size={size} renderItem={renderItem} visibility={visibility} />,
  [size, renderItem, visibility]);
  const onLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent) => {
    if (layout.width > 0 && layout.height > 0 && (layout.width !== viewportWidth.value || layout.height !== viewportHeight.value)) {
      pending.current = null; pinching.set(false); finishPreview(gestureId.value); gestureId.set(gestureId.value + 1);
    }
    if (layout.width > 0 && layout.height > 0) setViewport((old) => old.width === layout.width && old.height === layout.height ? old : { width: layout.width, height: layout.height });
  }, [viewportWidth, viewportHeight, pinching, finishPreview, gestureId]);
  const onLoad = useCallback(() => updateWindow(scroll.value), [updateWindow, scroll]);
  const onCommitLayoutEffect = useCallback(() => {
    if (appliedResetKey.current !== resetKey) {
      appliedResetKey.current = resetKey;
      dragActive.set(false); endSelectionDrag();
      pending.current = null;
      list.current?.scrollToOffset({ offset: 0, animated: false });
      scroll.set(0); updateWindow(0); scale.set(1); pinching.set(false); busy.set(false);
      gestureId.set(gestureId.value + 1); previewOpacity.set(0); previewStore.setState({ preview: null });
      setPinchInteraction(false);
      return;
    }
    if (pending.current?.columns !== columns) return;
    const { offset, index } = pending.current;
    pending.current = null;
    list.current?.scrollToOffset({ offset, animated: false });
    scroll.set(offset); updateWindow(offset);
    focalX.set(withTiming((index % columns + 0.5) * size, { duration: 120 }));
    focalY.set(withTiming(top + (Math.floor(index / columns) + 0.5) * size - offset, { duration: 120 }));
    scale.set(withTiming(size / Math.max(1, previewSize.value), { duration: 120 }));
    dismissPreview();
  }, [resetKey, columns, scroll, updateWindow, scale, pinching, busy, setPinchInteraction, gestureId, previewOpacity, previewStore, dismissPreview, focalX, focalY, size, top, previewSize, dragActive, endSelectionDrag]);
  const jumpTo = useCallback((index: number) => {
    const maxOffset = Math.max(0, Math.ceil(count / columns) * size + top + bottom - viewport.height);
    const offset = Math.min(maxOffset, Math.max(0, Math.floor(index / columns) * size + top));
    list.current?.scrollToOffset({ offset, animated: false });
    scroll.set(offset); updateWindow(offset);
  }, [columns, size, count, top, bottom, viewport.height, scroll, updateWindow]);
  const selectDate = useCallback((index: number, unit: 'day' | 'month') => {
    if (!selection || !dateForItem) return;
    const selected = new Set(selection.getState().selected);
    for (const itemIndex of galleryDateIndices(data, dateForItem, index, unit)) selected.add(keyExtractor(data[itemIndex]));
    if (!selected.size) return;
    selection.setState({ selecting: true, selected });
    setDatePicker(false);
  }, [selection, dateForItem, data, keyExtractor]);
  const scrubStyle = useAnimatedStyle(() => {
    const maxOffset = Math.max(1, Math.ceil(count / columns) * size + top + bottom - viewportHeight.value);
    return { transform: [{ translateY: Math.max(0, Math.min(1, scroll.value / maxOffset)) * Math.max(0, scrubTrackHeight.value - 48) }] };
  });
  return <View style={rootStyle} onLayout={onLayout}>
    <GestureDetector gesture={gestures}><View style={tw`flex-1`}>
      <FlashList ref={list} {...props} data={data} keyExtractor={keyExtractor} numColumns={columns}
        extraData={listExtra} renderScrollComponent={ScrollComponent} renderItem={renderCell}
        drawDistance={size * 2} maintainVisibleContentPosition={{ disabled: true }}
        contentContainerStyle={contentStyle} scrollEventThrottle={16}
        onScrollBeginDrag={beginScroll} onScrollEndDrag={finishScroll}
        onMomentumScrollBegin={beginScroll} onMomentumScrollEnd={finishScroll}
        onLoad={onLoad} onCommitLayoutEffect={onCommitLayoutEffect} />
    </View></GestureDetector>
    {!!months.length && <>
      <Animated.View style={[tw`absolute top-2 left-3`, timelineStyle]}><Pressable accessibilityRole="button" accessibilityLabel={`Jump to date. ${dateLabel}`} onPress={() => setDatePicker(true)}
        style={tw.style('min-h-11 px-3 rounded-full justify-center', { backgroundColor: background })}>
        <Text style={tw.style('text-xs font-semibold', { color: textColor })}>{dateLabel || months[0].label}</Text>
      </Pressable></Animated.View>
      <View accessibilityRole="adjustable" accessibilityLabel="Gallery timeline" accessibilityHint="Drag to move quickly through dates"
        style={tw`absolute top-16 right-0 bottom-28 w-8 items-center`}
        onLayout={(event) => { scrubHeight.current = Math.max(1, event.nativeEvent.layout.height); scrubTrackHeight.set(scrubHeight.current); }}
        onStartShouldSetResponder={() => true} onResponderGrant={(event) => { startScrollInteraction(); showTimeline(); jumpTo(Math.floor(Math.max(0, Math.min(1, event.nativeEvent.locationY / scrubHeight.current)) * (count - 1))); }}
        onResponderMove={(event) => jumpTo(Math.floor(Math.max(0, Math.min(1, event.nativeEvent.locationY / scrubHeight.current)) * (count - 1)))}
        onResponderRelease={() => { endScrollInteraction(); hideTimeline(); }} onResponderTerminate={() => { endScrollInteraction(); hideTimeline(); }}>
        <Animated.View style={[tw.style('w-1 h-12 rounded-full', { backgroundColor: textSecondary }), scrubStyle, timelineStyle]} />
      </View>
      <Modal visible={datePicker} transparent animationType="fade" onRequestClose={() => setDatePicker(false)}>
        <View style={tw`flex-1 bg-black/60 justify-center px-6`}><View style={tw.style('rounded-2xl p-5 h-2/3', { backgroundColor: background })}>
          <Text accessibilityRole="header" style={tw.style('text-xl font-semibold pb-3', { color: textColor })}>Jump to month</Text>
          {selection && <Pressable accessibilityRole="button" accessibilityLabel={`Select media from ${dateLabel}`} onPress={() => selectDate(currentDateIndex.current, 'day')}
            style={tw.style('min-h-11 px-3 mb-2 rounded-full justify-center', { backgroundColor: background })}>
            <Text style={tw.style('text-sm font-medium', { color: textColor })}>{selectionScope === 'loaded' ? 'Select loaded media from this day' : 'Select this day'}</Text>
          </Pressable>}
          <FlatList data={months} keyExtractor={(item) => item.key} renderItem={({ item }) => <View style={tw`flex-row items-center`}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Jump to ${item.label}`} onPress={() => { jumpTo(item.index); setDatePicker(false); }}
              style={tw`flex-1 min-h-12 justify-center`}><Text style={tw.style('text-base', { color: textColor })}>{item.label}</Text></Pressable>
            {selection && <Pressable accessibilityRole="button" accessibilityLabel={`Select media from ${item.label}`} onPress={() => selectDate(item.index, 'month')}
              style={tw`min-h-11 min-w-11 px-2 justify-center`}><Text style={tw.style('text-sm font-medium', { color: textColor })}>{selectionScope === 'loaded' ? 'Select loaded' : 'Select'}</Text></Pressable>}
          </View>} />
          <Pressable accessibilityRole="button" onPress={() => setDatePicker(false)} style={tw`min-h-11 justify-center`}><Text style={tw.style('text-base', { color: textColor })}>Close</Text></Pressable>
        </View></View>
      </Modal>
    </>}
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[tw`absolute inset-0`, overlayStyle]}>
      <View style={tw`absolute inset-0 bg-black/65`} />
      <Animated.View style={[tw`absolute`, previewStyle]}>
        {[[0, -1], [-1, 0], [1, 0], [0, 1]].map(([x, y]) => <View key={`${x}:${y}`} style={tw.style('absolute w-full h-full border border-white/25 bg-white/5', { left: `${x * 100}%`, top: `${y * 100}%` })} />)}
        <View style={tw`w-full h-full overflow-hidden`}><PinchTile store={previewStore} renderItem={renderItem} /></View>
      </Animated.View>
    </Animated.View>
  </View>;
}
