import { File } from 'expo-file-system';
import { loadDeviceMediaByIds, resolveDeviceMediaUri } from './device-media.native';
import { sendUploadWithProgress } from './upload-request';
import { UploadError, type UploadJob, type UploadProgress } from './upload-types';

export async function uploadDeviceFile(job: UploadJob, token: string, signal: AbortSignal, sending: () => void, onProgress: (progress: UploadProgress) => void) {
  const [current] = await loadDeviceMediaByIds([job.asset.id]);
  if (!current || current.modifiedAt !== job.asset.modifiedAt)
    throw new UploadError('This item changed or was removed. Select the current item again.', 400);
  const uri = await resolveDeviceMediaUri(job.asset.id, job.asset.uri);
  if (signal.aborted) throw new Error('Upload paused.');
  const file = new File(uri);
  if (!file.exists || file.size <= 0) throw new UploadError('This file is not available on the device. Download its original and retry.', 400);
  // Reserve multipart overhead below the backend's 256 MiB request limit.
  if (file.size > 255 * 1024 * 1024) throw new UploadError('This file exceeds the 255 MiB upload limit.', 413);
  const body = new FormData();
  // RN accepts URI descriptors and streams them natively, avoiding a whole-file JS blob.
  body.append('file', { uri, name: job.asset.filename, type: file.type || 'application/octet-stream' } as unknown as Blob);
  sending();
  return sendUploadWithProgress({ serverUrl: job.serverUrl, testToken: token, objectKey: job.objectKey, body, signal, onProgress });
}
