import type { InfiniteData } from '@tanstack/react-query';
import type { ListResult } from 'pocketbase';
import type { MediaItemResponse } from '../../pocketbase-types';

export function patchMovedMedia(data: InfiniteData<ListResult<MediaItemResponse>> | undefined, ids: ReadonlySet<string>, destination: string, sourceAlbum: unknown) {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    if (!page.items.some((item) => ids.has(item.id))) return page;
    changed = true;
    const items = page.items.filter((item) => !ids.has(item.id) || !sourceAlbum || sourceAlbum === destination)
      .map((item) => ids.has(item.id) ? { ...item, album_id: destination } : item);
    return { ...page, items };
  });
  return changed ? { ...data, pages } : data;
}
