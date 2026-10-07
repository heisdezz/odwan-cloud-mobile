import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pressable, Text, View } from 'react-native';
import LocalMediaAccess from './LocalMediaAccess.native';
import PageLoader from '@/components/layouts/PageLoader';
import { MediaTypeFilter } from '@/components/media/media-filter';
import { matchesMediaFilter } from '@/helpers/media-filter';
import { useGridStore } from '@/stores/grid-store';
import { GridZoom } from '@/components/media/grid-zoom';
import { MediaThumbnail } from '@/components/media/media-thumbnail';
import { MediaTileBadges } from '@/components/media/media-tile-badges';
import { Button } from '@/components/ui';
import { extract_message } from '@/helpers/api';
import { localViewerItem } from '@/helpers/media-viewer';
import { useTheme } from '@/hooks/use-theme';
import { loadDeviceAlbumAssets } from '@/lib/device-albums.native';
import tw from '@/lib/tw';
import { useMediaViewer } from '@/providers/media-viewer-provider';

function AlbumContent({ id }: { id: string }) {
  const colors = useTheme();
  const viewer = useMediaViewer();
  const query = useQuery({ queryKey: ['device-albums', 'assets', id],
    queryFn: ({ signal }) => loadDeviceAlbumAssets(id, signal),
    staleTime: Infinity, networkMode: 'always', refetchOnWindowFocus: false,
  });
  const mediaFilter = useGridStore((state) => state.mediaFilter);
  const assets = useMemo(() => (query.data ?? []).filter((asset) => matchesMediaFilter(asset.mediaType, mediaFilter)), [query.data, mediaFilter]);
  return <View style={tw`flex-1`}><MediaTypeFilter refreshing={query.isFetching} onRefresh={() => { void query.refetch(); }} />
    <PageLoader query={query}>{() => <GridZoom key={mediaFilter} data={assets}
    keyExtractor={(asset) => asset.id}
    renderItem={({ item, size, previewEnabled }) => <Pressable
      accessibilityRole="button" accessibilityLabel={`${item.mediaType === 'video' ? 'Video' : 'Photo'}: ${item.filename}`}
      onPress={() => viewer.open({ items: assets.map(localViewerItem), selectedId: item.id })}
      style={tw.style('m-0.5 overflow-hidden', { width: size - 4, height: size - 4, backgroundColor: colors.backgroundElement })}>
      <MediaThumbnail source={{ uri: item.uri }} cacheKey={['local', item.id, item.modifiedAt]}
        name={item.filename} local video={item.mediaType === 'video'} enabled={previewEnabled} />
      <MediaTileBadges video={item.mediaType === 'video'} />
    </Pressable>}
    contentInsets={{ bottom: 24 }}
    ListEmptyComponent={<Text style={tw.style('px-6 py-16 text-base text-center', { color: colors.textSecondary })}>{mediaFilter === 'all' ? 'No accessible photos or videos in this album.' : `No ${mediaFilter} in this album.`}</Text>}
    ListFooterComponent={query.error ? <View style={tw`px-6 py-4 gap-3`}>
      <Text accessibilityRole="alert" style={tw.style('text-base', { color: colors.text })}>{extract_message(query.error)}</Text>
      <Button label="Retry" loading={query.isFetching} onPress={() => { void query.refetch(); }} />
    </View> : null}
  />}</PageLoader></View>;
}

export default function LocalAlbumGallery({ id }: { id: string }) {
  return <LocalMediaAccess><AlbumContent id={id} /></LocalMediaAccess>;
}
