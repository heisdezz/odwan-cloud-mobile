import type { ThumbnailSource } from '@/lib/pocketbase-thumbnail';
export type MediaThumbnailProps = {
  source: ThumbnailSource;
  cacheKey: readonly (string | number)[];
  name: string; video?: boolean; local?: boolean; enabled?: boolean;
};
