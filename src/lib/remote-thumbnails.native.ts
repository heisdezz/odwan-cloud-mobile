import { Directory, File, Paths } from 'expo-file-system';
import { withRemoteThumbnailSource } from './remote-thumbnail-source';
import { fetchServerThumbnail } from './server-thumbnail';

/** Persist the backend's small JPEG unchanged; no original download or thumbnail generation. */
export async function downloadServerThumbnail(source: { uri: string; headers?: Record<string, string> }, destination: File) {
  const directory = new Directory(Paths.document, 'media-thumbnails-v1');
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  return withRemoteThumbnailSource({
    download: (signal, progress) => fetchServerThumbnail(source, signal, progress),
    publish: async (bytes) => {
      file.write(bytes);
      if (destination.exists) destination.delete();
      await file.move(destination);
      return destination.uri;
    },
    cleanup: () => { if (file.uri !== destination.uri && file.exists) file.delete(); },
  }, { timeoutMs: 60_000, maxBytes: 1024 * 1024 });
}
