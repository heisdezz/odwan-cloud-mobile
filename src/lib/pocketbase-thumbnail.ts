import PocketBase, { BaseAuthStore } from 'pocketbase';
import type { MediaItemResponse } from '../../pocketbase-types';
import { mediaThumbnailUrl } from '../helpers/media';

export type ThumbnailSource = {
  uri: string;
  headers?: Record<string, string>;
  fileAuth?: { serverUrl: string; authToken: string };
};

export function pocketbaseThumbnailSource(serverUrl: string, record: MediaItemResponse, authToken: string): ThumbnailSource {
  const filename = record.thumbs;
  if (!filename) return { uri: mediaThumbnailUrl(serverUrl, record.id), headers: { Authorization: authToken } };
  const client = new PocketBase(serverUrl, new BaseAuthStore());
  return {
    uri: client.files.getURL({ ...record, collectionName: record.collectionName || 'media_item' }, filename),
    fileAuth: { serverUrl, authToken },
  };
}

/** One short-lived in-memory token per active session, shared across thumbnail requests. */
export function createThumbnailFileTokenCache(
  requestToken: (serverUrl: string, authToken: string, signal: AbortSignal) => Promise<string>,
  now: () => number = Date.now,
) {
  let entry: { serverUrl: string; authToken: string; expires: number; promise: Promise<string> } | undefined;
  return async (source: ThumbnailSource, signal: AbortSignal): Promise<ThumbnailSource> => {
    if (!source.fileAuth) return source;
    const { serverUrl, authToken } = source.fileAuth;
    if (!entry || entry.serverUrl !== serverUrl || entry.authToken !== authToken || entry.expires <= now()) {
      const next = { serverUrl, authToken, expires: now() + 60_000, promise: requestToken(serverUrl, authToken, signal) };
      entry = next;
      void next.promise.catch(() => { if (entry === next) entry = undefined; });
    }
    const token = await entry.promise;
    if (signal.aborted) throw new Error('Server preview cancelled.');
    const separator = source.uri.includes('?') ? '&' : '?';
    return { uri: `${source.uri}${separator}token=${encodeURIComponent(token)}` };
  };
}

export const authorizeThumbnailSource = createThumbnailFileTokenCache(async (serverUrl, authToken, signal) => {
  const client = new PocketBase(serverUrl, new BaseAuthStore());
  client.authStore.save(authToken);
  return client.files.getToken({ signal, requestKey: null });
});
