import { refreshThumbnailCache } from '@/stores/thumbnail-cache-store';
export async function readThumbnailStorage() { return { bytes: 0, files: 0, supported: false }; }
export async function clearThumbnailStorage() { refreshThumbnailCache(); }

export async function trimThumbnailStorage() {}
