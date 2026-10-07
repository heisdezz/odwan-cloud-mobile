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

export async function loadDeviceMedia(cursor: GalleryCursor): Promise<{ assets: LocalAsset[]; next?: GalleryCursor }> {
  if (modern) {
    const metadata = await new modern.Query().within(modern.AssetField.MEDIA_TYPE, [modern.MediaType.IMAGE, modern.MediaType.VIDEO])
      .orderBy({ key: modern.AssetField.CREATION_TIME, ascending: false }).offset(Number(cursor)).limit(60).exeForMetadata();
    return {
      assets: metadata.map((asset) => ({
        id: asset.id, uri: asset.id, filename: asset.filename ?? asset.id,
        mediaType: asset.mediaType, width: asset.width ?? 0, height: asset.height ?? 0,
        createdAt: asset.creationTime ?? 0, modifiedAt: asset.modificationTime ?? asset.creationTime ?? 0,
      })),
      next: metadata.length === 60 ? Number(cursor) + 60 : undefined,
    };
  }
  const page = await legacy!.getAssetsAsync({ first: 60, after: typeof cursor === 'string' ? cursor : undefined,
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
