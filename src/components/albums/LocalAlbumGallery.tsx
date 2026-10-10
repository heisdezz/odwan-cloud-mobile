import { useSelectionTabBar } from '@/hooks/use-selection-navigation';
import { useStore } from 'zustand';
import { createMediaSelectionStore, type MediaSelectionStore } from '@/lib/media-selection';
import { DeviceGallerySelection } from '@/components/gallery/device-gallery-selection';
import { memo, useCallback, useDeferredValue, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SymbolView } from "expo-symbols";
import LocalMediaAccess from "./LocalMediaAccess.native";
import PageLoader from "@/components/layouts/PageLoader";
import { MediaTypeFilter } from "@/components/media/media-filter";
import { indexMediaFilters } from "@/helpers/media-filter";
import { useGridStore } from "@/stores/grid-store";
import { GridZoom } from "@/components/media/grid-zoom";
import { MediaThumbnail } from "@/components/media/media-thumbnail";
import { MediaTileBadges } from "@/components/media/media-tile-badges";
import { UploadDestinationSheet } from "@/components/uploads/upload-destination-sheet";
import { UploadQueueSheet } from "@/components/uploads/upload-queue-sheet";
import { Button } from "@/components/ui";
import { extract_message } from "@/helpers/api";
import { localViewerItem } from "@/helpers/media-viewer";
import { useTheme } from "@/hooks/use-theme";
import { loadDeviceAlbums } from "@/lib/device-albums.native";
import { useDeviceAlbumAssets } from "@/hooks/use-device-album-assets.native";
import { readBackupStatuses } from "@/db/local-store.native";
import { backupLabel, type BackupStatus, type LocalAsset } from "@/db/schema";
import tw from "@/lib/tw";
import { useMediaViewer } from "@/providers/media-viewer-provider";
import { useAssetBackupStatus } from "@/providers/upload-activity-provider";
import { useServerStore } from "@/stores/server-store";

const assetKey = (asset: LocalAsset) => asset.id;
const assetType = (asset: LocalAsset) => asset.mediaType;
const EMPTY_ASSETS: LocalAsset[] = [];

const dateForItem = (item: LocalAsset) => item.createdAt;

const AlbumTile = memo(function AlbumTile({
  item,
  size,
  previewEnabled,
  selection,
  status: savedStatus,
  onOpen,
}: {
  item: LocalAsset;
  size: number;
  previewEnabled: boolean;
  selection: MediaSelectionStore;
  status?: BackupStatus;
  onOpen: (id: string) => void;
}) {
  const colors = useTheme();
  const status = useAssetBackupStatus(item, savedStatus);
  const selecting = useStore(selection, (state) => state.selecting);
  const selected = useStore(selection, (state) => state.selected.has(item.id));
  return (
    <Pressable
      accessibilityRole={selecting ? "checkbox" : "button"}
      accessibilityLabel={`${item.mediaType === "video" ? "Video" : "Photo"}: ${item.filename}. ${backupLabel(status)}`}
      accessibilityHint={
        selecting ? "Toggle selection" : "Hold to select for upload"
      }
      accessibilityState={selecting ? { checked: selected } : undefined}
      onPress={() => (selecting ? selection.getState().toggle(item.id) : onOpen(item.id))}
      onLongPress={() => selection.getState().start(item.id)}
      accessibilityActions={[{ name: "select", label: "Select for upload" }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === "select") selection.getState().start(item.id);
      }}
      style={tw.style("m-0.5 overflow-hidden", {
        width: size - 4,
        height: size - 4,
        backgroundColor: colors.backgroundElement,
      })}
    >
      <MediaThumbnail
        source={{ uri: item.uri }}
        cacheKey={["local", item.id, item.modifiedAt]}
        name={item.filename}
        local
        video={item.mediaType === "video"}
        enabled={previewEnabled}
      />
      <MediaTileBadges
        video={item.mediaType === "video"}
        showBackup
        status={status}
      />
      {selected && (
        <View
          pointerEvents="none"
          style={tw.style("absolute inset-0 border-2", {
            borderColor: colors.primary,
          })}
        />
      )}
      {selecting && (
        <View
          pointerEvents="none"
          style={tw.style(
            "absolute top-1 left-1 h-6 w-6 rounded-full items-center justify-center",
            {
              backgroundColor: selected ? colors.primary : "#00000088",
              borderWidth: 1,
              borderColor: "white",
            },
          )}
        >
          {selected && (
            <SymbolView
              name={{ ios: "checkmark", android: "check", web: "check" }}
              size={16}
              tintColor={colors.onPrimary}
            />
          )}
        </View>
      )}
    </Pressable>
  );
});

