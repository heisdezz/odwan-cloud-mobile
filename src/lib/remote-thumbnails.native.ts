import { Directory, File, Paths } from 'expo-file-system';
import { withRemoteThumbnailSource } from './remote-thumbnail-source';

/** Download on the cancellable network worker; keep original bytes out of JS memory. */
export async function withRemoteThumbnailFile<T>(source: { uri: string; headers?: Record<string, string> },
  consume: (file: File) => Promise<T>) {
  const directory = new Directory(Paths.cache, 'thumbnail-sources');
  directory.create({ idempotent: true, intermediates: true });
  const file = new File(directory, `${Date.now()}-${Math.random().toString(36).slice(2)}.source`);
  return withRemoteThumbnailSource({
    download: (signal, progress) => File.downloadFileAsync(source.uri, file, {
      headers: source.headers, signal,
      onProgress: ({ bytesWritten, totalBytes }) => progress(bytesWritten, totalBytes),
    }),
    decode: consume,
    cleanup: () => { if (file.exists) file.delete(); },
  });
}
