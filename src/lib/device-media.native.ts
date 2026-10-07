/* eslint-disable @typescript-eslint/no-require-imports -- Native modules must be loaded conditionally for Expo Go. */
import { requireOptionalNativeModule } from 'expo';
import type { LocalAsset } from '@/db/schema';

// Some Expo Go builds bundle only the legacy native module. Avoid evaluating
// the class-based entry point unless its native module is actually available.
const modern: typeof import('expo-media-library') | null = requireOptionalNativeModule('ExpoMediaLibraryNext')
  ? require('expo-media-library') : null;
const legacy: typeof import('expo-media-library/legacy') | null = modern
  ? null : require('expo-media-library/legacy');
export const usePermissions = modern?.usePermissions ?? legacy!.usePermissions;
export const addListener = modern?.addListener ?? legacy!.addListener;
export const presentPermissionsPicker = modern?.presentPermissionsPicker ?? legacy!.presentPermissionsPickerAsync;
export type GalleryCursor = number | string;
export const supportsGalleryUpdates = !!modern;
export async function resolveDeviceMediaUri(id: string, fallback: string) {
  if (modern) return new modern.Asset(id).getUri();
  const info = await legacy!.getAssetInfoAsync(id);
  return info.localUri ?? info.uri ?? fallback;
}

function metadataAsset(asset: import('expo-media-library').AssetMetadata): LocalAsset {
  return { id: asset.id, uri: asset.id, filename: asset.filename ?? asset.id,
    mediaType: asset.mediaType, width: asset.width ?? 0, height: asset.height ?? 0,
    createdAt: asset.creationTime ?? 0, modifiedAt: asset.modificationTime ?? asset.creationTime ?? 0 };
}
export async function loadChangedDeviceMedia(offset: number, since: number) {
  if (!modern) throw new Error('Incremental media queries require the current media-library module.');
  const assets = await new modern.Query().within(modern.AssetField.MEDIA_TYPE, [modern.MediaType.IMAGE, modern.MediaType.VIDEO])
    .gte(modern.AssetField.MODIFICATION_TIME, Math.max(0, since - 2000))
    .orderBy({ key: modern.AssetField.MODIFICATION_TIME, ascending: true }).offset(offset).limit(60).exeForMetadata();
  return { assets: assets.map(metadataAsset), next: assets.length === 60 ? offset + 60 : undefined };
}
export async function loadDeviceMediaIds(offset: number) {
  if (!modern) throw new Error('ID-only queries require the current media-library module.');
  const assets = await new modern.Query().within(modern.AssetField.MEDIA_TYPE, [modern.MediaType.IMAGE, modern.MediaType.VIDEO])
    .orderBy({ key: modern.AssetField.CREATION_TIME, ascending: false }).offset(offset).limit(500).exe();
  return { ids: assets.map((asset) => asset.id), next: assets.length === 500 ? offset + 500 : undefined };
}
export async function loadDeviceMediaByIds(ids: string[]): Promise<LocalAsset[]> {
  return Promise.all(ids.map(async (id) => {
    if (modern) return metadataAsset(await new modern.Asset(id).getInfo());
    const asset = await legacy!.getAssetInfoAsync(id, { shouldDownloadFromNetwork: false });
    return { id: asset.id, uri: asset.uri, filename: asset.filename, mediaType: asset.mediaType === 'photo' ? 'image' : asset.mediaType,
      width: asset.width, height: asset.height, createdAt: asset.creationTime, modifiedAt: asset.modificationTime };
  }));
}

export function mediaChangeIds(event: Parameters<Parameters<typeof addListener>[0]>[0]) {
  // Legacy iOS emits asset objects; the current module emits URI strings.
  const ids = (values?: (string | { id: string })[]) => (values ?? []).map((value) => typeof value === 'string' ? value : value.id);
  return { incremental: event.hasIncrementalChanges === true,
    upsert: [...ids(event.insertedAssets), ...ids(event.updatedAssets)], deleted: ids(event.deletedAssets) };
}

export async function loadDeviceMedia(cursor: GalleryCursor, options: { albumId?: string; pageSize?: number } = {}): Promise<{ assets: LocalAsset[]; next?: GalleryCursor }> {
  const pageSize = options.pageSize ?? 60;
  if (modern) {
    const query = new modern.Query();
    if (options.albumId) query.album(new modern.Album(options.albumId));
    const metadata = await query.within(modern.AssetField.MEDIA_TYPE, [modern.MediaType.IMAGE, modern.MediaType.VIDEO])
      .orderBy({ key: modern.AssetField.CREATION_TIME, ascending: false }).offset(Number(cursor)).limit(pageSize).exeForMetadata();
    return {
      assets: metadata.map(metadataAsset),
      next: metadata.length === pageSize ? Number(cursor) + pageSize : undefined,
    };
  }
  const page = await legacy!.getAssetsAsync({ album: options.albumId, first: pageSize, after: typeof cursor === 'string' ? cursor : undefined,
    mediaType: ['photo', 'video'], sortBy: [['creationTime', false]], resolveWithFullInfo: true });
  return {
    assets: page.assets.map((asset) => ({
      id: asset.id, uri: asset.uri, filename: asset.filename,
      mediaType: asset.mediaType === 'photo' ? 'image' : 'video', width: asset.width, height: asset.height,
      createdAt: asset.creationTime, modifiedAt: asset.modificationTime,
    })),
    next: page.hasNextPage ? page.endCursor : undefined,
  };
}
