import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { Button } from '@/components/ui';
import { readThumbnailStorage, clearThumbnailStorage } from '@/lib/thumbnail-storage';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

export function StorageSettings() {
  const colors = useTheme();
  const client = useQueryClient();
  const size = useQuery({ queryKey: ['thumbnail-storage'], queryFn: readThumbnailStorage, staleTime: 30_000 });
  const clear = useMutation({ mutationFn: async () => {
    await client.cancelQueries({ queryKey: ['media-thumbnail'] });
    await clearThumbnailStorage();
  }, onSuccess: () => { void size.refetch(); toast.success('Thumbnail cache cleared'); }, onError: (error) => toast.error(extract_message(error)) });
  return <View style={tw`gap-3`}>
    <Text style={tw.style('text-xl font-medium', { color: colors.text })}>Storage</Text>
    <Text style={tw.style('text-base', { color: colors.text })}>Thumbnail cache</Text>
    <Text style={tw.style('text-sm', { color: colors.textSecondary })}>{size.isError ? extract_message(size.error) : !size.data ? 'Calculating…'
      : size.data.supported ? `${(size.data.bytes / 1024 / 1024).toFixed(1)} MB · ${size.data.files.toLocaleString()} previews` : 'Browser previews are kept in memory.'}</Text>
    <Text style={tw.style('text-sm', { color: colors.textSecondary })}>Previews load again when needed. Your photos, upload history, and backup records are preserved.</Text>
    <Button label="Clear thumbnail cache" variant="outlined" loading={clear.isPending} onPress={() => clear.mutate()} />
  </View>;
}
