import type { BackupScope, LocalAsset } from '@/db/schema';

export type UploadResult = {
  backend: 'telegram' | 's3'; bucket: string; key: string; etag: string;
  size_bytes: number; hash: string; status: 'success' | 'duplicate'; duplicate: boolean;
  media_id: string; stream_url: string; view_url: string;
};
export type UploadJob = BackupScope & {
  id: string; asset: LocalAsset; albumId: string; albumName: string; objectKey: string;
  state: 'queued' | 'uploading' | 'organizing' | 'success' | 'error';
  result: UploadResult | null; error: string | null; createdAt: number;
};
export type UploadHistoryItem = UploadJob & { completedAt: number };
export type UploadDestination = { id: string; name: string };
export type UploadPhase = { id: string; phase: 'preparing' | 'sending' | 'organizing' } | null;
export type UploadProgress = { loaded: number; total: number | null; percent: number | null };
export class UploadError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}
export class UploadConnectionError extends Error {
  constructor() { super('Connection to the server was lost. The upload will retry automatically.'); }
}
