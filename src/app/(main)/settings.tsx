import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { Button, Input } from '@/components/ui';
import { BottomTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { testServerConnection } from '@/lib/server-connection';
import tw from '@/lib/tw';
import { useServerStore } from '@/stores/server-store';

export default function SettingsScreen() {
  const colors = useTheme();
  const server = useServerStore();
  const queryClient = useQueryClient();
  const connection = useMutation({
    mutationFn: ({ input }: { input: string; revision: number }) => testServerConnection(input),
    onSuccess: (url, { revision }) => {
      if (useServerStore.getState().verify(url, revision)) toast.success('Connected to server');
    },
    onError: (error, { revision }) => {
      if (revision === useServerStore.getState().revision) toast.error(error.message);
    },
  });
  const error = connection.variables?.revision === server.revision ? connection.error?.message : undefined;
  return (
    <SafeAreaView edges={['top']} style={tw.style('flex-1', { backgroundColor: colors.background })}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={tw.style('px-6 pt-6 gap-6', { paddingBottom: BottomTabInset + 24 })}>
        <Text style={tw.style('text-3xl font-semibold', { color: colors.text })}>Settings</Text>
        <View style={tw`gap-3`}>
          <Text style={tw.style('text-xl font-medium', { color: colors.text })}>Server connection</Text>
          <Text style={tw.style('text-base', { color: colors.textSecondary })}>Enter your server URL, then test the connection to continue.</Text>
        </View>
        <Input label="Server URL" value={server.urlInput} placeholder="https://your-server.com"
          onChangeText={(value) => { server.setUrlInput(value); queryClient.removeQueries(); }} error={error}
          helperText="Include http:// or https://. Use your computer’s LAN address for a local server." />
        <Button label="Test connection" loading={connection.isPending} disabled={!server.urlInput.trim()}
          onPress={() => { connection.reset(); const revision = server.beginCheck(); queryClient.removeQueries(); connection.mutate({ input: server.urlInput, revision }); }} />
        {server.verifiedUrl && <View style={tw`gap-4`}>
          <Text accessibilityLiveRegion="polite" style={tw.style('text-base', { color: colors.text })}>Connected to {server.verifiedUrl}</Text>
          {server.account ? <>
            <Text style={tw.style('text-base', { color: colors.textSecondary })}>Signed in as {server.account.email}</Text>
            <Button label="Log out" variant="outlined" onPress={() => { server.logout(); queryClient.removeQueries(); toast.success('Logged out'); }} />
          </> : <Button label="Log in" onPress={() => router.push('/auth')} />}
        </View>}
      </ScrollView>
    </SafeAreaView>
  );
}