function AlbumContent({ id, title }: { id: string; title?: string }) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const viewer = useMediaViewer();

  const { verifiedUrl, account, revision } = useServerStore();
  const [selection] = useState(createMediaSelectionStore);
  useSelectionTabBar(selection);
  const selecting = useStore(selection, (state) => state.selecting);
  const [uploadAssets, setUploadAssets] = useState<LocalAsset[]>([]);
  const [sheet, setSheet] = useState<"destination" | "queue" | null>(null);
  const query = useDeviceAlbumAssets(id);
  const deviceAlbums = useQuery({
    queryKey: ["device-albums", "list"],
    queryFn: loadDeviceAlbums,
    enabled: !title,
    staleTime: Infinity,
    networkMode: "always",
  });
  const albumName =
    title ?? deviceAlbums.data?.find((album) => album.id === id)?.title ?? "";
  const scope = useMemo(
    () =>
      verifiedUrl && account
        ? { serverUrl: verifiedUrl, accountId: account.id }
        : null,
    [verifiedUrl, account],
  );
  const backup = useQuery({
    queryKey: [
      "backup-status",
      "device-album",
      id,
      verifiedUrl,
      account?.id,
      query.dataUpdatedAt,
    ],
    enabled: !!scope && query.isSuccess,
    queryFn: () => readBackupStatuses(query.data ?? [], scope),
    staleTime: Infinity,
    networkMode: "always",
  });
  const statuses = backup.data;
  const mediaFilter = useGridStore((state) => state.mediaFilter);
  // Let the filter chips respond before the recycler updates a large dataset.
  const displayedFilter = useDeferredValue(mediaFilter);
  const indexedAssets = useMemo(
    () => indexMediaFilters(query.data ?? EMPTY_ASSETS, assetType),
    [query.data],
  );
  const assets = indexedAssets[displayedFilter];
  const filteredIds = useMemo(() => assets.map(assetKey), [assets]);
  const upload = useCallback((ids: readonly string[]) => {
    const selected = new Set(ids);
    setUploadAssets((query.data ?? []).filter((asset) => selected.has(asset.id)));
    setSheet('destination');
  }, [query.data]);
  const open = useCallback(
    (assetId: string) =>
      viewer.open({ items: assets.map(localViewerItem), selectedId: assetId }),
    [assets, viewer],
  );
  const renderItem = useCallback(
    ({
      item,
      size,
      previewEnabled,
    }: {
      item: LocalAsset;
      size: number;
      previewEnabled: boolean;
    }) => (
      <AlbumTile
        item={item}
        size={size}
        previewEnabled={previewEnabled}
        selection={selection}
        status={statuses?.[item.id]}
        onOpen={open}
      />
    ),
    [selection, statuses, open],
  );
  return (
    <View style={tw`flex-1 mt-2`}>
      <PageLoader query={query}>
        {() => (
          <GridZoom
            selection={selection}
            dateForItem={dateForItem}
            resetKey={displayedFilter}
            data={assets}
            keyExtractor={assetKey}
            getItemType={assetType}
            renderItem={renderItem}
            contentInsets={{ bottom: 100 + insets.bottom }}
            ListEmptyComponent={
              <Text
                style={tw.style("px-6 py-16 text-base text-center", {
                  color: colors.textSecondary,
                })}
              >
                {displayedFilter === "all"
                  ? "No accessible photos or videos in this album."
                  : `No ${displayedFilter} in this album.`}
              </Text>
            }
            ListFooterComponent={
              query.error ? (
                <View style={tw`px-6 py-4 gap-3`}>
                  <Text
                    accessibilityRole="alert"
                    style={tw.style("text-base", { color: colors.text })}
                  >
                    {extract_message(query.error)}
                  </Text>
                  <Button
                    label="Retry"
                    loading={query.isFetching}
                    onPress={() => {
                      void query.refetch();
                    }}
                  />
                </View>
              ) : null
            }
          />
        )}
      </PageLoader>
      {!selecting && <View pointerEvents="box-none" style={tw.style('absolute left-3 right-3 items-center z-30', { bottom: Math.max(12, insets.bottom) })}>
        <View style={tw.style('w-full max-w-md rounded-full px-2 py-1', {
          backgroundColor: colors.backgroundElement, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.2, shadowRadius: 8,
        })}>
          <MediaTypeFilter refreshing={query.isFetching} onRefresh={() => { void query.refetch(); }} />
        </View>
      </View>}
      <DeviceGallerySelection selection={selection} ids={filteredIds} bottom={Math.max(12, insets.bottom)} onUpload={upload} />
      {sheet === "destination" && (
        <UploadDestinationSheet
          key={`${verifiedUrl}:${account?.id}:${revision}`}
          assets={uploadAssets}
          albumName={albumName}
          onClose={() => setSheet(null)}
          onQueued={() => {
            selection.getState().clear();
            setUploadAssets([]);
            setSheet("queue");
          }}
        />
      )}
      {sheet === "queue" && <UploadQueueSheet onClose={() => setSheet(null)} />}
    </View>
  );
}

export default function LocalAlbumGallery({
  id,
  title,
}: {
  id: string;
  title?: string;
}) {
  return (
    <LocalMediaAccess>
      <AlbumContent key={id} id={id} title={title} />
    </LocalMediaAccess>
  );
}
