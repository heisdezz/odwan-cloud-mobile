import { useMemo, useCallback } from 'react';
import { Stack } from 'expo-router';
import { Text, View } from 'react-native';
import { pb } from '@/client/pb';
import PageLoader from '@/components/layouts/PageLoader';
import { MediaGrid } from '@/components/media/media-grid';
import { Button } from '@/components/ui';
import { useMediaCapabilities } from '@/hooks/use-media-capabilities';
import { useMediaItems } from '@/hooks/use-media-items';
import { useTheme } from '@/hooks/use-theme';
import { useServerStore } from '@/stores/server-store';
import { extract_message } from '@/helpers/api';
import tw from '@/lib/tw';

export default function TrashScreen() {
  const colors = useTheme();
  const url = useServerStore((state) => state.verifiedUrl);
  const account = useServerStore((state) => state.account);
  const capabilities = useMediaCapabilities();
  const query = useMediaItems(undefined, true);
  const items = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const { hasNextPage, isFetching, fetchNextPage } = query;
  const loadMore = useCallback(() => { if (hasNextPage && !isFetching) void fetchNextPage(); }, [hasNextPage, isFetching, fetchNextPage]);
  return <View style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <Stack.Screen options={{ title: 'Trash' }} />
    {!url || !account ? <Text style={tw.style('p-6', { color: colors.text })}>Connect and log in to your server first.</Text>
      : !capabilities.data?.trash ? <View style={tw`p-6 gap-4`}>
        <Text style={tw.style('text-base', { color: colors.text })}>{capabilities.isPending ? 'Checking server…' : capabilities.error ? extract_message(capabilities.error) : 'Update your server to enable recoverable trash.'}</Text>
        {!capabilities.isPending && <Button label="Check again" onPress={() => { void capabilities.refetch(); }} />}
      </View> : <>
        <Text style={tw.style('px-4 py-3 text-sm', { color: colors.textSecondary })}>Items are kept for 30 days. Hold an item to restore or permanently delete it.</Text>
        <PageLoader query={query}>{() => <MediaGrid trash items={items} serverUrl={url} token={pb.authStore.token} onLoadMore={loadMore} loadingMore={query.isFetchingNextPage} error={query.error} />}</PageLoader>
      </>}
  </View>;
}
