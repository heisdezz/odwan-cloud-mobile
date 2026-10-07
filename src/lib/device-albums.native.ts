import * as MediaLibrary from 'expo-media-library/legacy';
import type { LocalAsset } from '@/db/schema';
import { loadDeviceMedia, type GalleryCursor } from '@/lib/device-media.native';
import { waitForGalleryIdle } from '@/lib/gallery-scheduler';

export type DeviceAlbum = { id: string; title: string; assetCount: number };

// The legacy entry point provides album counts in one native query. Avoid
// enumerating every album's assets just to obtain its count in the class API.
export async function loadDeviceAlbums(): Promise<DeviceAlbum[]> {
  const albums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
  return albums.map(({ id, title, assetCount }) => ({ id, title, assetCount: assetCount ?? 0 }))
    .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
}

export async function loadDeviceAlbumCover(id: string, signal: AbortSignal) {
  if (signal.aborted) throw new Error('Album preview cancelled.');
  const page = await loadDeviceMedia(0, { albumId: id, pageSize: 1 });
  if (signal.aborted) throw new Error('Album preview cancelled.');
  return page.assets[0] ?? null;
}

export async function loadDeviceAlbumAssets(id: string, signal: AbortSignal): Promise<LocalAsset[]> {
  const assets: LocalAsset[] = [];
  let cursor: GalleryCursor = 0;
  const seenCursors = new Set<GalleryCursor>();
  do {
    await waitForGalleryIdle(signal);
    const page = await loadDeviceMedia(cursor, { albumId: id, pageSize: 100 });
    if (signal.aborted) throw new Error('Album loading cancelled.');
    assets.push(...page.assets);
    if (page.next === undefined) break;
    if (seenCursors.has(page.next)) throw new Error('Could not load the remaining album items. Pull to refresh and try again.');
    seenCursors.add(page.next);
    cursor = page.next;
  } while (true);
  return [...new Map(assets.map((asset) => [asset.id, asset])).values()];
}
