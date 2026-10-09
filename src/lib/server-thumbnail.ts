import { authorizeThumbnailSource, type ThumbnailSource } from './pocketbase-thumbnail';

export class ServerThumbnailError extends Error {
  constructor(message: string, public status: number, public retryAfter: number | null = null) { super(message); }
}

/** Fetch only the backend JPEG. Never fall back to an original or a device decoder. */
export async function fetchServerThumbnail(source: ThumbnailSource, signal: AbortSignal,
  progress: (written: number, total: number) => void = () => {}, request: typeof fetch = fetch): Promise<Uint8Array> {
  const authorized = await authorizeThumbnailSource(source, signal);
  const response = await request(authorized.uri, { headers: authorized.headers, signal });
  if (!response.ok) {
    const seconds = Number(response.headers.get('Retry-After'));
    const retryAfter = Number.isFinite(seconds) && seconds > 0 ? seconds : null;
    await response.body?.cancel?.().catch(() => {});
    throw new ServerThumbnailError(response.status === 503 ? 'Server preview is temporarily unavailable. Retry shortly.'
      : `Could not load server preview (HTTP ${response.status}).`, response.status, retryAfter);
  }
  if (!response.headers.get('Content-Type')?.toLowerCase().startsWith('image/jpeg')) {
    await response.body?.cancel?.().catch(() => {});
    throw new ServerThumbnailError('The server did not return a JPEG preview.', 502);
  }
  const total = Number(response.headers.get('Content-Length')) || -1;
  const maxBytes = 1024 * 1024;
  progress(0, total);
  if (total > maxBytes) {
    await response.body?.cancel?.().catch(() => {});
    throw new ServerThumbnailError('Server preview exceeds the 1 MiB limit.', 502);
  }
  let bytes: Uint8Array;
  const reader = response.body?.getReader?.();
  if (reader) {
    const chunks: Uint8Array[] = []; let size = 0;
    try {
      for (;;) {
        if (signal.aborted) throw new Error('Server preview cancelled.');
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength; progress(size, total);
        if (size > maxBytes) throw new ServerThumbnailError('Server preview exceeds the 1 MiB limit.', 502);
        chunks.push(part.value);
      }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    finally { reader.releaseLock(); }
    bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  } else {
    bytes = new Uint8Array(await response.arrayBuffer()); progress(bytes.byteLength, total);
    if (bytes.byteLength > maxBytes) throw new ServerThumbnailError('Server preview exceeds the 1 MiB limit.', 502);
  }
  if (signal.aborted) throw new Error('Server preview cancelled.');
  if (bytes.length < 3 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
    throw new ServerThumbnailError('The server returned an invalid JPEG preview.', 502);
  return bytes;
}

export const retryServerThumbnail = (count: number, error: unknown) => count < 3 && error instanceof ServerThumbnailError
  && error.status === 503 && error.retryAfter !== null && error.retryAfter <= 5;
export const serverThumbnailRetryDelay = (_count: number, error: unknown) =>
  (error instanceof ServerThumbnailError ? error.retryAfter ?? 2 : 2) * 1000;
