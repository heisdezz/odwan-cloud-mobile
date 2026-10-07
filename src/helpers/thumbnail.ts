export const THUMBNAIL_SIZE = 256;
export const THUMBNAIL_QUALITY = 0.4;
export function thumbnailDimensions(width: number, height: number) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Invalid thumbnail dimensions.');
  const scale = Math.min(1, THUMBNAIL_SIZE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
// Tokens and connection revisions must not be included: unchanged media reuses its file after a restart/login.
export function thumbnailIdentity(key: readonly (string | number)[]) {
  return JSON.stringify(['jpeg-v1', THUMBNAIL_SIZE, THUMBNAIL_QUALITY, ...key]);
}
