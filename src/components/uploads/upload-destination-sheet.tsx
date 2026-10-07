import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { useMutation, useQuery } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { pb } from '@/client/pb';
import { Button, Input } from '@/components/ui';
import UploadSheet from '@/components/overlays/upload-sheet';
import type { LocalAsset } from '@/db/schema';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import { resolveUploadAlbum } from '@/lib/upload-api';
import { readUploadToken } from '@/lib/upload-token';
import type { UploadDestination } from '@/lib/upload-types';
import { useUploadQueue } from '@/providers/upload-queue-context';
import { useServerStore } from '@/stores/server-store';
import tw from '@/lib/tw';

function DestinationRow({ name, detail, selected, onPress }: { name: string; detail?: string; selected: boolean; onPress: () => void }) {
  const colors = useTheme();
  return <Pressable onPress={onPress} accessibilityRole="radio" accessibilityLabel={name} accessibilityState={{ checked: selected }}
    style={({ pressed }) => tw.style('min-h-14 px-4 py-3 flex-row items-center gap-3 rounded-xl', { backgroundColor: selected ? colors.backgroundSelected : 'transparent', opacity: pressed ? 0.7 : 1 })}>
    <View style={tw.style('h-5 w-5 rounded-full border-2 items-center justify-center', { borderColor: selected ? colors.primary : colors.outline })}>
      {selected && <View style={tw.style('h-2.5 w-2.5 rounded-full', { backgroundColor: colors.primary })} />}
    </View>
    <View style={tw`flex-1 gap-1`}><Text numberOfLines={2} style={tw.style('text-base font-medium', { color: colors.text })}>{name}</Text>
      {detail && <Text style={tw.style('text-sm', { color: colors.textSecondary })}>{detail}</Text>}</View>
  </Pressable>;
}

