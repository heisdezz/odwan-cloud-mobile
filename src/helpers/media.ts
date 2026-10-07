import type { MediaItemResponse } from '../../pocketbase-types';

export function mediaName(item: MediaItemResponse): string {
  return item.original_relative_path.split(/[\\/]/).pop() || item.id;
}

export function mediaAspectRatio(metadata?: string): number {
  try {
    const value: unknown = JSON.parse(metadata || '{}');
    if (!value || typeof value !== 'object') return 1;
    const data = value as Record<string, unknown>;
    const width = Number(data.width), height = Number(data.height);
    return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? Math.max(0.5, Math.min(2, width / height)) : 1;
  } catch { return 1; }
}

export function mediaStreamUrl(serverUrl: string, id: string): string {
  return `${serverUrl.replace(/\/+$/, '')}/api/media/${encodeURIComponent(id)}/stream`;
}
