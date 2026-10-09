import { requireOptionalNativeModule } from 'expo';

const native = requireOptionalNativeModule<{
  generateThumbnail: (uri: string, assetId: string, video: boolean, destination: string) => Promise<string | null>;
  generateFileVideoThumbnail?: (uri: string, destination: string) => Promise<string>;
}>('OdwanMedia');

/** Older APKs, Expo Go and iOS keep using the Expo thumbnail pipeline. */
export async function generateDeviceThumbnail(uri: string, assetId: string, video: boolean, destination: string) {
  return native ? native.generateThumbnail(uri, assetId, video, destination) : null;
}

/** Rebuilt Android apps decode downloaded videos entirely on the native I/O worker. */
export async function generateFileVideoThumbnail(uri: string, destination: string) {
  return native?.generateFileVideoThumbnail ? native.generateFileVideoThumbnail(uri, destination) : null;
}
