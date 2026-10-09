import { requireOptionalNativeModule } from 'expo';

const native = requireOptionalNativeModule<{
  generateThumbnail: (uri: string, assetId: string, video: boolean, destination: string) => Promise<string | null>;
}>('OdwanMedia');

/** Older APKs, Expo Go and iOS keep using the Expo thumbnail pipeline. */
export async function generateDeviceThumbnail(uri: string, assetId: string, video: boolean, destination: string) {
  return native ? native.generateThumbnail(uri, assetId, video, destination) : null;
}
