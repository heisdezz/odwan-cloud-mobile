import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Platform, Text, View } from 'react-native';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { pb } from '@/client/pb';
import { mediaStreamUrl } from '@/helpers/media';
import type { ViewerItem, ViewerScope } from '@/helpers/media-viewer';
import { VideoPlayer } from './video-player';
import { ViewerPhoto } from './viewer-photo';
import tw from '@/lib/tw';

export function ViewerPage({ item, scope, width, height, active, nearby, preload, onZoomChange }: {
  item: ViewerItem; scope?: ViewerScope; width: number; height: number;
  active: boolean; nearby: boolean; preload: boolean; onZoomChange: (value: boolean) => void;
}) {
  // Browser video elements cannot send Authorization headers. Request a short-lived file token.
  const fileToken = useQuery({ queryKey: ['viewer-file-token', scope?.serverUrl, scope?.accountId, scope?.revision],
    enabled: Platform.OS === 'web' && item.video && !!scope && (active || preload), staleTime: 60_000, gcTime: 0, retry: false,
    queryFn: async ({ signal }) => {
      const client = new PocketBase(scope!.serverUrl, new BaseAuthStore());
      client.authStore.save(pb.authStore.token, pb.authStore.record);
      return client.files.getToken({ signal, requestKey: null });
    },
  });
  const source = useMemo(() => {
    if (item.kind === 'local') return { uri: item.uri };
    const uri = mediaStreamUrl(scope!.serverUrl, item.id);
    return { uri: Platform.OS === 'web' && item.video && fileToken.data ? `${uri}?token=${encodeURIComponent(fileToken.data)}` : uri,
      headers: { Authorization: pb.authStore.token }, useCaching: false };
  }, [item, scope, fileToken.data]);
  const videoReady = Platform.OS !== 'web' || !scope || !!fileToken.data;
  return <View style={tw.style('bg-black justify-center items-center', { width, height })}>
    {!item.available ? <Text style={tw`text-white text-base px-6 text-center`}>This upload is not ready for playback yet.</Text>
      : item.video ? (active || preload) && videoReady ? <VideoPlayer source={source} active={active} fill />
      : <Text style={tw`text-white/70 px-6 text-center`}>{fileToken.isError ? 'Could not authorize this video. Close and try again.' : active ? 'Loading video…' : 'Video'}</Text>
      : nearby ? <ViewerPhoto key={active ? 'active' : 'preview'} source={source} width={width} height={height} imageWidth={item.width} imageHeight={item.height} active={active} onZoomChange={onZoomChange} /> : null}
  </View>;
}
