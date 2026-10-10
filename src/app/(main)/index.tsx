import { BackupStatusCard } from "@/components/uploads/backup-status-card";
import { createMediaItemsSelector } from "@/helpers/media-pages";
import { useCallback, useMemo } from "react";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { pb } from "@/client/pb";
import PageLoader from "@/components/layouts/PageLoader";
import { MediaTypeFilter } from "@/components/media/media-filter";
import { MediaGrid } from "@/components/media/media-grid";
import { Button } from "@/components/ui";
import { useMediaItems } from "@/hooks/use-media-items";
import { useTheme } from "@/hooks/use-theme";
import tw from "@/lib/tw";
import { useServerStore } from "@/stores/server-store";

export default function HomeScreen() {
  const colors = useTheme();
  const { verifiedUrl, account } = useServerStore();
  const query = useMediaItems();
  const selectItems = useMemo(() => createMediaItemsSelector(), []);
  const items = useMemo(
    () => selectItems(query.data?.pages),
    [selectItems, query.data?.pages],
  );
  const {
    fetchNextPage,
    refetch,
    hasNextPage,
    isFetching,
    isFetchNextPageError,
    isRefetchError,
  } = query;
  const refresh = useCallback(() => {
    if (!isFetching) void refetch();
  }, [isFetching, refetch]);
  const loadMore = useCallback(() => {
    if (isFetching) return;
    if (isFetchNextPageError || hasNextPage) void fetchNextPage();
    else if (isRefetchError) void refetch();
  }, [
    isFetching,
    isFetchNextPageError,
    hasNextPage,
    isRefetchError,
    fetchNextPage,
    refetch,
  ]);
  const loadViewerPage = useCallback(async () => {
    if (!hasNextPage) return undefined;
    const result = await fetchNextPage();
    if (result.isError) throw result.error;
    return result.data?.pages.flatMap((page) => page.items);
  }, [hasNextPage, fetchNextPage]);
  return (
    <SafeAreaView
      edges={["top"]}
      style={tw.style("flex-1", { backgroundColor: colors.background })}
    >
      <View style={tw`px-4 pt-2 pb-2 flex-row items-center gap-3`}>
        <Text style={tw.style('flex-1 text-2xl font-semibold', { color: colors.text })}>Cloud</Text>
        {!!verifiedUrl && !!account && <BackupStatusCard compact />}
      </View>
      {!verifiedUrl || !account ? (
        <View style={tw`flex-1 justify-center px-6 gap-4 pb-24`}>
          <Text
            style={tw.style("text-xl font-medium text-center", {
              color: colors.text,
            })}
          >
            Your photo library
          </Text>
          <Text
            style={tw.style("text-base text-center", {
              color: colors.textSecondary,
            })}
          >
            Connect to your server and log in to see your media.
          </Text>
          <Button
            label="Open Settings"
            onPress={() => router.navigate("/settings")}
          />
        </View>
      ) : (
        <View style={tw`flex-1`}>
          <MediaTypeFilter refreshing={query.isFetching} onRefresh={refresh} />
          <PageLoader query={query}>
            {() => (
              <MediaGrid
                items={items}
                serverUrl={verifiedUrl}
                token={pb.authStore.token}
                onLoadMore={loadMore}
                loadViewerPage={loadViewerPage}
                loadingMore={query.isFetchingNextPage}
                error={query.error}
              />
            )}
          </PageLoader>
        </View>
      )}
    </SafeAreaView>
  );
}
