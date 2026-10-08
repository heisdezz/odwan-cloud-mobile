import PocketBase from 'pocketbase';
import { extract_message } from '@/helpers/api';
import { UploadConnectionError, UploadError, type UploadResult, type UploadDestination } from './upload-types';

export async function resolveUploadAlbum(client: PocketBase, name: string, signal?: AbortSignal): Promise<UploadDestination> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Choose an album name first.');
  const find = async () => {
    const albums = await client.collection('album').getFullList<{ id: string; name: string }>({
      fields: 'id,name', signal, requestKey: null,
    });
    return albums.find((album) => album.name.trim().toLowerCase() === trimmed.toLowerCase());
  };
  const existing = await find();
  if (existing) return existing;
  try {
    return await client.collection('album').create<UploadDestination>({ name: trimmed, relative_path: trimmed }, { signal, requestKey: null });
  } catch (error) {
    // Another client may have created the same case-insensitive name meanwhile.
    const raced = await find();
    if (raced) return raced;
    throw error;
  }
}

export function validateUploadResult(value: unknown): UploadResult {
  const result = value as Partial<UploadResult> | null;
  if (!result || !['success', 'duplicate'].includes(result.status ?? '') ||
    !result.media_id || !/^[a-f\d]{64}$/i.test(result.hash ?? '') ||
    !['s3', 'telegram'].includes(result.backend ?? '') || !result.bucket || !result.key) {
    throw new UploadError('The server did not confirm the stored file. Retry this item.', 502);
  }
  return result as UploadResult;
}

export async function sendUpload(options: {
  serverUrl: string; testToken: string; objectKey: string; body: FormData; signal: AbortSignal;
}, request: typeof fetch = fetch): Promise<UploadResult> {
  const url = `${options.serverUrl}/api/test/s3/upload?${new URLSearchParams({ key: options.objectKey })}`;
  let response: Response;
  try {
    response = await request(url, { method: 'POST', headers: { 'X-S3-Test-Token': options.testToken }, body: options.body, signal: options.signal });
  } catch (error) {
    if (options.signal.aborted) throw error;
    throw new UploadConnectionError();
  }
  let body: unknown;
  try { body = await response.json(); } catch { throw new UploadError(`Upload failed (HTTP ${response.status}).`, response.status); }
  if (!response.ok) {
    const error = body as { error?: unknown };
    throw new UploadError(typeof error?.error === 'string' ? error.error : extract_message(body), response.status);
  }
  return validateUploadResult(body);
}
