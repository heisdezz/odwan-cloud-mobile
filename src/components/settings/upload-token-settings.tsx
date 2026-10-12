import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { Button, Input } from '@/components/ui';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import { readUploadToken, saveUploadToken } from '@/lib/upload-token';
import tw from '@/lib/tw';

export function UploadTokenSettings({ serverUrl }: { serverUrl: string }) {
  const colors = useTheme();
  const client = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const key = ['upload-token', serverUrl] as const;
  const saved = useQuery({
    queryKey: key,
    queryFn: () => readUploadToken(serverUrl),
    staleTime: Infinity,
    networkMode: 'always',
  });
  const token = draft ?? saved.data ?? '';
  const changed = !!token.trim() && token.trim() !== (saved.data ?? '');
  const save = useMutation({
    mutationFn: (value: string) => saveUploadToken(serverUrl, value),
    onSuccess: (_result, value) => {
      client.setQueryData(key, value);
      setDraft(null);
      toast.success('Upload token saved for this server');
    },
    onError: (error) => toast.error(extract_message(error)),
  });

  return <View style={tw`gap-4`}>
    <View style={tw`gap-1`}>
      <Text style={tw.style('text-base font-semibold', { color: colors.text })}>Upload access</Text>
      <Text style={tw.style('text-sm leading-5', { color: colors.textSecondary })}>
        Add the upload token from your server configuration. It is separate from your login and is needed to send files.
      </Text>
    </View>
    <Input label="Upload token" secureTextEntry value={token} onChangeText={setDraft} disabled={save.isPending}
      helperText="Saved for this server. You can replace it at any time." />
    {saved.isError && <View style={tw`gap-2`}>
      <Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>
        Could not load the saved token. Enter it again or retry.
      </Text>
      <Button label="Retry loading token" variant="text" onPress={() => { void saved.refetch(); }} />
    </View>}
    {!saved.isError && <Text accessibilityLiveRegion="polite" style={tw.style('text-sm', { color: colors.textSecondary })}>
      {saved.isPending ? 'Checking saved token…' : saved.data ? 'Token saved for this server' : 'No upload token saved yet'}
    </Text>}
    <Button label="Save upload token" loading={save.isPending} disabled={!changed || saved.isPending} onPress={() => save.mutate(token.trim())} />
  </View>;
}
