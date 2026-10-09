import type { InfiniteData } from '@tanstack/react-query';
import type { ListResult } from 'pocketbase';
import type { MediaItemResponse } from '../../pocketbase-types';

export async function deleteServerMedia(
  ids: readonly string[],
  remove: (id: string) => Promise<unknown>,
  isCurrent: () => boolean,
  progress: (completed: number, total: number) => void = () => {},
) {
  const unique = [...new Set(ids)];
  const deleted: string[] = [];
  const failed: { id: string; error: unknown }[] = [];
  let stopped = false;
  for (const id of unique) {
    if (!isCurrent()) { stopped = true; break; }
    try { await remove(id); deleted.push(id); }
    catch (error) {
      // Already missing is an idempotent success. Permissions/network errors retain selection.
      if ((error as { status?: number })?.status === 404) deleted.push(id);
      else failed.push({ id, error });
    }
    progress(deleted.length + failed.length, unique.length);
  }
  return { deleted, failed, stopped };
}

export function removeDeletedMedia(data: InfiniteData<ListResult<MediaItemResponse>> | undefined, ids: ReadonlySet<string>) {
  if (!data) return data;
  let changed = false;
  const pages = data.pages.map((page) => {
    const items = page.items.filter((item) => !ids.has(item.id));
    if (items.length === page.items.length) return page;
    changed = true;
    return { ...page, items };
  });
  return changed ? { ...data, pages } : data;
}
