import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Modal from 'react-native-modal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export function AppModal({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: ReactNode;
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  return <Modal isVisible={visible} onBackdropPress={onClose} onBackButtonPress={onClose}
    avoidKeyboard useNativeDriver useNativeDriverForBackdrop hideModalContentWhileAnimating
    animationIn="fadeIn" animationOut="fadeOut" style={tw.style('items-center justify-center', { marginTop: insets.top + 16, marginBottom: insets.bottom + 16 })}>
    <View accessibilityViewIsModal style={tw.style('w-full max-w-md rounded-2xl p-6 gap-5', { backgroundColor: colors.backgroundElement, maxHeight: '90%' })}>
      <Text accessibilityRole="header" style={tw.style('text-xl font-semibold', { color: colors.text })}>{title}</Text>
      <ScrollView style={tw`shrink`} contentContainerStyle={tw`gap-4`}>{children}</ScrollView>
      <Button label="Close" variant="tonal" onPress={onClose} />
    </View>
  </Modal>;
}
