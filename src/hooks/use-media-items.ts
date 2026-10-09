import { useInfiniteQuery } from "@tanstack/react-query";
import PocketBase, { BaseAuthStore } from "pocketbase";
import { pb } from "@/client/pb";
import { useServerStore } from "@/stores/server-store";
import { useGridStore } from "@/stores/grid-store";
import { useMediaCapabilities } from "./use-media-capabilities";
import { mediaMimePattern } from "@/helpers/media-filter";
import type { MediaItemResponse } from "../../pocketbase-types";

export function useMediaItems(albumId?: string, trash = false) {
  const capabilities = useMediaCapabilities();
  const mediaFilter = useGridStore((state) => state.mediaFilter);
  const verifiedUrl = useServerStore((state) => state.verifiedUrl);
  const accountId = useServerStore((state) => state.account?.id);
  const revision = useServerStore((state) => state.revision);
  return useInfiniteQuery({
    queryKey: [
      "media-items",
      verifiedUrl,
      accountId,
      revision,
      albumId ?? null,
      mediaFilter,
      trash,
      capabilities.data?.trash ?? false,
    ],
    enabled: !!verifiedUrl && !!accountId && (capabilities.isSuccess || capabilities.isError) && (!trash || capabilities.data?.trash === true),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    initialPageParam: 1,
    queryFn: async ({ pageParam, signal }) => {
      if (!verifiedUrl || !pb.authStore.isValid)
        throw new Error("Log in again to load your media.");
      // Isolate the client so a URL edit cannot redirect an in-flight request.
      const client = new PocketBase(verifiedUrl, new BaseAuthStore());
      client.authStore.save(pb.authStore.token, pb.authStore.record);
      const mime = trash ? "" : mediaMimePattern(mediaFilter);
      const filter = [
        capabilities.data?.trash ? (trash ? "trashed_at > 0" : "trashed_at = 0") : "",
        albumId ? client.filter("album_id = {:album}", { album: albumId }) : "",
        mime ? client.filter("mime_type ~ {:mime}", { mime }) : "",
      ]
        .filter(Boolean)
        .join(" && ");
      return client
        .collection("media_item")
        .getList<MediaItemResponse>(pageParam, 60, {
          sort: "-created_at,-id",
          filter: filter || undefined,
          signal,
          requestKey: null,
        });
    },
    getNextPageParam: (page) =>
      page.page < page.totalPages ? page.page + 1 : undefined,
  });
}
