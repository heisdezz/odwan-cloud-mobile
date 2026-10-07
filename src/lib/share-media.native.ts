import { requireOptionalNativeModule } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';
import { pb } from '@/client/pb';
import { mediaStreamUrl } from '@/helpers/media';
import { matchesViewerScope, type ViewerItem, type ViewerScope } from '@/helpers/media-viewer';
import { useServerStore } from '@/stores/server-store';
import { resolveDeviceMediaUri } from './device-media.native';

export async function shareMedia(item: ViewerItem, scope: ViewerScope | undefined, signal: AbortSignal) {
  if (!requireOptionalNativeModule('ExpoSharing')) throw new Error('Install the latest development build to share media.');
  const sharing = await import('expo-sharing');
  if (!await sharing.isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
  const valid = () => {
    if (signal.aborted) throw new Error('Sharing cancelled.');
    if (!matchesViewerScope(scope, useServerStore.getState())) throw new Error('Your server or login changed. Reopen the item to share it.');
  };
  valid();
  const directory = new Directory(Paths.cache, 'shared-media', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  directory.create({ intermediates: true });
  const name = item.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(-150) || (item.video ? 'video.mp4' : 'photo.jpg');
  const file = new File(directory, name);
  try {
    if (item.kind === 'local') {
      await new File(await resolveDeviceMediaUri(item.id, item.uri)).copy(file);
    } else {
      if (!scope || !pb.authStore.isValid) throw new Error('Log in to share this media.');
      await File.downloadFileAsync(mediaStreamUrl(scope.serverUrl, item.id), file, { headers: { Authorization: pb.authStore.token }, signal });
    }
    valid();
    await sharing.shareAsync(file.uri, { dialogTitle: item.name, mimeType: item.kind === 'remote' ? item.record.mime_type : item.video ? 'video/*' : 'image/*' });
    // Keep the exported file in OS-managed cache while the recipient reads it.
  } catch (error) {
    if (directory.exists) directory.delete();
    throw error;
  }
}
