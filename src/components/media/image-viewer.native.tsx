import { useState } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { Modal, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ResumableZoom, fitContainer } from 'react-native-zoom-toolkit';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import tw from '@/lib/tw';

export type ImageViewerProps = { source: ImageSource | number; onClose: () => void };
export function ImageViewer({ source, onClose }: ImageViewerProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [resolution, setResolution] = useState({ width: 1, height: 1 });
  const [failed, setFailed] = useState(false);
  const size = fitContainer(resolution.width / resolution.height, { width, height: Math.max(1, height - insets.top - insets.bottom - 100) });
  return <Modal visible animationType="fade" onRequestClose={onClose} hardwareAccelerated>
    <GestureHandlerRootView style={tw`flex-1 bg-black`}>
      <View style={tw`flex-1 justify-center items-center`}>
        {failed ? <Text accessibilityRole="alert" style={tw`text-white px-6`}>Image unavailable. Close and try again.</Text> : <ResumableZoom maxScale={5}>
          <Image source={source} contentFit="contain" cachePolicy="memory" style={tw.style(size)}
            onLoad={({ source: loaded }) => setResolution({ width: loaded.width || 1, height: loaded.height || 1 })}
            onError={() => setFailed(true)} />
        </ResumableZoom>}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Close image viewer" onPress={onClose}
        style={tw.style('absolute right-4 rounded-full bg-black/80 px-5 py-3', { top: insets.top + 8 })}>
        <Text style={tw`text-white text-base`}>Close</Text>
      </Pressable>
    </GestureHandlerRootView>
  </Modal>;
}
