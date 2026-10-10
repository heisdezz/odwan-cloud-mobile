import { useState } from 'react';
import { Text, View } from 'react-native';
import type { VideoSource } from 'expo-video';
import { Button, Input } from '@/components/ui';
import { ImageViewer } from '@/components/media/image-viewer';
import { VideoPlayer } from '@/components/media/video-player';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import { AppModal } from './app-modal';

export function OverlayPreview() {
  const colors = useTheme();
  const [modal, setModal] = useState(false);
  const [image, setImage] = useState(false);
  const [videoUrl, setVideoUrl] = useState('');
  const [source, setSource] = useState<VideoSource>(null);
  const [error, setError] = useState<string>();
  function previewVideo() {
    try {
      const url = new URL(videoUrl.trim());
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Use an HTTP or HTTPS video URL.');
      setError(undefined);
      setSource({ uri: url.toString(), useCaching: false });
    } catch { setError('Enter a valid HTTP or HTTPS video URL.'); }
  }
  return <View style={tw`gap-8 pt-8`}>
    <View style={tw`gap-4`}>
      <Text accessibilityRole="header" style={tw.style('text-2xl font-semibold', { color: colors.text })}>Media and modals</Text>
      <Button label="Open modal example" variant="tonal" onPress={() => setModal(true)} />
      <Button label="Open zoomable sample image" variant="outlined" onPress={() => setImage(true)} />
      <Input label="Video URL" value={videoUrl} onChangeText={setVideoUrl} placeholder="https://server/video.mp4" error={error}
        helperText="Test a direct video URL. Use native controls to start playback." />
      <Button label="Preview video" disabled={!videoUrl.trim()} onPress={previewVideo} />
      {source && <><VideoPlayer source={source} /><Button label="Close video" variant="text" onPress={() => setSource(null)} /></>}
    </View>
    <AppModal visible={modal} title="Modal example" onClose={() => setModal(false)}>
      <Text style={tw.style('text-base', { color: colors.textSecondary })}>Tap outside, press Android Back, or use Close to dismiss. The content follows your selected theme.</Text>
    </AppModal>
    {image && <ImageViewer source={require('@/assets/images/tutorial-web.png')} onClose={() => setImage(false)} />}
  </View>;
}
