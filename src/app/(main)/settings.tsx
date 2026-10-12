import { useState, type ComponentProps, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { AppearanceSettings } from '@/components/settings/appearance-settings';
import { StorageSettings } from '@/components/settings/storage-settings';
import { UploadTokenSettings } from '@/components/settings/upload-token-settings';
import { BackupStatusCard } from '@/components/uploads/backup-status-card';
import { Button, Input } from '@/components/ui';
import { BottomTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { clearServerQueries } from '@/lib/server-query-cache';
import { testServerConnection } from '@/lib/server-connection';
import { logoutServerSession, restoreServerSession } from '@/lib/server-session';
import tw from '@/lib/tw';
import { useServerStore } from '@/stores/server-store';

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const colors = useTheme();
  return <View style={tw`gap-3`}>
    <Text style={tw.style('text-xl font-semibold', { color: colors.text })}>{title}</Text>
    <View style={tw.style('rounded-3xl p-4', { backgroundColor: colors.backgroundElement })}>{children}</View>
  </View>;
}

type SettingsDestination = '/uploads/current' | '/uploads/history' | '/trash' | '/onboarding';
function SettingsLink({ title, detail, icon, href, divided = false }: {
  title: string; detail: string; icon: ComponentProps<typeof SymbolView>['name'];
  href: SettingsDestination; divided?: boolean;
}) {
  const colors = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`}
    onPress={() => router.push(href)}
    style={({ pressed }) => tw.style('min-h-16 py-3 flex-row items-center gap-3', {
      borderTopWidth: divided ? 1 : 0, borderColor: colors.outline, opacity: pressed ? 0.7 : 1,
    })}>
    <View style={tw.style('h-11 w-11 rounded-2xl items-center justify-center', { backgroundColor: colors.backgroundSelected })}>
      <SymbolView name={icon} size={22} tintColor={colors.primary} />
    </View>
    <View style={tw`flex-1 gap-1`}>
      <Text style={tw.style('text-base font-medium', { color: colors.text })}>{title}</Text>
      <Text style={tw.style('text-sm', { color: colors.textSecondary })}>{detail}</Text>
    </View>
    <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
      size={20} tintColor={colors.textSecondary} />
  </Pressable>;
}

export default function SettingsScreen() {
  const colors = useTheme();
  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState('');
  const server = useServerStore();
  const queryClient = useQueryClient();
  const logout = useMutation({
    mutationFn: logoutServerSession,
    onMutate: () => clearServerQueries(queryClient),
    onSuccess: () => toast.success('Logged out'),
    onError: () => toast.error('Could not remove saved login. Please retry.'),
  });
  const connection = useMutation({
    mutationFn: async ({ input }: { input: string; revision: number }) => {
      const start = performance.now();
      const url = await testServerConnection(input);
      return { url, milliseconds: Math.round(performance.now() - start) };
    },
    onSuccess: ({ url, milliseconds }, { revision }) => {
      if (useServerStore.getState().verify(url, revision)) {
        setEditing(false);
        toast.success(`Connected to server (${milliseconds} ms)`);
        void restoreServerSession(url, revision).catch(() => {
          if (useServerStore.getState().revision === revision)
            toast.error('Connected, but saved login could not be restored. Please log in again.');
        });
      }
    },
    onError: (error, { revision }) => {
      if (revision === useServerStore.getState().revision) toast.error(error.message);
    },
  });
  const connectionError = connection.variables?.revision === server.revision
    ? connection.error?.message : undefined;
  const showUrlForm = !server.verifiedUrl || editing;
  const urlInput = editing ? draftUrl : server.urlInput;

  return <SafeAreaView edges={['top']} style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <KeyboardAwareScrollView bottomOffset={24} keyboardShouldPersistTaps="handled"
      contentContainerStyle={tw.style('px-5 pt-6 gap-7', { paddingBottom: BottomTabInset + 24 })}>
      <View style={tw`w-full max-w-xl self-center gap-7`}>
        <View style={tw`gap-1`}>
          <Text accessibilityRole="header" style={tw.style('text-3xl font-semibold', { color: colors.text })}>Settings</Text>
          <Text style={tw.style('text-sm', { color: colors.textSecondary })}>Your cloud, backups, and app preferences</Text>
        </View>

        <SettingsSection title="Connection">
          {showUrlForm ? <View style={tw`gap-4`}>
            <View style={tw`gap-1`}>
              <Text style={tw.style('text-base font-semibold', { color: colors.text })}>
                {editing ? 'Change server' : 'Connect your server'}
              </Text>
              <Text style={tw.style('text-sm leading-5', { color: colors.textSecondary })}>
                {editing ? `Current server: ${server.verifiedUrl}` : 'Enter the address of your Odwan server to browse your cloud library.'}
              </Text>
            </View>
            <Input label="Server URL" value={urlInput} disabled={connection.isPending}
              placeholder="https://your-server.com" error={connectionError}
              onChangeText={(value) => {
                connection.reset();
                if (editing) setDraftUrl(value);
                else server.setUrlInput(value);
              }}
              helperText="Use your computer’s LAN address for a local server." />
            <Button label="Test connection" loading={connection.isPending} disabled={!urlInput.trim()}
              onPress={() => {
                if (editing) server.setUrlInput(urlInput);
                connection.reset();
                const revision = server.beginCheck();
                clearServerQueries(queryClient);
                connection.mutate({ input: urlInput, revision });
              }} />
            {editing && <Button label="Cancel" variant="text" disabled={connection.isPending}
              onPress={() => setEditing(false)} />}
          </View> : <View style={tw`gap-4`}>
            <View style={tw`gap-2`}>
              <View style={tw`flex-row items-center gap-2`}>
                <View style={tw.style('h-2.5 w-2.5 rounded-full', { backgroundColor: colors.primary })} />
                <Text style={tw.style('text-sm font-medium', { color: colors.primary })}>Connected</Text>
              </View>
              <Text selectable numberOfLines={2} style={tw.style('text-base font-medium', { color: colors.text })}>
                {server.verifiedUrl}
              </Text>
              <Text style={tw.style('text-sm', { color: colors.textSecondary })}>
                {server.account ? `Signed in as ${server.account.email}` : 'Log in to access your cloud library and uploads.'}
              </Text>
            </View>
            {server.account ? <Button label="Log out" variant="outlined" loading={logout.isPending}
              onPress={() => logout.mutate()} />
              : <Button label="Log in" onPress={() => router.push('/auth')} />}
            {logout.isError && !server.account && <Button label="Remove saved login" variant="outlined"
              loading={logout.isPending} onPress={() => logout.mutate()} />}
            <Button label="Change server" variant="text" onPress={() => {
              setDraftUrl(server.urlInput);
              setEditing(true);
            }} />
          </View>}
        </SettingsSection>

        {server.verifiedUrl && server.account && !editing && <SettingsSection title="Uploads">
          <UploadTokenSettings key={server.verifiedUrl} serverUrl={server.verifiedUrl} />
        </SettingsSection>}

        <View style={tw`gap-3`}>
          <Text style={tw.style('text-xl font-semibold', { color: colors.text })}>Backup</Text>
          <BackupStatusCard />
          <View style={tw.style('rounded-3xl px-4', { backgroundColor: colors.backgroundElement })}>
            <SettingsLink title="Current uploads" detail="Queue, progress, and retries"
              icon={{ ios: 'arrow.up.doc', android: 'upload_file', web: 'upload_file' }} href="/uploads/current" />
            <SettingsLink title="Uploaded" detail="Completed upload history"
              icon={{ ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' }} href="/uploads/history" divided />
            <SettingsLink title="Trash" detail="Restore recently removed cloud items"
              icon={{ ios: 'trash', android: 'delete_outline', web: 'delete_outline' }} href="/trash" divided />
          </View>
        </View>

        <View style={tw.style('rounded-3xl p-4', { backgroundColor: colors.backgroundElement })}>
          <StorageSettings />
        </View>
        <View style={tw.style('rounded-3xl p-4', { backgroundColor: colors.backgroundElement })}>
          <AppearanceSettings />
        </View>
        <SettingsSection title="Help">
          <SettingsLink title="Getting started" detail="Revisit the three-page guide"
            icon={{ ios: 'questionmark.circle', android: 'help_outline', web: 'help_outline' }} href="/onboarding" />
        </SettingsSection>
      </View>
    </KeyboardAwareScrollView>
  </SafeAreaView>;
}
