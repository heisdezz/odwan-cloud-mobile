import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import type { PropsWithChildren } from 'react';
import { Modal, Platform, Pressable, View, useWindowDimensions } from 'react-native';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
export type UploadSheetProps = PropsWithChildren<{ onClose: () => void }>;

export default function UploadSheet({ children, onClose }: UploadSheetProps) {
  const colors = useTheme();
  const { height } = useWindowDimensions();
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={tw`flex-1 justify-end bg-black/60`}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close upload sheet" onPress={onClose} style={tw`absolute inset-0`} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={tw.style('rounded-t-3xl overflow-hidden', { height: height * 0.8, backgroundColor: colors.background })}>
        {children}
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}
