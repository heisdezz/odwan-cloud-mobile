import { useEffect, useState } from 'react';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer, type VideoSource } from 'expo-video';
import { ActivityIndicator, AppState, Pressable, Text, View } from 'react-native';
import { extract_message } from '@/helpers/api';
import tw from '@/lib/tw';
import { ViewerButton } from './viewer-button';
import { playbackTime } from '@/helpers/viewer-format';

/** Active and next video only; inactive players stay paused and are released on unmount. */
export function VideoPlayer({ source, active = true, fill = false, controlsVisible = true, onToggleControls, bottomInset = 12 }: {
  source: VideoSource; active?: boolean; fill?: boolean; controlsVisible?: boolean; onToggleControls?: () => void; bottomInset?: number;
}) {
  const player = useVideoPlayer(null, (instance) => {
    instance.bufferOptions = { preferredForwardBufferDuration: 5, maxBufferBytes: 8 * 1024 * 1024 };
    instance.timeUpdateEventInterval = 0.25;
  });
  const [loadError, setLoadError] = useState<{ source: VideoSource; message: string }>();
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const time = useEvent(player, 'timeUpdate');
  const metadata = useEvent(player, 'sourceLoad');
  const currentTime = time?.currentTime ?? player.currentTime;
  const duration = metadata?.duration ?? player.duration;
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [trackWidth, setTrackWidth] = useState(1);
  const [scrub, setScrub] = useState<number | null>(null);
  useEffect(() => {
    // Expo's VideoPlayer is a mutable native SharedObject, not React state.
    // eslint-disable-next-line react-hooks/immutability
    player.muted = muted;
    player.playbackRate = speed;
  }, [player, muted, speed]);
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
  const position = scrub ?? currentTime;
  const percent = duration > 0 ? Math.min(100, Math.max(0, position / duration * 100)) : 0;
  const seek = (seconds: number) => { if (duration > 0) player.seekBy(Math.max(0, Math.min(duration, seconds)) - player.currentTime); };
  const point = (x: number) => Math.max(0, Math.min(duration, x / trackWidth * duration));
  return <View style={tw.style('w-full bg-black justify-center', fill ? 'h-full' : 'aspect-video')}>
    <VideoView player={player} nativeControls={!fill && active} surfaceType="textureView" playsInline contentFit="contain" fullscreenOptions={{ enable: !fill }} style={tw`w-full h-full`} />
    {fill && active && <>
      <Pressable onPress={onToggleControls} accessibilityRole="button" accessibilityLabel="Show or hide playback controls" style={tw`absolute inset-0`} />
      {controlsVisible && !message && <>
        <View style={tw.style('absolute left-4 right-4 flex-row items-center gap-3', { bottom: bottomInset })}>
          <View style={tw`flex-1 bg-black/65 rounded-full px-4 py-1`}>
            <View pointerEvents="none" style={tw`absolute left-4 right-4 top-2 flex-row justify-between`}>
              <Text style={tw`text-white text-xs`}>{playbackTime(position)}</Text>
              <Text style={tw`text-white text-xs`}>{playbackTime(duration)}</Text>
            </View>
          <View accessible accessibilityRole="adjustable" accessibilityLabel="Video position"
            accessibilityValue={{ min: 0, max: duration || 0, now: position, text: `${playbackTime(position)} of ${playbackTime(duration)}` }}
            accessibilityActions={[{ name: 'increment', label: 'Forward 10 seconds' }, { name: 'decrement', label: 'Rewind 10 seconds' }]}
            onAccessibilityAction={({ nativeEvent }) => seek(player.currentTime + (nativeEvent.actionName === 'increment' ? 10 : -10))}
            onLayout={({ nativeEvent }) => setTrackWidth(Math.max(1, nativeEvent.layout.width))}
            onStartShouldSetResponder={() => duration > 0} onMoveShouldSetResponder={() => duration > 0}
            onResponderTerminationRequest={() => false}
            onResponderGrant={({ nativeEvent }) => setScrub(point(nativeEvent.locationX))}
            onResponderMove={({ nativeEvent }) => setScrub(point(nativeEvent.locationX))}
            onResponderRelease={({ nativeEvent }) => { seek(point(nativeEvent.locationX)); setScrub(null); }}
            onResponderTerminate={() => setScrub(null)} style={tw`h-12 justify-end pb-3 pt-5`}>
            <View pointerEvents="none" style={tw`h-1 rounded-full bg-white/30`}>
              <View style={tw.style('h-1 rounded-full bg-white', { width: `${percent}%` })} />
              <View style={tw.style('absolute h-3 w-3 rounded-full bg-white', { left: `${percent}%`, top: -4, marginLeft: -6 })} />
            </View>
          </View>
          </View>
          <ViewerButton label={isPlaying ? 'Pause video' : 'Play video'} prominent disabled={status !== 'readyToPlay'}
            icon={isPlaying ? { ios: 'pause.fill', android: 'pause', web: 'pause' } : { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }}
            onPress={() => { if (isPlaying) player.pause(); else { if (player.currentTime >= duration && duration > 0) seek(0); player.play(); } }} />
        </View>
        <View style={tw.style('absolute right-4 flex-row items-center gap-2', { bottom: bottomInset + 60 })}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Playback speed ${speed}. Change speed`} onPress={() => setSpeed(speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1)}
            style={tw`h-11 min-w-11 rounded-full bg-black/65 items-center justify-center`}><Text style={tw`text-white text-xs font-medium`}>{speed}×</Text></Pressable>
          <ViewerButton label={muted ? 'Unmute video' : 'Mute video'} icon={muted ? { ios: 'speaker.slash', android: 'volume_off', web: 'volume_off' } : { ios: 'speaker.wave.2', android: 'volume_up', web: 'volume_up' }} onPress={() => setMuted(!muted)} />
        </View>
      </>}
    </>}
    {status === 'loading' && <ActivityIndicator accessibilityLabel="Loading video" color="white" pointerEvents="none" style={tw`absolute self-center`} />}
    {message && <View style={tw.style('absolute left-4 right-4 bg-black/80 rounded-xl p-4 gap-3', { bottom: bottomInset })}>
      <Text accessibilityRole="alert" style={tw`text-white`}>{message}</Text>
      {active && <Pressable accessibilityRole="button" accessibilityLabel="Retry video" style={tw`min-h-12 justify-center`} onPress={() => {
        setLoadError(undefined);
        void player.replaceAsync(source).catch((failure) => setLoadError({ source, message: extract_message(failure) }));
      }}><Text style={tw`text-white text-base font-medium`}>Retry</Text></Pressable>}
    </View>}
  </View>;
}
