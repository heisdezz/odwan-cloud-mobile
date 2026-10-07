import { useState } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import tw from '@/lib/tw';
export type ViewerPhotoProps = { source: ImageSource; width: number; height: number; imageWidth: number; imageHeight: number; active: boolean; onZoomChange: (zoomed: boolean) => void };
export function ViewerPhoto({ source, width, height }: ViewerPhotoProps) {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  return <View style={tw.style('justify-center items-center', { width, height })}>
    {failed ? <Pressable accessibilityRole="button" onPress={() => { setFailed(false); setLoading(true); setRetry((value) => value + 1); }} style={tw`px-6 py-4`}><Text accessibilityRole="alert" style={tw`text-white text-center`}>Image unavailable. Tap to retry.</Text></Pressable>
      : <Image key={retry} source={source} contentFit="contain" cachePolicy="memory" style={tw`w-full h-full`} onLoad={() => setLoading(false)} onError={() => { setFailed(true); setLoading(false); }} />}
    {loading && !failed && <ActivityIndicator color="white" pointerEvents="none" style={tw`absolute self-center`} />}
  </View>;
}
