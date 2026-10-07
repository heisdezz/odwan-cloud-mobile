import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { FlatList, Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appendViewerItems, type ViewerItem, type ViewerSession } from '@/helpers/media-viewer';
import { extract_message } from '@/helpers/api';
import tw from '@/lib/tw';
import { closeMediaViewer } from '@/helpers/close-media-viewer';
import { ViewerPage } from './viewer-page';

export function MediaPager({ session }: { session: ViewerSession }) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const initialIndex = Math.max(0, session.items.findIndex((item) => item.id === session.selectedId));
  const [items, setItems] = useState(session.items);
  const itemsRef = useRef(items);
  const listRef = useRef<FlatList<ViewerItem>>(null);
  const pageRequest = useRef(false);
  const ended = useRef(!session.loadMore);
  const alive = useRef(true);
  const [index, setIndex] = useState(initialIndex);
  const [zoomed, setZoomed] = useState(false);
  const [pageError, setPageError] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState<number>();
  const loadMore = useCallback(async () => {
    if (pageRequest.current || ended.current || !session.loadMore) return;
    pageRequest.current = true; setLoading(true); setPageError(undefined);
    try {
      const page = await session.loadMore();
      if (!alive.current) return;
      const next = appendViewerItems(itemsRef.current, page ?? []);
      if (!page || next === itemsRef.current) ended.current = true;
      itemsRef.current = next; setItems(next);
    } catch (error) { if (alive.current) setPageError(extract_message(error)); }
    finally { pageRequest.current = false; if (alive.current) setLoading(false); }
  }, [session]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (index >= items.length - 4 && !pageError) void loadMore(); }, [index, items.length, pageError, loadMore]);
  // Maintain the visible item after rotation/window changes.
  const indexRef = useRef(initialIndex);
  useEffect(() => { indexRef.current = index; }, [index]);
  useEffect(() => { listRef.current?.scrollToIndex({ index: indexRef.current, animated: false }); }, [width]);
  const goTo = (next: number) => {
    if (next < 0 || next >= itemsRef.current.length) return;
    setZoomed(false); setIndex(next);
    listRef.current?.scrollToIndex({ index: next, animated: true });
    router.setParams({ mediaId: itemsRef.current[next].id });
  };
  const active = items[index];
  const viewportHeight = measuredHeight ?? Math.max(1, height - insets.top - insets.bottom - 124);
  return <View style={tw`flex-1 bg-black`}>
    <View style={tw.style('flex-row items-center px-3 gap-3', { paddingTop: insets.top, height: insets.top + 60 })}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close media viewer" onPress={closeMediaViewer} style={tw`min-h-12 justify-center px-4 rounded-full bg-white/10`}><Text style={tw`text-white text-base`}>Close</Text></Pressable>
      <View style={tw`flex-1`}><Text numberOfLines={1} style={tw`text-white text-base font-medium`}>{active.name}</Text><Text style={tw`text-white/70 text-xs mt-1`}>{session.albumId ? 'Album' : session.scope ? 'Photos' : 'Gallery'} · {index + 1} / {items.length}{loading ? ' · Loading more…' : ''}</Text></View>
    </View>
    <FlatList ref={listRef} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false}
      data={items} keyExtractor={(item) => item.id} initialScrollIndex={initialIndex}
      getItemLayout={(_, at) => ({ length: width, offset: width * at, index: at })}
      windowSize={3} initialNumToRender={1} maxToRenderPerBatch={3} removeClippedSubviews={false}
      onLayout={(event) => setMeasuredHeight(Math.max(1, event.nativeEvent.layout.height))}
      scrollEnabled={!zoomed} extraData={{ index, focused, width, viewportHeight }}
      onMomentumScrollEnd={(event) => {
        const next = Math.max(0, Math.min(itemsRef.current.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
        setIndex(next); setZoomed(false);
        router.setParams({ mediaId: itemsRef.current[next].id });
      }}
      renderItem={({ item, index: at }) => <ViewerPage item={item} scope={session.scope} width={width} height={viewportHeight}
        active={focused && at === index} nearby={Math.abs(at - index) <= 1} preload={focused && at === index + 1} onZoomChange={setZoomed} />}
      style={tw`flex-1`} />
    <View style={tw.style('px-4', { paddingBottom: insets.bottom, minHeight: insets.bottom + 64 })}>
      {pageError && <Pressable accessibilityRole="button" accessibilityLabel="Retry loading more media" onPress={() => { void loadMore(); }} style={tw`py-2`}><Text numberOfLines={2} style={tw`text-white text-sm text-center`}>{pageError} · Tap to retry</Text></Pressable>}
      <View style={tw`flex-row justify-between items-center h-16`}>
        <Pressable accessibilityRole="button" disabled={index === 0} onPress={() => goTo(index - 1)} style={tw.style('min-h-12 px-4 justify-center', index === 0 && 'opacity-30')}><Text style={tw`text-white text-base`}>Previous</Text></Pressable>
        <Text style={tw`text-white/70 text-xs`}>{active.video || Platform.OS === 'web' ? 'Swipe for next' : zoomed ? 'Pinch to zoom out' : 'Pinch to zoom'}</Text>
        <Pressable accessibilityRole="button" disabled={index === items.length - 1} onPress={() => goTo(index + 1)} style={tw.style('min-h-12 px-4 justify-center', index === items.length - 1 && 'opacity-30')}><Text style={tw`text-white text-base`}>Next</Text></Pressable>
      </View>
    </View>
  </View>;
}
