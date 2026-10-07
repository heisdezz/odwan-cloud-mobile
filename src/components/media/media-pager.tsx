import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useIsFocused } from 'expo-router';
import { FlatList, Modal, Pressable, StatusBar, Text, View, useWindowDimensions } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { toast } from 'sonner-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { appendViewerItems, type ViewerItem, type ViewerSession } from '@/helpers/media-viewer';
import { extract_message } from '@/helpers/api';
import tw from '@/lib/tw';
import { closeMediaViewer } from '@/helpers/close-media-viewer';
import { ViewerPage } from './viewer-page';
import { ViewerButton } from './viewer-button';
import { viewerDate, viewerClock } from '@/helpers/viewer-format';
import { useViewerStore } from '@/stores/viewer-store';
import { shareMedia } from '@/lib/share-media';

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
  const [controlsVisible, setControlsVisible] = useState(true);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [sharing, setSharing] = useState(false);
  const shareController = useRef<AbortController | null>(null);
  const toggleControls = useCallback(() => setControlsVisible((value) => !value), []);
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
  useEffect(() => { alive.current = true; return () => { alive.current = false; shareController.current?.abort(); }; }, []);
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
  const favoriteKey = JSON.stringify([active.kind, session.scope?.serverUrl ?? '', session.scope?.accountId ?? '', active.id]);
  const favorite = useViewerStore((state) => !!state.favorites[favoriteKey]);
  const toggleFavorite = useViewerStore((state) => state.toggleFavorite);
  const share = async () => {
    if (shareController.current) return;
    const controller = new AbortController();
    shareController.current = controller;
    setSharing(true);
    const toastId = toast.loading('Preparing media to share…');
    try { await shareMedia(active, session.scope, controller.signal); }
    catch (error) { if (!controller.signal.aborted) toast.error(extract_message(error)); }
    finally {
      toast.dismiss(toastId);
      shareController.current = null;
      if (alive.current) setSharing(false);
    }
  };
  const viewportHeight = measuredHeight ?? Math.max(1, height);
  const date = viewerDate(active.createdAt);
  const location = session.albumId ? 'Album' : session.scope ? 'Photos' : 'Gallery';
  return <View style={tw`flex-1 bg-black`}>
    {focused && <StatusBar barStyle="light-content" />}
    <FlatList ref={listRef} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false}
      data={items} keyExtractor={(item) => item.id} initialScrollIndex={initialIndex}
      getItemLayout={(_, at) => ({ length: width, offset: width * at, index: at })}
      windowSize={3} initialNumToRender={1} maxToRenderPerBatch={3} removeClippedSubviews={false}
      onLayout={(event) => setMeasuredHeight(Math.max(1, event.nativeEvent.layout.height))}
      scrollEnabled={!zoomed && !detailsVisible} extraData={{ index, focused, width, viewportHeight, controlsVisible, detailsVisible, sharing }}
      onMomentumScrollEnd={(event) => {
        const next = Math.max(0, Math.min(itemsRef.current.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
        setIndex(next); setZoomed(false);
        router.setParams({ mediaId: itemsRef.current[next].id });
      }}
      renderItem={({ item, index: at }) => <ViewerPage item={item} scope={session.scope} width={width} height={viewportHeight}
        active={focused && at === index} nearby={Math.abs(at - index) <= 1} preload={focused && at === index + 1} paused={detailsVisible || sharing} onZoomChange={setZoomed} controlsVisible={controlsVisible} onToggleControls={toggleControls} bottomInset={insets.bottom + 80} />}
      style={tw`flex-1`} />
    {controlsVisible && <>
      <View style={tw.style('absolute top-0 left-0 right-0 px-4 pb-3 bg-black/90', { paddingTop: insets.top + 6 })}>
        <View style={tw`flex-row items-center gap-3`}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close media viewer" onPress={closeMediaViewer} style={tw`h-11 w-8 justify-center`}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={22} tintColor="white" />
          </Pressable>
          <Text numberOfLines={1} style={tw`flex-1 text-white text-sm font-medium`}>{index + 1}/{items.length} · {active.name}{loading ? ' · Loading…' : ''}</Text>
        </View>
        <View style={tw`flex-row items-center gap-2`}>
          <SymbolView name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }} size={14} tintColor="#d4d4d4" />
          <Text numberOfLines={1} style={tw`flex-1 text-white/80 text-xs`}>{[date ?? location, viewerClock(active.createdAt)].filter(Boolean).join(' · ')}</Text>
          {!!active.width && !!active.height && <Text style={tw`text-white/80 text-xs`}>{active.width} × {active.height}</Text>}
        </View>
      </View>
      <View style={tw.style('absolute bottom-0 left-0 right-0 bg-black px-5 py-3', { paddingBottom: insets.bottom + 12 })}>
        {pageError && <Pressable accessibilityRole="button" accessibilityLabel="Retry loading more media" onPress={() => { void loadMore(); }} style={tw`py-2`}><Text numberOfLines={2} style={tw`text-white text-sm text-center`}>{pageError} · Tap to retry</Text></Pressable>}
        <View style={tw`flex-row items-center justify-around gap-2`}>
          <ViewerButton label="Previous item" disabled={index === 0} icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} onPress={() => goTo(index - 1)} />
          <ViewerButton label={favorite ? 'Remove favorite in Odwan' : 'Favorite in Odwan'} selected={favorite}
            icon={favorite ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' } : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }} onPress={() => toggleFavorite(favoriteKey)} />
          <ViewerButton label={sharing ? 'Preparing share' : 'Share media'} disabled={sharing || !active.available}
            icon={{ ios: 'square.and.arrow.up', android: 'share', web: 'share' }} onPress={() => { void share(); }} />
          <ViewerButton label="Media details" icon={{ ios: 'info.circle', android: 'info', web: 'info' }} onPress={() => setDetailsVisible(true)} />
          <ViewerButton label="Next item" disabled={index === items.length - 1} icon={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} onPress={() => goTo(index + 1)} />
        </View>
      </View>
    </>}
    <Modal visible={detailsVisible} transparent animationType="fade" onRequestClose={() => setDetailsVisible(false)}>
      <View style={tw`flex-1 justify-end bg-black/60`}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss media details" onPress={() => setDetailsVisible(false)} style={tw`flex-1`} />
        <View accessibilityViewIsModal style={tw.style('bg-neutral-900 rounded-t-3xl px-6 pt-5 gap-5', { paddingBottom: insets.bottom + 24 })}>
          <View style={tw`flex-row items-center justify-between`}>
            <Text style={tw`text-white text-xl font-semibold`}>Media details</Text>
            <ViewerButton label="Close details" icon={{ ios: 'xmark', android: 'close', web: 'close' }} onPress={() => setDetailsVisible(false)} />
          </View>
          <View style={tw`gap-2`}>
            <Text selectable style={tw`text-white text-base`}>{active.name}</Text>
            <Text style={tw`text-white/70 text-sm`}>{[active.video ? 'Video' : 'Photo', active.width && active.height ? `${active.width} × ${active.height}` : undefined, date].filter(Boolean).join(' · ')}</Text>
            <Text style={tw`text-white/70 text-sm`}>{active.kind === 'local' ? 'On this device' : 'Server library'}</Text>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}
