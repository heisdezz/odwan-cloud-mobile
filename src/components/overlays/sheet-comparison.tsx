import { useEffect, useRef } from 'react';
import { BackHandler, Text, View } from 'react-native';
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import ActionSheet, { type ActionSheetRef } from 'react-native-actions-sheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export function SheetComparison() {
  const gorhom = useRef<BottomSheetModal>(null);
  const action = useRef<ActionSheetRef>(null);
  const isOpen = useRef(false);
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!isOpen.current) return false;
      gorhom.current?.dismiss();
      return true;
    });
    return () => listener.remove();
  }, []);
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const text = tw.style('text-base', { color: colors.textSecondary });
  return <View style={tw`gap-4`}>
    <Text accessibilityRole="header" style={tw.style('text-2xl font-semibold', { color: colors.text })}>Compare bottom sheets</Text>
    <Text style={text}>Try dragging, dismissing, and Android Back in each sheet. Gorhom also includes a keyboard test.</Text>
    <Button label="Open Gorhom Bottom Sheet" variant="tonal" onPress={() => gorhom.current?.present()} />
    <Button label="Open Actions Sheet" variant="outlined" onPress={() => action.current?.show()} />
    <BottomSheetModal ref={gorhom} onChange={(index) => { isOpen.current = index >= 0; }} onDismiss={() => { isOpen.current = false; }} enablePanDownToClose keyboardBehavior="interactive" android_keyboardInputMode="adjustResize"
      backgroundStyle={tw.style({ backgroundColor: colors.backgroundElement })}
      handleIndicatorStyle={tw.style({ backgroundColor: colors.textSecondary })}
      backdropComponent={(props) => <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />}>
      <BottomSheetView style={tw.style('px-6 pt-3 gap-4', { paddingBottom: insets.bottom + 24 })}>
        <Text accessibilityRole="header" style={tw.style('text-xl font-semibold', { color: colors.text })}>Gorhom Bottom Sheet</Text>
        <Text style={text}>Drag the handle or tap outside to dismiss. Type below to test keyboard movement.</Text>
        <BottomSheetTextInput accessibilityLabel="Sheet keyboard test" placeholder="Type to test the keyboard" placeholderTextColor={colors.textSecondary}
          style={tw.style('rounded-xl p-4 text-base', { color: colors.text, backgroundColor: colors.background })} />
        <Button label="Close sheet" onPress={() => gorhom.current?.dismiss()} />
      </BottomSheetView>
    </BottomSheetModal>
    <ActionSheet ref={action} gestureEnabled containerStyle={tw.style({ backgroundColor: colors.backgroundElement })}
      indicatorStyle={tw.style({ backgroundColor: colors.textSecondary })}>
      <View style={tw.style('px-6 pt-3 gap-4', { paddingBottom: insets.bottom + 24 })}>
        <Text accessibilityRole="header" style={tw.style('text-xl font-semibold', { color: colors.text })}>React Native Actions Sheet</Text>
        <Text style={text}>Drag the handle or tap outside to dismiss. Compare this sheet’s feel with Gorhom.</Text>
        <Button label="Close sheet" onPress={() => action.current?.hide()} />
      </View>
    </ActionSheet>
  </View>;
}
