import { useMemo, useState } from 'react';
import { AlbumBrowserTools, type AlbumSort } from './album-browser-tools';
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { SymbolView } from "expo-symbols";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import LocalMediaAccess from "./LocalMediaAccess.native";
import PageLoader from "@/components/layouts/PageLoader";
import { MediaThumbnail } from "@/components/media/media-thumbnail";
import { MediaTileBadges } from "@/components/media/media-tile-badges";
import { Button } from "@/components/ui";
import { BottomTabInset } from "@/constants/theme";
import { extract_message } from "@/helpers/api";
import { useTheme } from "@/hooks/use-theme";
import {
  loadDeviceAlbums,
  loadDeviceAlbumCover,
  type DeviceAlbum,
} from "@/lib/device-albums.native";
import tw from "@/lib/tw";

function LocalAlbumTile({
  album,
  previewEnabled,
}: {
  album: DeviceAlbum;
  previewEnabled: boolean;
}) {
  const colors = useTheme();
  const preview = useQuery({
    queryKey: ["device-albums", "cover", album.id],
    queryFn: ({ signal }) => loadDeviceAlbumCover(album.id, signal),
    enabled: previewEnabled,
    staleTime: Infinity,
    networkMode: "always",
    refetchOnWindowFocus: false,
  });
  const cover = preview.data;
  const label = `${album.assetCount.toLocaleString()} ${album.assetCount === 1 ? "item" : "items"}`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${album.title}, ${label}`}
      onPress={() =>
        router.push({
          //@ts-ignore
          pathname: "/device-album/[id]",
          params: { id: album.id, title: album.title },
        })
      }
      style={({ pressed }) =>
        tw.style("flex-1 mx-2 mb-6", { opacity: pressed ? 0.7 : 1 })
      }
    >
      <View
        style={tw.style(
          "w-full aspect-square rounded-2xl overflow-hidden items-center justify-center",
          { backgroundColor: colors.backgroundElement },
        )}
      >
        {cover ? (
          <>
            <MediaThumbnail
              source={{ uri: cover.uri }}
              cacheKey={["local", cover.id, cover.modifiedAt]}
              name={cover.filename}
              local
              video={cover.mediaType === "video"}
              enabled={previewEnabled}
            />
            <MediaTileBadges video={cover.mediaType === "video"} />
          </>
        ) : (
          <SymbolView
            name={{
              ios: "rectangle.stack",
              android: "photo_library",
              web: "photo_library",
            }}
            size={40}
            tintColor={colors.textSecondary}
          />
        )}
      </View>
      <Text
        numberOfLines={2}
        style={tw.style("text-base font-semibold mt-3", { color: colors.text })}
      >
        {album.title}
      </Text>
      <Text style={tw.style("text-sm mt-1", { color: colors.textSecondary })}>
        {label}
      </Text>
    </Pressable>
  );
}

function AlbumList() {
  const colors = useTheme();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<AlbumSort>("name");
  const query = useQuery({
    queryKey: ["device-albums", "list"],
    queryFn: loadDeviceAlbums,
    staleTime: Infinity,
    networkMode: "always",
    refetchOnWindowFocus: false,
  });
  const albums = useMemo(() => (query.data ?? []).filter((album) => album.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())).sort((a, b) => sort === "count" ? b.assetCount - a.assetCount || a.title.localeCompare(b.title) : a.title.localeCompare(b.title)), [query.data, search, sort]);
  return (
    <View style={tw`flex-1`}>
    <AlbumBrowserTools search={search} onSearch={setSearch} sort={sort} onSort={setSort} />
    <PageLoader query={query}>
      {() => (
        <FlashList
          data={albums}
          numColumns={2}
          keyExtractor={(album) => album.id}
          renderItem={({ item, target }) => (
            <LocalAlbumTile album={item} previewEnabled={target === "Cell"} />
          )}
          contentContainerStyle={tw.style("px-4 pt-1", {
            paddingBottom: BottomTabInset + 24,
          })}
          refreshing={query.isRefetching}
          onRefresh={() => {
            void client.invalidateQueries({ queryKey: ["device-albums"] });
          }}
          ListEmptyComponent={
            <View style={tw`px-6 py-20 gap-3 items-center`}>
              <Text
                style={tw.style("text-xl font-medium", { color: colors.text })}
              >
                No device albums
              </Text>
              <Text
                style={tw.style("text-base text-center", {
                  color: colors.textSecondary,
                })}
              >
                Albums containing accessible photos and videos will appear here.
              </Text>
            </View>
          }
          ListFooterComponent={
            query.isFetching && !query.isRefetching ? (
              <ActivityIndicator color={colors.text} style={tw`py-6`} />
            ) : query.error ? (
              <View style={tw`px-2 py-6 gap-3`}>
                <Text
                  accessibilityRole="alert"
                  style={tw.style("text-base", { color: colors.text })}
                >
                  {extract_message(query.error)}
                </Text>
                <Button
                  label="Retry"
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
    </View>
  );
}

export default function LocalAlbums() {
  return (
    <LocalMediaAccess>
      <AlbumList />
    </LocalMediaAccess>
  );
}
