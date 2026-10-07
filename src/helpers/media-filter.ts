export type MediaFilter = 'all' | 'videos' | 'images';
export const isMediaFilter = (value: unknown): value is MediaFilter => value === 'all' || value === 'videos' || value === 'images';
export function matchesMediaFilter(type: string, filter: MediaFilter) {
  if (filter === 'all') return true;
  const value = type.toLowerCase();
  return filter === 'videos' ? value === 'video' || value.startsWith('video/')
    : value === 'image' || value === 'photo' || value.startsWith('image/');
}
export const mediaMimePattern = (filter: MediaFilter) => filter === 'all' ? undefined : filter === 'videos' ? 'video/%' : 'image/%';
