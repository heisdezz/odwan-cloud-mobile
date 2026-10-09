import { useStore } from 'zustand';
import { SymbolView } from 'expo-symbols';
import { createMediaSelectionStore, type MediaSelectionStore } from '@/lib/media-selection';
import { useMediaCapabilities } from '@/hooks/use-media-capabilities';
import { useDeleteServerMedia } from '@/hooks/use-delete-server-media';
import { ServerMediaSelectionBar, DeleteServerMediaConfirmation } from './server-media-selection';
import { pocketbaseThumbnailSource } from '@/lib/pocketbase-thumbnail';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { mediaName } from "@/helpers/media";
import { useTheme } from "@/hooks/use-theme";
import tw from "@/lib/tw";
import type { MediaItemResponse } from "../../../pocketbase-types";

const dateForItem = (item: MediaItemResponse) => item.created_at;

const mediaKey = (item: MediaItemResponse) => item.id;
const mediaInsets = { bottom: BottomTabInset + 24 };

const MediaTile = memo(function MediaTile({
  item,
  serverUrl,
  token,
  previewEnabled,
  onPress,
  size,
  selection,
  deleting,
}: {
  item: MediaItemResponse;
  serverUrl: string;
  token: string;
  previewEnabled: boolean;
  onPress: (id: string) => void;
  size: number;
  selection: MediaSelectionStore;
  deleting: boolean;
}) {
  const selecting = useStore(selection, (state) => state.selecting);
  const selected = useStore(selection, (state) => state.selected.has(item.id));
  const colors = useTheme();
  const accountId = useServerStore((state) => state.account?.id);
  const video = item.mime_type.startsWith("video/");
  const available =
    item.upload_status === "success" &&
    !!item.storage_backend &&
    !!item.storage_bucket &&
    !!item.storage_key;
  const thumbnail = useMemo(() => (
    <MediaThumbnail
      source={pocketbaseThumbnailSource(serverUrl, item, token)}
      video={video}
      cacheKey={[
        "remote",
        serverUrl,
        accountId ?? "",
        item.id,
        item.thumbs ?? "",
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
  ), [item, serverUrl, token, video, accountId, previewEnabled]);
  return (
    <Pressable
      disabled={deleting}
      onPress={() => selecting ? selection.getState().toggle(item.id) : onPress(item.id)}
      onLongPress={() => selection.getState().start(item.id)}
      accessibilityRole={selecting ? "checkbox" : "button"}
      accessibilityActions={[{ name: "select", label: "Select media" }]}
      onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === "select" && !deleting) selection.getState().start(item.id); }}
      accessibilityHint={selecting ? "Toggle selection" : "Hold to select for deletion"}
      accessibilityState={{ disabled: deleting, ...(selecting ? { checked: selected } : {}) }}
      accessible
      accessibilityLabel={`${video ? "Video" : "Photo"}: ${mediaName(item)}`}
      style={tw.style("m-0.5 overflow-hidden", {
        width: size - 4,
        height: size - 4,
        backgroundColor: colors.backgroundElement,
      })}
    >
      {available ? (
        thumbnail
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
      {selected && <View pointerEvents="none" style={tw.style('absolute inset-0 border-2', { borderColor: colors.primary })} />}
      {selecting && <View pointerEvents="none" style={tw.style('absolute top-1 left-1 h-6 w-6 rounded-full border items-center justify-center', {
        backgroundColor: selected ? colors.primary : '#00000088', borderColor: 'white',
      })}>{selected && <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} tintColor={colors.onPrimary} />}</View>}

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
  trash?: boolean;
  loadViewerPage?: () => Promise<MediaItemResponse[] | undefined>;
};

const MediaGridContent = memo(function MediaGridContent({
  items,
  serverUrl,
  token,
  onLoadMore,
  loadingMore,
  error,
  albumId,
  loadViewerPage,
  trash = false,
}: MediaGridProps) {
  const capabilities = useMediaCapabilities();
  const [selection] = useState(createMediaSelectionStore);
  const [confirmation, setConfirmation] = useState<string[] | null>(null);
  const [completed, setCompleted] = useState(0);
  const onDeleted = useCallback((ids: readonly string[]) => selection.getState().remove(ids), [selection]);
  const onProgress = useCallback((count: number) => setCompleted(count), []);
  const deletion = useDeleteServerMedia(serverUrl, onDeleted, onProgress, trash ? "permanent" : "trash");
  const restoration = useDeleteServerMedia(serverUrl, onDeleted, onProgress, "restore");
  const deleting = deletion.isPending || restoration.isPending;
  const loadedIds = useMemo(() => items.map((item) => item.id), [items]);
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
    if (trash) { selection.getState().start(id); return; }
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
  }, [viewer, serverUrl, albumId, loadViewerPage, trash, selection]);
  const renderItem = useCallback(({ item, size, previewEnabled }: { item: MediaItemResponse; size: number; previewEnabled: boolean }) => (
    <MediaTile item={item} serverUrl={serverUrl} token={token} previewEnabled={previewEnabled} onPress={open} size={size} selection={selection} deleting={deleting} />
  ), [serverUrl, token, open, selection, deleting]);
  return (
    <View style={tw`flex-1`}>
    <ServerMediaSelectionBar selection={selection} loadedIds={loadedIds} deleting={deleting} onDelete={setConfirmation} trashAvailable={capabilities.data?.trash} onRestore={trash ? (ids) => restoration.mutate(ids) : undefined} />
    <GridZoom dateForItem={dateForItem}
      resetKey={mediaFilter}
      data={items}
      keyExtractor={mediaKey}
      renderItem={renderItem}
      contentInsets={mediaInsets}
      onEndReached={deleting ? undefined : onLoadMore}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        <View style={tw`px-6 py-20 gap-3 items-center`}>
          <Text style={tw.style("text-xl font-medium", { color: colors.text })}>
            {trash ? 'Trash is empty' : mediaFilter === 'all' ? 'No media yet' : `No ${mediaFilter} found`}
          </Text>
          <Text
            style={tw.style("text-base text-center", {
              color: colors.textSecondary,
            })}
          >
            {trash ? "Removed items will appear here for 30 days." : "Items from your server will appear here."}
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
    {confirmation && <DeleteServerMediaConfirmation permanent={trash} count={confirmation.length} completed={completed} deleting={deleting}
      onCancel={() => setConfirmation(null)} onConfirm={() => {
        if (deleting) return;
        setCompleted(0);
        deletion.mutate(confirmation, { onSettled: () => setConfirmation(null) });
      }} />}
    </View>
  );
});

export const MediaGrid = memo(function MediaGrid(props: MediaGridProps) {
  const accountId = useServerStore((state) => state.account?.id);
  const revision = useServerStore((state) => state.revision);
  return <MediaGridContent key={`${props.serverUrl}:${accountId}:${revision}:${props.albumId ?? ''}`} {...props} />;
});
