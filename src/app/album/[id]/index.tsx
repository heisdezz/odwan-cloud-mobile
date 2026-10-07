import { useMemo } from 'react';
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
  const items = useMemo(() => [...new Map((query.data?.pages.flatMap((page) => page.items) ?? []).map((item) => [item.id, item])).values()], [query.data]);
  return <View style={tw.style('flex-1', { backgroundColor: colors.background })}>
    {!verifiedUrl || !account ? <Text style={tw.style('px-6 py-10 text-base text-center', { color: colors.text })}>Connect to your server and log in to view this album.</Text>
      : <View style={tw`flex-1`}><MediaTypeFilter refreshing={query.isFetching} onRefresh={() => { void query.refetch(); }} /><PageLoader query={query}>{() => <MediaGrid items={items} serverUrl={verifiedUrl} token={pb.authStore.token} albumId={id}
        onLoadMore={() => { if (!query.isFetching && query.hasNextPage) void query.fetchNextPage(); }}
        loadingMore={query.isFetchingNextPage} error={query.error}
        loadViewerPage={async () => {
          if (!query.hasNextPage) return undefined;
          const result = await query.fetchNextPage();
          if (result.isError) throw result.error;
          return result.data?.pages.flatMap((page) => page.items);
        }} />}</PageLoader></View>}
  </View>;
}
