export type MediaThumbnailProps = {
  source: { uri: string; headers?: Record<string, string> };
  cacheKey: readonly (string | number)[];
  name: string; video?: boolean; local?: boolean; enabled?: boolean;
};
