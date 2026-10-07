import { useEffect, useState } from 'react';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';
import { extract_message } from '@/helpers/api';
import tw from '@/lib/tw';

/** Active and next video only; inactive players stay paused and are released on unmount. */
export function VideoPlayer({ source, active = true, fill = false }: { source: VideoSource; active?: boolean; fill?: boolean }) {
  const player = useVideoPlayer(null, (instance) => {
    instance.bufferOptions = { preferredForwardBufferDuration: 5, maxBufferBytes: 8 * 1024 * 1024 };
  });
  const [loadError, setLoadError] = useState<{ source: VideoSource; message: string }>();
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  useEffect(() => {
    let cancelled = false;
    void player.replaceAsync(source).catch((failure) => { if (!cancelled) setLoadError({ source, message: extract_message(failure) }); });
    return () => { cancelled = true; };
  }, [player, source]);
  useEffect(() => { if (!active) player.pause(); }, [active, player]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => { if (state !== 'active') player.pause(); });
    return () => listener.remove();
  }, [player]);
  const message = loadError?.source === source ? loadError.message : error?.message;
  return <View style={tw.style('w-full bg-black justify-center', fill ? 'h-full' : 'aspect-video')}>
    <VideoView player={player} nativeControls={active} surfaceType="textureView" playsInline contentFit="contain" fullscreenOptions={{ enable: true }} style={tw`w-full h-full`} />
    {status === 'loading' && <ActivityIndicator accessibilityLabel="Loading video" color="white" pointerEvents="none" style={tw`absolute self-center`} />}
    {message && <View style={tw`absolute bottom-3 left-3 right-3 bg-black/80 p-3 gap-2`}>
      <Text accessibilityRole="alert" style={tw`text-white`}>{message}</Text>
      {active && <Pressable accessibilityRole="button" accessibilityLabel="Retry video" style={tw`min-h-12 justify-center`} onPress={() => {
        setLoadError(undefined);
        void player.replaceAsync(source).catch((failure) => setLoadError({ source, message: extract_message(failure) }));
      }}><Text style={tw`text-white text-base font-medium`}>Retry</Text></Pressable>}
    </View>}
  </View>;
}
