import type { ThumbnailSource } from '@/lib/pocketbase-thumbnail';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';
import { createThumbnailQueues } from './thumbnail-queues';
import { createPersistentThumbnailCache } from './persistent-thumbnail-cache';
import { createThumbnailLookup } from './thumbnail-lookup';
import { generateDeviceThumbnail } from './device-thumbnails.native';
import { downloadServerThumbnail } from './remote-thumbnails.native';
import { galleryInteraction } from './gallery-interaction';
import { generateVideoThumbnail } from './video-thumbnails.native';
import { thumbnailDimensions, thumbnailIdentity, THUMBNAIL_QUALITY } from '@/helpers/thumbnail';

const directory = () => new Directory(Paths.document, 'media-thumbnails-v1');
const fileFor = (key: string) => new File(directory(), `${key}.jpg`);
const queues = createThumbnailQueues();
queues.setBusy(galleryInteraction.isBusy());
galleryInteraction.subscribe(() => queues.setBusy(galleryInteraction.isBusy()));
const lookup = createThumbnailLookup();
const getCached = createPersistentThumbnailCache({
  read: async (key) => { const file = fileFor(key); return file.exists && file.size > 0 ? file.uri : undefined; },
});

async function saveImage(image: Exclude<Parameters<typeof ImageManipulator.manipulate>[0], string> & { width: number; height: number }, key: string) {
  const context = ImageManipulator.manipulate(image);
  let rendered: Awaited<ReturnType<typeof context.renderAsync>> | undefined;
  let temporary: File | undefined;
  try {
    context.resize(thumbnailDimensions(image.width, image.height));
    rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: THUMBNAIL_QUALITY });
    temporary = new File(saved.uri);
    directory().create({ intermediates: true, idempotent: true });
    const destination = fileFor(key);
    // Publish only a complete JPEG. A previous zero-byte/failed write is never treated as a hit.
    if (destination.exists) destination.delete();
    // SDK 57 moves asynchronously: keep the source alive until publishing finishes.
    await temporary.move(destination);
    return destination.uri;
  } finally {
    if (temporary?.exists && temporary.uri !== fileFor(key).uri) temporary.delete();
    rendered?.release(); context.release();
  }
}

export async function getMediaThumbnail(source: ThumbnailSource, cacheKey: readonly (string | number)[], video: boolean, signal: AbortSignal) {
  const local = cacheKey[0] === 'local';
  // Backend JPEGs must not reuse old client-generated server previews.
  const identity = thumbnailIdentity(local ? cacheKey : [...cacheKey, 'pocketbase-thumb-v2']);
  return lookup.get(identity, async () => {
    const key = await digestStringAsync(CryptoDigestAlgorithm.SHA256, identity);
    const enqueue = local ? queues.local : queues.remote;
    return getCached(key, () => enqueue(async () => {
      // Once decoding starts, finish and persist even if the cell scrolls offscreen.
      // The queue still cancels work that hasn't started yet.
      if (local) {
        const generated = await generateDeviceThumbnail(source.uri, String(cacheKey[1]), video, fileFor(key).uri);
        if (generated) return generated;
      }
      if (!local) return downloadServerThumbnail(source, fileFor(key));
      if (video) return generateVideoThumbnail({ ...source, useCaching: false }, new AbortController().signal, (frame) => saveImage(frame, key));
      const image = await Image.loadAsync(source, { maxWidth: 256, maxHeight: 256 });
      try { return await saveImage(image, key); }
      finally { image.release(); }
    }, signal));
  });
}
export const invalidateMediaThumbnail = (uri: string) => lookup.invalidate(uri);
export function deleteMediaThumbnail(uri: string) {
  lookup.invalidate(uri);
  const file = new File(uri);
  // Only remove files from our thumbnail directory.
  if (uri.startsWith(`${directory().uri.replace(/\/$/, '')}/`) && file.exists) file.delete();
}
