import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { Button } from '@/components/ui';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export function ThumbnailRetry({ name, error, onRetry }: { name: string; error?: unknown; onRetry: () => void }) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Preview unavailable for ${name}. Show details and retry`}
      onPress={(event) => { event.stopPropagation(); setOpen(true); }} style={tw`min-h-11 min-w-11 items-center justify-center`}>
      <SymbolView name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={22} tintColor={colors.textSecondary} />
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={tw`flex-1 justify-center items-center bg-black/60 px-6`}>
        <View style={tw.style('w-full max-w-sm p-6 rounded-2xl gap-4', { backgroundColor: colors.background })}>
          <Text accessibilityRole="header" style={tw.style('text-xl font-semibold', { color: colors.text })}>Preview unavailable</Text>
          <Text numberOfLines={2} style={tw.style('text-base', { color: colors.text })}>{name}</Text>
          <Text style={tw.style('text-sm', { color: colors.textSecondary })}>{error ? extract_message(error) : 'The saved preview could not be displayed. Try downloading a fresh preview.'}</Text>
          <Button label="Retry preview" onPress={() => { setOpen(false); onRetry(); }} />
          <Button label="Close" variant="text" onPress={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </>;
}
