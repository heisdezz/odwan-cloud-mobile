import type { VideoSource } from 'expo-video';
export type VideoThumbnailProps = { source: VideoSource; cacheKey: readonly (string | number)[]; name: string; local?: boolean; enabled?: boolean };
