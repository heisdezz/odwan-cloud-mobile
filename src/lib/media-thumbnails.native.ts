import { thumbnailEvictions, type ThumbnailEntry } from '@/helpers/thumbnail-eviction';
import { useThumbnailPreferences } from '@/stores/thumbnail-preferences-store';
import { preferencesStorage } from './preferences-storage';
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
import { refreshThumbnailCache } from '@/stores/thumbnail-cache-store';

const directory = () => new Directory(Paths.document, 'media-thumbnails-v1');
const fileFor = (key: string) => new File(directory(), `${key}.jpg`);
const leases = new Map<string, number>();
const recent = new Map<string, number>();
const accessKey = (uri: string) => `thumbnail-access:${uri.slice(uri.lastIndexOf('/') + 1)}`;
let trimTimer: ReturnType<typeof setTimeout> | undefined;
let trimming: Promise<void> | undefined;
function touchThumbnail(uri: string) {
  const previous = recent.get(uri) ?? 0;
  const now = Date.now();
  recent.set(uri, now);
  if (now - previous < 30_000) return;
  // Optional recency metadata must never make a valid thumbnail fail to load.
  try { void Promise.resolve(preferencesStorage.setItem(accessKey(uri), String(now))).catch(() => {}); } catch {}
}
export function retainMediaThumbnail(uri: string) {
  leases.set(uri, (leases.get(uri) ?? 0) + 1);
  touchThumbnail(uri);
  return () => {
    const count = (leases.get(uri) ?? 1) - 1;
    if (count) leases.set(uri, count); else leases.delete(uri);
    scheduleTrim();
  };
}
function scheduleTrim() {
  if (trimTimer) return;
  trimTimer = setTimeout(() => { trimTimer = undefined; void trimThumbnailStorage().catch(() => {}); }, 30_000);
}
useThumbnailPreferences.subscribe(scheduleTrim);

const queues = createThumbnailQueues();
queues.setBusy(galleryInteraction.isBusy());
galleryInteraction.subscribe(() => queues.setBusy(galleryInteraction.isBusy()));
const lookup = createThumbnailLookup();
const getCached = createPersistentThumbnailCache({
  read: async (key) => { const file = fileFor(key); if (file.exists && file.size > 0) { touchThumbnail(file.uri); return file.uri; } return undefined; },
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
  const thumbnail = await lookup.get(identity, async () => {
    const key = await digestStringAsync(CryptoDigestAlgorithm.SHA256, identity);
    const enqueue = local ? queues.local : queues.remote;
    const uri = fileFor(key).uri;
    leases.set(uri, (leases.get(uri) ?? 0) + 1);
    try {
      const result = await getCached(key, () => enqueue(async () => {
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
      touchThumbnail(result); scheduleTrim();
      return result;
    } finally {
      const count = (leases.get(uri) ?? 1) - 1;
      if (count) leases.set(uri, count); else leases.delete(uri);
    }
  });
  touchThumbnail(thumbnail); scheduleTrim();
  return thumbnail;
}
export const invalidateMediaThumbnail = (uri: string) => lookup.invalidate(uri);
export function deleteMediaThumbnail(uri: string) {
  lookup.invalidate(uri);
  const file = new File(uri);
  // Only remove files from our thumbnail directory.
  if (uri.startsWith(`${directory().uri.replace(/\/$/, '')}/`) && file.exists) file.delete();
}

async function storedAccessTime(uri: string) {
  try { return Number(await preferencesStorage.getItem(accessKey(uri))) || 0; } catch { return 0; }
}
async function thumbnailEntries() {
  const folder = directory();
  const entries: ThumbnailEntry[] = [];
  if (!folder.exists) return entries;
  const signal = new AbortController().signal;
  await galleryInteraction.wait(signal);
  const files = folder.list();
  for (let index = 0; index < files.length; index++) {
    if (index % 25 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
      await galleryInteraction.wait(signal);
    }
    const file = files[index];
    if (file instanceof File && file.name.endsWith('.jpg') && file.exists) entries.push({
      uri: file.uri, bytes: file.size ?? 0,
      accessedAt: recent.get(file.uri) ?? (await storedAccessTime(file.uri) || file.lastModified || 0),
    });
  }
  return entries;
}
export async function readThumbnailStorage() {
  const files = await thumbnailEntries();
  return { bytes: files.reduce((sum, file) => sum + file.bytes, 0), files: files.length, supported: true };
}

export function trimThumbnailStorage(): Promise<void> {
  if (trimming) return trimming;
  trimming = (async () => {
    const entries = await thumbnailEntries();
    const protectedUris = new Set(leases.keys());
    for (const [uri, timestamp] of recent) {
      if (Date.now() - timestamp < 60_000) protectedUris.add(uri);
      else recent.delete(uri);
    }
    const remove = thumbnailEvictions(entries, useThumbnailPreferences.getState().limitMB * 1024 * 1024, protectedUris);
    for (let index = 0; index < remove.length; index++) {
      if (index % 25 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
        await galleryInteraction.wait(new AbortController().signal);
      }
      const uri = remove[index];
      // Recheck after yielding: a cell or generator may have acquired this file.
      if (leases.has(uri) || Date.now() - (recent.get(uri) ?? 0) < 60_000) continue;
      const file = new File(uri);
      if (file.exists) file.delete();
      lookup.invalidate(uri); recent.delete(uri);
      await preferencesStorage.removeItem(accessKey(uri));
    }
    if (recent.size && entries.reduce((sum, entry) => sum + entry.bytes, 0) > useThumbnailPreferences.getState().limitMB * 1024 * 1024) scheduleTrim();
  })().finally(() => { trimming = undefined; });
  return trimming;
}

export async function clearThumbnailStorage() {
  const token = {};
  galleryInteraction.setBusy(token, true);
  try {
    await Promise.all([queues.local.whenIdle(), queues.remote.whenIdle()]);
    lookup.clear(); recent.clear();
    const folder = directory();
    if (folder.exists) {
      let processed = 0;
      for (const file of folder.list()) {
        if (file instanceof File && file.name.endsWith('.jpg') && file.exists) { file.delete(); await preferencesStorage.removeItem(accessKey(file.uri)); }
        if (++processed % 50 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }
    refreshThumbnailCache();
  } finally { galleryInteraction.release(token); }
}
