import { useEffect, useState } from 'react';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { extract_message } from '@/helpers/api';
import tw from '@/lib/tw';

/** Mount only for the active video; the hook releases its native player on unmount. */
export function VideoPlayer({ source }: { source: VideoSource }) {
  const player = useVideoPlayer(null);
  const [loadError, setLoadError] = useState<{ source: VideoSource; message: string }>();
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => {
    let cancelled = false;
    void player.replaceAsync(source).catch((failure) => { if (!cancelled) setLoadError({ source, message: extract_message(failure) }); });
    return () => { cancelled = true; };
  }, [player, source]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state !== 'active') player.pause(); });
    return () => listener.remove();
  }, [player]);
  const message = loadError?.source === source ? loadError.message : error?.message;
  return <View style={tw`w-full aspect-video bg-black justify-center`}>
    <VideoView player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} style={tw`w-full h-full`} />
    {status === 'loading' && <ActivityIndicator accessibilityLabel="Loading video" color="white" pointerEvents="none" style={tw`absolute self-center`} />}
    {message && <Text accessibilityRole="alert" style={tw`absolute bottom-3 left-3 right-3 bg-black/80 p-2 text-white`}>{message}</Text>}
  </View>;
}
