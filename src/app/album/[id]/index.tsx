import { createMediaItemsSelector } from "@/helpers/media-pages";
import { useCallback, useMemo } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { pb } from '@/client/pb';
import PageLoader from '@/components/layouts/PageLoader';
import { MediaTypeFilter } from '@/components/media/media-filter';
import { MediaGrid } from '@/components/media/media-grid';
import { useMediaItems } from '@/hooks/use-media-items';
import { useServerStore } from '@/stores/server-store';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export default function AlbumScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { verifiedUrl, account } = useServerStore();
  const colors = useTheme();
  const query = useMediaItems(id);
  const selectItems = useMemo(() => createMediaItemsSelector(), []);
  const items = useMemo(() => selectItems(query.data?.pages), [selectItems, query.data?.pages]);
  const { fetchNextPage, refetch, hasNextPage, isFetching, isFetchNextPageError, isRefetchError } = query;
  const refresh = useCallback(() => { if (!isFetching) void refetch(); }, [isFetching, refetch]);
  const loadMore = useCallback(() => {
    if (isFetching) return;
    if (isFetchNextPageError || hasNextPage) void fetchNextPage();
    else if (isRefetchError) void refetch();
  }, [isFetching, isFetchNextPageError, hasNextPage, isRefetchError, fetchNextPage, refetch]);
  const loadViewerPage = useCallback(async () => {
    if (!hasNextPage) return undefined;
    const result = await fetchNextPage();
    if (result.isError) throw result.error;
    return result.data?.pages.flatMap((page) => page.items);
  }, [hasNextPage, fetchNextPage]);
  return <View style={tw.style('flex-1', { backgroundColor: colors.background })}>
    {!verifiedUrl || !account ? <Text style={tw.style('px-6 py-10 text-base text-center', { color: colors.text })}>Connect to your server and log in to view this album.</Text>
      : <View style={tw`flex-1`}><MediaTypeFilter refreshing={query.isFetching} onRefresh={refresh} /><PageLoader query={query}>{() => <MediaGrid items={items} serverUrl={verifiedUrl} token={pb.authStore.token} albumId={id}
        onLoadMore={loadMore}
        loadingMore={query.isFetchingNextPage} error={query.error}
        loadViewerPage={loadViewerPage} />}</PageLoader></View>}
  </View>;
}
