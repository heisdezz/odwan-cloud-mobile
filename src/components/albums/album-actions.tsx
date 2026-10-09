import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import PocketBase, { BaseAuthStore } from 'pocketbase';
import { router } from 'expo-router';
import { Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { pb } from '@/client/pb';
import UploadSheet from '@/components/overlays/upload-sheet';
import { Button, Input } from '@/components/ui';
import { useServerStore } from '@/stores/server-store';
import { useTheme } from '@/hooks/use-theme';
import { extract_message } from '@/helpers/api';
import type { AlbumWithCover } from '@/hooks/use-albums';
import tw from '@/lib/tw';

export function AlbumActions({ album, onClose }: { album: AlbumWithCover; onClose: () => void }) {
  const colors = useTheme();
  const cache = useQueryClient();
  const [action, setAction] = useState<'menu' | 'rename' | 'delete'>('menu');
  const [name, setName] = useState(album.name);
  const state = useServerStore();
  const mutation = useMutation({ mutationFn: async () => {
    const current = useServerStore.getState();
    if (!current.account || current.revision !== state.revision || !current.verifiedUrl || !pb.authStore.isValid) throw new Error('Log in again to change this album.');
    if (album.id === 'unsorted') throw new Error('Unsorted cannot be renamed or deleted.');
    const api = new PocketBase(current.verifiedUrl, new BaseAuthStore()); api.authStore.save(pb.authStore.token, pb.authStore.record);
    if (action === 'rename') {
      if (!name.trim()) throw new Error('Enter an album name.');
      return api.collection('album').update(album.id, { name: name.trim() }, { requestKey: null });
    }
    // Always read page one: each update removes an item from this album's result set.
    for (;;) {
      if (useServerStore.getState().revision !== state.revision) throw new Error('The server session changed.');
      const page = await api.collection('media_item').getList(1, 60, { filter: api.filter('album_id = {:id}', { id: album.id }), requestKey: null });
      if (!page.items.length) break;
      for (const item of page.items) {
        if (useServerStore.getState().revision !== state.revision) throw new Error('The server session changed.');
        await api.collection('media_item').update(item.id, { album_id: 'unsorted' }, { requestKey: null });
      }
    }
    return api.collection('album').delete(album.id, { requestKey: null });
  }, onSuccess: () => {
    void cache.invalidateQueries({ queryKey: ['albums', state.verifiedUrl, state.account?.id] });
    void cache.invalidateQueries({ queryKey: ['media-items', state.verifiedUrl, state.account?.id] });
    toast.success(action === 'rename' ? 'Album renamed' : 'Album removed. Items moved to Unsorted.'); onClose();
  }, onSettled: () => { void cache.invalidateQueries({ queryKey: ['albums', state.verifiedUrl, state.account?.id] }); void cache.invalidateQueries({ queryKey: ['media-items', state.verifiedUrl, state.account?.id] }); } });
  return <UploadSheet onClose={() => { if (!mutation.isPending) onClose(); }}><View style={tw`p-6 gap-4`}>
    <Text accessibilityRole="header" numberOfLines={2} style={tw.style('text-2xl font-semibold', { color: colors.text })}>{album.name}</Text>
    {action === 'menu' ? <>
      <Button label="Add items from device" onPress={() => { onClose(); router.navigate({ pathname: '/explore', params: { source: 'local' } }); }} />
      <Text style={tw.style('text-sm', { color: colors.textSecondary })}>Open a device album, select items, and choose this cloud album as the upload destination.</Text>
      <Button label="Rename album" variant="outlined" disabled={album.id === 'unsorted'} onPress={() => setAction('rename')} />
      <Button label="Remove album" variant="outlined" disabled={album.id === 'unsorted'} onPress={() => setAction('delete')} />
    </> : <>
      {action === 'rename' ? <Input label="Album name" value={name} onChangeText={setName} />
        : <Text style={tw.style('text-base', { color: colors.textSecondary })}>Remove this album? Its items will move to Unsorted. No photos or videos will be deleted.</Text>}
      {mutation.error && <Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>{extract_message(mutation.error)}</Text>}
      <Button label={action === 'rename' ? 'Save name' : 'Remove album'} loading={mutation.isPending} disabled={mutation.isPending} onPress={() => mutation.mutate()} />
    </>}
    <Button label="Close" variant="text" disabled={mutation.isPending} onPress={onClose} />
  </View></UploadSheet>;
}
