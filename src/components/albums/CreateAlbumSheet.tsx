import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { pb } from '@/client/pb';
import UploadSheet from '@/components/overlays/upload-sheet';
import { Button, Input } from '@/components/ui';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import { resolveUploadAlbum } from '@/lib/upload-api';
import { useServerStore } from '@/stores/server-store';
import tw from '@/lib/tw';

export function CreateAlbumSheet({ onClose }: { onClose: () => void }) {
  const colors = useTheme();
  const [name, setName] = useState('');
  const { verifiedUrl, account, revision } = useServerStore();
  const cache = useQueryClient();
  const create = useMutation({
    mutationFn: async () => {
      if (!verifiedUrl || !account || !pb.authStore.isValid || useServerStore.getState().revision !== revision)
        throw new Error('Connect and log in before creating an album.');
      const api = new PocketBase(verifiedUrl, new BaseAuthStore());
      api.authStore.save(pb.authStore.token, pb.authStore.record);
      return resolveUploadAlbum(api, name);
    },
    onSuccess: (album) => {
      if (useServerStore.getState().revision !== revision) return;
      void cache.invalidateQueries({ queryKey: ['albums', verifiedUrl, account?.id] });
      toast.success(`“${album.name}” is ready`);
      onClose();
    },
  });
  return <UploadSheet onClose={onClose}>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={tw`px-6 pt-5 pb-8 gap-5`}>
      <View style={tw`flex-row items-center gap-3`}>
        <Text accessibilityRole="header" style={tw.style('flex-1 text-2xl font-semibold', { color: colors.text })}>New cloud album</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close new album" onPress={onClose}
          style={({ pressed }) => tw.style('min-h-11 px-3 justify-center', { opacity: pressed ? 0.7 : 1 })}>
          <Text style={tw.style('text-base font-medium', { color: colors.primary })}>Close</Text>
        </Pressable>
      </View>
      <Input label="Album name" value={name} onChangeText={setName} placeholder="e.g. Summer trip"
        helperText="If this name already exists, the existing album will be used." />
      {create.error && <Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>{extract_message(create.error)}</Text>}
      <Button label="Create album" loading={create.isPending} disabled={!name.trim()} onPress={() => create.mutate()} />
    </ScrollView>
  </UploadSheet>;
}
