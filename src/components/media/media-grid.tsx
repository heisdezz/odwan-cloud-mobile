import { memo, useCallback, useEffect, useRef } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useMediaViewer } from "@/providers/media-viewer-provider";
import { remoteViewerItem } from "@/helpers/media-viewer";
import { useGridStore } from '@/stores/grid-store';
import { GridZoom } from "./grid-zoom";
import { MediaThumbnail } from "./media-thumbnail";
import { MediaTileBadges } from "./media-tile-badges";
import { useServerStore } from "@/stores/server-store";
import { Button } from "@/components/ui";
import { BottomTabInset } from "@/constants/theme";
import { extract_message } from "@/helpers/api";
import { mediaName, mediaThumbnailUrl } from "@/helpers/media";
import { useTheme } from "@/hooks/use-theme";
import tw from "@/lib/tw";
import type { MediaItemResponse } from "../../../pocketbase-types";

const mediaKey = (item: MediaItemResponse) => item.id;
const mediaInsets = { bottom: BottomTabInset + 24 };

const MediaTile = memo(function MediaTile({
  item,
  serverUrl,
  token,
  previewEnabled,
  onPress,
  size,
}: {
  item: MediaItemResponse;
  serverUrl: string;
  token: string;
  previewEnabled: boolean;
  onPress: (id: string) => void;
  size: number;
}) {
  const colors = useTheme();
  const accountId = useServerStore((state) => state.account?.id);
  const video = item.mime_type.startsWith("video/");
  const available =
    item.upload_status === "success" &&
    !!item.storage_backend &&
    !!item.storage_bucket &&
    !!item.storage_key;
  return (
    <Pressable
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      accessible
      accessibilityLabel={`${video ? "Video" : "Photo"}: ${mediaName(item)}`}
      style={tw.style("m-0.5 overflow-hidden", {
        width: size - 4,
        height: size - 4,
        backgroundColor: colors.backgroundElement,
      })}
    >
      {available ? (
        <MediaThumbnail
          source={{
            uri: mediaThumbnailUrl(serverUrl, item.id),
            headers: { Authorization: token },
          }}
          video={video}
          cacheKey={[
            "remote",
            serverUrl,
            accountId ?? "",
            item.id,
            item.file_hash,
            item.storage_backend,
            item.storage_bucket,
            item.storage_key,
            item.storage_etag ?? "",
            item.file_size ?? 0,
          ]}
          name={mediaName(item)}
          enabled={previewEnabled}
        />
      ) : (
        <View style={tw`flex-1 items-center justify-center px-3 gap-2`}>
          <Text
            style={tw.style("text-sm text-center font-medium", {
              color: colors.text,
            })}
          >
            {video ? "Video upload pending" : "Upload pending"}
          </Text>
          <Text
            numberOfLines={2}
            style={tw.style("text-xs text-center", {
              color: colors.textSecondary,
            })}
          >
            {mediaName(item)}
          </Text>
        </View>
      )}
      <MediaTileBadges video={video} />
    </Pressable>
  );
});

type MediaGridProps = {
  items: MediaItemResponse[];
  serverUrl: string;
  token: string;
  onLoadMore: () => void;
  loadingMore: boolean;
  error?: unknown;
  albumId?: string;
  loadViewerPage?: () => Promise<MediaItemResponse[] | undefined>;
};

export const MediaGrid = memo(function MediaGrid({
  items,
  serverUrl,
  token,
  onLoadMore,
  loadingMore,
  error,
  albumId,
  loadViewerPage,
}: MediaGridProps) {
  const mediaFilter = useGridStore((state) => state.mediaFilter);
  const colors = useTheme();
  const viewer = useMediaViewer();
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const open = useCallback((id: string) => {
    const current = useServerStore.getState();
    if (!current.account || current.verifiedUrl !== serverUrl) return;
    viewer.open({
      items: itemsRef.current.map(remoteViewerItem),
      selectedId: id,
      albumId,
      scope: {
        serverUrl,
        accountId: current.account.id,
        revision: current.revision,
      },
      loadMore: loadViewerPage
        ? async () => (await loadViewerPage())?.map(remoteViewerItem)
        : undefined,
    });
  }, [viewer, serverUrl, albumId, loadViewerPage]);
  const renderItem = useCallback(({ item, size, previewEnabled }: { item: MediaItemResponse; size: number; previewEnabled: boolean }) => (
    <MediaTile item={item} serverUrl={serverUrl} token={token} previewEnabled={previewEnabled} onPress={open} size={size} />
  ), [serverUrl, token, open]);
  return (
    <GridZoom
      resetKey={mediaFilter}
      data={items}
      keyExtractor={mediaKey}
      renderItem={renderItem}
      contentInsets={mediaInsets}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <View style={tw`px-6 py-20 gap-3 items-center`}>
          <Text style={tw.style("text-xl font-medium", { color: colors.text })}>
            {mediaFilter === 'all' ? 'No media yet' : `No ${mediaFilter} found`}
          </Text>
          <Text
            style={tw.style("text-base text-center", {
              color: colors.textSecondary,
            })}
          >
            Items from your server will appear here.
          </Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator style={tw`py-6`} color={colors.text} />
        ) : error ? (
          <View style={tw`px-6 py-6 gap-3`}>
            <Text
              accessibilityRole="alert"
              style={tw.style("text-base", { color: colors.text })}
            >
              {extract_message(error)}
            </Text>
            <Button label="Retry" onPress={onLoadMore} />
          </View>
        ) : null
      }
    />
  );
});
