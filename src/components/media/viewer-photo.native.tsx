import { useEffect, useRef, useState } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { ResumableZoom, fitContainer, type ResumableZoomRefType } from 'react-native-zoom-toolkit';
import tw from '@/lib/tw';
export type ViewerPhotoProps = { source: ImageSource; width: number; height: number; imageWidth: number; imageHeight: number; active: boolean; onZoomChange: (zoomed: boolean) => void };
export function ViewerPhoto({ source, width, height, imageWidth, imageHeight, active, onZoomChange }: ViewerPhotoProps) {
  const zoom = useRef<ResumableZoomRefType>(null);
  const [resolution, setResolution] = useState({ width: imageWidth || 1, height: imageHeight || 1 });
  const [zoomed, setZoomed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const size = fitContainer(resolution.width / resolution.height, { width, height });
  useEffect(() => { if (!active) { zoom.current?.reset(false); } }, [active]);
  const syncZoom = () => {
    const value = (zoom.current?.getState().scale ?? 1) > 1.01;
    setZoomed(value);
    if (active) onZoomChange(value);
  };
  return <View style={tw.style('items-center justify-center', { width, height })}>
    {failed ? <View style={tw`px-6 gap-4 items-center`}>
      <Text accessibilityRole="alert" style={tw`text-white text-base text-center`}>This image could not be loaded.</Text>
      <Pressable accessibilityRole="button" onPress={() => { setFailed(false); setLoading(true); setRetry((value) => value + 1); }} style={tw`min-h-12 justify-center rounded-full px-6 bg-white/15`}><Text style={tw`text-white text-base`}>Retry</Text></Pressable>
    </View> : <ResumableZoom ref={zoom} maxScale={5} panEnabled={active && zoomed} pinchEnabled={active} tapsEnabled={active}
      onPinchStart={() => { if (active) onZoomChange(true); }} onDoubleTapStart={() => { if (active) onZoomChange(true); }} onGestureEnd={syncZoom}>
      <Image key={retry} source={source} style={tw.style(size)} contentFit="contain" cachePolicy="memory" transition={0}
        onLoad={({ source: loaded }) => { setResolution({ width: loaded.width || 1, height: loaded.height || 1 }); setLoading(false); }}
        onError={() => { setFailed(true); setLoading(false); if (active) onZoomChange(false); }} />
    </ResumableZoom>}
    {loading && !failed && <ActivityIndicator color="white" accessibilityLabel="Loading image" pointerEvents="none" style={tw`absolute self-center`} />}
  </View>;
}
