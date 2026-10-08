export type MediaFilter = 'all' | 'videos' | 'images';
export const isMediaFilter = (value: unknown): value is MediaFilter => value === 'all' || value === 'videos' || value === 'images';
export function matchesMediaFilter(type: string, filter: MediaFilter) {
  if (filter === 'all') return true;
  const value = type.toLowerCase();
  return filter === 'videos' ? value === 'video' || value.startsWith('video/')
    : value === 'image' || value === 'photo' || value.startsWith('image/');
}

/** Build once per library snapshot, retaining ordering and the original item objects. */
export function indexMediaFilters<T>(items: T[], mediaType: (item: T) => string): Record<MediaFilter, T[]> {
  const images: T[] = [], videos: T[] = [];
  for (const item of items) {
    const type = mediaType(item);
    if (matchesMediaFilter(type, 'images')) images.push(item);
    else if (matchesMediaFilter(type, 'videos')) videos.push(item);
  }
  return { all: items, images, videos };
}
export const mediaMimePattern = (filter: MediaFilter) => filter === 'all' ? undefined : filter === 'videos' ? 'video/%' : 'image/%';
