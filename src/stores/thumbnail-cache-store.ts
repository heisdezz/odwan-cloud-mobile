import { create } from 'zustand';
export const useThumbnailCacheStore = create(() => ({ epoch: 0 }));
export const refreshThumbnailCache = () => useThumbnailCacheStore.setState((state) => ({ epoch: state.epoch + 1 }));
