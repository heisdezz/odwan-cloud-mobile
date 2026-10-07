import { Stack } from 'expo-router';
import { View } from 'react-native';
import { UploadQueueContent } from '@/components/uploads/upload-queue-content';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export default function CurrentUploadsScreen() {
  const colors = useTheme();
  return <View style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <Stack.Screen options={{ title: 'Current uploads' }} />
    <UploadQueueContent />
  </View>;
}
