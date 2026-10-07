import { useMemo } from 'react';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { pb } from '@/client/pb';
import PageLoader from '@/components/layouts/PageLoader';
import { MediaGrid } from '@/components/media/media-grid';
import { Button } from '@/components/ui';
import { useMediaItems } from '@/hooks/use-media-items';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import { useServerStore } from '@/stores/server-store';

export default function HomeScreen() {
  const colors = useTheme();
  const { verifiedUrl, account } = useServerStore();
  const query = useMediaItems();
  const items = useMemo(() => {
    const records = query.data?.pages.flatMap((page) => page.items) ?? [];
    return [...new Map(records.map((item) => [item.id, item])).values()];
  }, [query.data]);
  return <SafeAreaView edges={['top']} style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <Text style={tw.style('text-3xl font-semibold px-6 pt-6 pb-4', { color: colors.text })}>Photos</Text>
    {!verifiedUrl || !account ? <View style={tw`flex-1 justify-center px-6 gap-4 pb-24`}>
      <Text style={tw.style('text-xl font-medium text-center', { color: colors.text })}>Your photo library</Text>
      <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Connect to your server and log in to see your media.</Text>
      <Button label="Open Settings" onPress={() => router.navigate('/settings')} />
    </View> : <PageLoader query={query}>
      {() => <MediaGrid items={items} serverUrl={verifiedUrl} token={pb.authStore.token}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={() => { void query.refetch(); }}
        onLoadMore={() => {
          if (query.isFetching) return;
          if (query.isFetchNextPageError || query.hasNextPage) void query.fetchNextPage();
          else if (query.isRefetchError) void query.refetch();
        }}
        loadViewerPage={async () => {
          if (!query.hasNextPage) return undefined;
          const result = await query.fetchNextPage();
          if (result.isError) throw result.error;
          return result.data?.pages.flatMap((page) => page.items);
        }}
        loadingMore={query.isFetchingNextPage} error={query.error}
      />}
    </PageLoader>}
  </SafeAreaView>;
}
