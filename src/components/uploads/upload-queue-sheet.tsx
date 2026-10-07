import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';
import { Button, Input } from '@/components/ui';
import UploadSheet from '@/components/overlays/upload-sheet';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import { useUploadQueue } from '@/providers/upload-queue-context';
import tw from '@/lib/tw';
import { saveUploadToken } from '@/lib/upload-token';
import { useServerStore } from '@/stores/server-store';

export function UploadQueueSheet({ onClose }: { onClose: () => void }) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const queue = useUploadQueue();
  const [token, setToken] = useState('');
  const [editingToken, setEditingToken] = useState(false);
  const retry = async () => {
    const server = useServerStore.getState();
    if (editingToken) {
      if (!server.verifiedUrl || !token.trim()) throw new Error('Enter the server upload token.');
      await saveUploadToken(server.verifiedUrl, token);
      if (useServerStore.getState().revision !== server.revision) throw new Error('The server changed. Open the queue again.');
      setToken(''); setEditingToken(false);
    }
    await queue.retry();
  };
  const action = (task: Promise<void>) => { void task.catch((error) => toast.error(extract_message(error))); };
  const done = queue.jobs.filter((job) => job.state === 'success').length;
  const failed = queue.jobs.filter((job) => job.state === 'error').length;
  return <UploadSheet onClose={onClose}>
    <View style={tw`px-6 pt-5 pb-3 flex-row items-start gap-3`}>
      <View style={tw`flex-1 gap-1`}><Text accessibilityRole="header" style={tw.style('text-2xl font-semibold', { color: colors.text })}>Upload queue</Text>
        <Text accessibilityLiveRegion="polite" style={tw.style('text-sm', { color: colors.textSecondary })}>{done} of {queue.jobs.length} complete{failed ? ` · ${failed} failed` : ''}{queue.paused ? ' · Paused' : ''}</Text></View>
      <Button label="Close" variant="text" onPress={onClose} />
    </View>
    <FlatList style={tw`flex-1`} data={queue.jobs} keyExtractor={(job) => job.id} contentContainerStyle={tw`px-6 pb-4`}
      ListEmptyComponent={<Text style={tw.style('py-10 text-base text-center', { color: colors.textSecondary })}>Select items in a device album to start uploading.</Text>}
      renderItem={({ item }) => <View style={tw.style('py-4 gap-2', { borderBottomWidth: 1, borderColor: colors.outline })}>
        <Text numberOfLines={2} style={tw.style('text-base font-medium', { color: colors.text })}>{item.asset.filename}</Text>
        <Text style={tw.style('text-sm', { color: colors.textSecondary })}>{item.albumName} · {item.state === 'success' ? item.result?.duplicate ? 'Existing copy linked' : 'Backed up' :
          queue.phase?.id === item.id ? ({ preparing: 'Preparing original…', sending: 'Sending / storing in cloud…', organizing: 'Adding to album…' })[queue.phase.phase] :
          item.state === 'queued' ? 'Queued' : item.state === 'error' ? 'Failed' : 'Uploading…'}</Text>
        {item.error && <Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>{item.result ? 'File stored; album assignment needs retry. ' : ''}{item.error}</Text>}
        {['queued', 'error'].includes(item.state) && <Button label="Remove from queue" variant="text" onPress={() => action(queue.remove(item.id))} />}
      </View>}
    />
    <View style={tw.style('px-6 pt-3 gap-2', { paddingBottom: Math.max(12, insets.bottom) })}>
      <View style={tw`flex-row gap-2`}>
        <Button label={queue.paused ? 'Resume' : 'Pause'} variant="outlined" style={tw`flex-1`} onPress={() => queue.setPaused(!queue.paused)} />
        {failed > 0 && <Button label="Retry failed" style={tw`flex-1`} onPress={() => action(retry())} />}
      </View>
      {failed > 0 && (editingToken ? <Input label="Replacement upload token" value={token} onChangeText={setToken} secureTextEntry helperText="Saved for this server when you tap Retry failed." /> :
        <Button label="Update upload token" variant="text" onPress={() => setEditingToken(true)} />)}
      {done > 0 && <Button label="Clear completed" variant="text" onPress={() => action(queue.clearCompleted())} />}
      <Text style={tw.style('text-xs', { color: colors.textSecondary })}>Uploads run while the app is open. The queue is saved when you leave.</Text>
      {!!queue.error && <View style={tw`gap-2`}><Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>{extract_message(queue.error)}</Text>
        <Button label="Retry queue" variant="outlined" onPress={() => action(queue.reload())} /></View>}
    </View>
  </UploadSheet>;
}
