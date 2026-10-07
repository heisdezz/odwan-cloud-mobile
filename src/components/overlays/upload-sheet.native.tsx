/* eslint-disable @typescript-eslint/no-require-imports -- Expo Go does not contain this Fabric component. */
import { useState } from 'react';
import { UIManager, View, useWindowDimensions } from 'react-native';
import type { ModalBottomSheet } from '@swmansion/react-native-bottom-sheet';
import FallbackSheet, { type UploadSheetProps } from './upload-sheet-fallback';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

const Sheet: typeof ModalBottomSheet | null = UIManager.getViewManagerConfig('BottomSheetView')
  ? require('@swmansion/react-native-bottom-sheet').ModalBottomSheet : null;

export default function UploadSheet({ children, onClose }: UploadSheetProps) {
  const colors = useTheme();
  const { height } = useWindowDimensions();
  const [index, setIndex] = useState(1);
  if (!Sheet) return <FallbackSheet onClose={onClose}>{children}</FallbackSheet>;
  return <Sheet nativeOverlay index={index} detents={[0, height * 0.8]}
    onIndexChange={setIndex} onSettle={(next) => { if (next === 0) onClose(); }}
    surface={<View style={tw.style('absolute inset-0 rounded-t-3xl', { backgroundColor: colors.background })} />}>
    <View style={tw.style('overflow-hidden', { height: height * 0.8 })}>{children}</View>
  </Sheet>;
}
