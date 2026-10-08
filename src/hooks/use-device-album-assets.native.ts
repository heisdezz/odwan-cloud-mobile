import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deviceAlbumCache } from '@/db/local-store.native';
import { createCachedAlbumLoader } from '@/lib/cached-album-loader';
import { loadDeviceAlbumAssets } from '@/lib/device-albums.native';
import { useGallerySync } from '@/providers/gallery-sync-provider.native';

export function useDeviceAlbumAssets(id: string) {
  const { permission } = useGallerySync();
  const accessScope = permission?.accessPrivileges === 'limited' ? 'limited' : 'all';
  const loader = useMemo(() => createCachedAlbumLoader({
    // Limited selections can change without changing the permission scope label.
    read: () => accessScope === 'limited' ? Promise.resolve(null) : deviceAlbumCache.read(id, accessScope),
    scan: (signal) => loadDeviceAlbumAssets(id, signal),
    save: (assets, signal) => deviceAlbumCache.save(id, accessScope, assets, signal),
  }), [id, accessScope]);
  const query = useQuery({
    queryKey: ['device-albums', 'assets', id, accessScope], queryFn: loader.load,
    staleTime: 30_000, networkMode: 'always', refetchOnWindowFocus: false,
  });
  const { isSuccess, dataUpdatedAt, refetch } = query;
  useEffect(() => {
    if (isSuccess && loader.takeRefresh()) void refetch();
  }, [isSuccess, dataUpdatedAt, loader, refetch]);
  return query;
}