export function UploadDestinationSheet({ assets, albumName, onClose, onQueued }: {
  assets: LocalAsset[]; albumName: string; onClose: () => void; onQueued: () => void;
}) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const { verifiedUrl, account, revision } = useServerStore();
  const queue = useUploadQueue();
  const [destination, setDestination] = useState(albumName.trim() ? 'match' : 'unsorted');
  const [tokenInput, setTokenInput] = useState<string | null>(null);
  const tokenQuery = useQuery({ queryKey: ['upload-token', verifiedUrl], enabled: !!verifiedUrl,
    queryFn: () => readUploadToken(verifiedUrl!), staleTime: Infinity, gcTime: 0, networkMode: 'always' });
  const token = tokenInput ?? tokenQuery.data ?? '';
  const albums = useQuery({ queryKey: ['albums', verifiedUrl, account?.id, 'upload-picker', revision],
    enabled: !!verifiedUrl && !!account,
    queryFn: ({ signal }) => {
      const api = new PocketBase(verifiedUrl!, new BaseAuthStore());
      api.authStore.save(pb.authStore.token, pb.authStore.record);
      return api.collection('album').getFullList<UploadDestination>({ sort: 'name', fields: 'id,name', signal, requestKey: null });
    },
  });
  const matching = albums.data?.find((album) => album.name.trim().toLowerCase() === albumName.trim().toLowerCase());
  const add = useMutation({
    mutationFn: async () => {
      if (!verifiedUrl || !account || !pb.authStore.isValid) throw new Error('Connect and log in before uploading.');
      if (!token.trim()) throw new Error('Enter the server upload token.');
      const api = new PocketBase(verifiedUrl, new BaseAuthStore());
      api.authStore.save(pb.authStore.token, pb.authStore.record);
      const chosen = destination === 'match' ? matching ?? await resolveUploadAlbum(api, albumName)
        : destination === 'unsorted' ? { id: 'unsorted', name: 'Unsorted' }
        : albums.data?.find((album) => album.id === destination);
      if (!chosen) throw new Error('Choose an available cloud album.');
      if (useServerStore.getState().revision !== revision) throw new Error('The server changed. Choose the destination again.');
      await queue.enqueue(assets, chosen, token);
    },
    onSuccess: () => { toast.success(`${assets.length} ${assets.length === 1 ? 'item added' : 'items added'} to upload queue`); onQueued(); },
  });
  return <UploadSheet onClose={onClose}>
    <View style={tw`px-6 pt-5 pb-3 flex-row items-start gap-3`}>
      <View style={tw`flex-1 gap-1`}><Text accessibilityRole="header" style={tw.style('text-2xl font-semibold', { color: colors.text })}>Upload to cloud</Text>
        <Text style={tw.style('text-sm', { color: colors.textSecondary })}>{assets.length} selected · uploaded one at a time</Text></View>
      <Button label="Close" variant="text" onPress={onClose} />
    </View>
    {!verifiedUrl || !account ? <View style={tw`px-6 py-6 gap-4`}>
      <Text style={tw.style('text-base', { color: colors.text })}>Connect to your server and log in to choose a cloud album.</Text>
      <Button label="Open settings" onPress={() => { onClose(); router.push('/settings'); }} />
    </View> : <>
      <FlatList style={tw`flex-1`} keyboardShouldPersistTaps="handled" data={(albums.data ?? []).filter((album) => album.id !== 'unsorted')}
        keyExtractor={(album) => album.id} contentContainerStyle={tw`px-4 pb-4 gap-1`}
        ListHeaderComponent={<View style={tw`gap-3 pb-3`}>
          <Input label="Upload token" secureTextEntry value={token} onChangeText={setTokenInput}
            helperText="Use test_token from your server configuration. Saved for this server." />
          {albumName.trim() && <DestinationRow name={`Use “${albumName}”`} detail={matching ? 'Add to the existing cloud album' : 'Create this cloud album if it does not exist'} selected={destination === 'match'} onPress={() => setDestination('match')} />}
          <DestinationRow name="Unsorted" detail="Upload without choosing a named album" selected={destination === 'unsorted'} onPress={() => setDestination('unsorted')} />
          <Text style={tw.style('px-4 pt-3 text-sm font-medium', { color: colors.textSecondary })}>Or choose a cloud album</Text>
          {albums.isFetching && <Text style={tw.style('px-4 text-sm', { color: colors.textSecondary })}>Loading albums…</Text>}
          {albums.isError && <View style={tw`gap-2 px-4`}><Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>{extract_message(albums.error)}</Text><Button label="Retry albums" variant="outlined" onPress={() => { void albums.refetch(); }} /></View>}
          {tokenQuery.isError && <Text accessibilityRole="alert" style={tw.style('px-4 text-sm', { color: colors.error })}>Could not load the saved upload token. Enter it again.</Text>}
        </View>}
        renderItem={({ item }) => <DestinationRow name={item.name} selected={destination === item.id} onPress={() => setDestination(item.id)} />}
      />
      <View style={tw.style('px-6 pt-3 gap-3', { paddingBottom: Math.max(12, insets.bottom), borderTopWidth: 1, borderColor: colors.outline })}>
        <Text style={tw.style('text-xs', { color: colors.textSecondary })}>Existing cloud copies will be moved to the selected album.</Text>
        {add.error && <Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>{extract_message(add.error)}</Text>}
        <Button label={`Queue ${assets.length} ${assets.length === 1 ? 'item' : 'items'}`} loading={add.isPending}
          disabled={!token.trim() || !assets.length || !queue.ready} onPress={() => add.mutate()} />
        {!queue.ready && !queue.error && <Text style={tw.style('text-sm', { color: colors.textSecondary })}>Loading upload queue…</Text>}
        {!!queue.error && <View style={tw`gap-2`}><Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>{extract_message(queue.error)}</Text>
          <Button label="Retry queue" variant="outlined" onPress={() => { void queue.reload().catch((error) => toast.error(extract_message(error))); }} /></View>}
      </View>
    </>}
  </UploadSheet>;
}
