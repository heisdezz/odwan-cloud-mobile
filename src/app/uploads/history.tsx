import { Stack, router } from 'expo-router';
import { ActivityIndicator, FlatList, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import { useUploadHistory } from '@/hooks/use-upload-history';
import { useServerStore } from '@/stores/server-store';
import tw from '@/lib/tw';

export default function UploadHistoryScreen() {
  const colors = useTheme();
  const account = useServerStore((state) => state.account);
  const history = useUploadHistory();
  const items = history.data?.pages.flat() ?? [];
  return <SafeAreaView edges={['bottom']} style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <Stack.Screen options={{ title: 'Uploaded' }} />
    <FlatList data={items} keyExtractor={(item) => item.id} style={tw`flex-1`} contentContainerStyle={tw`px-6 py-4`}
      onEndReached={() => { if (history.hasNextPage && !history.isFetchingNextPage) void history.fetchNextPage(); }} onEndReachedThreshold={0.5}
      ListHeaderComponent={<Text style={tw.style('text-sm pb-4', { color: colors.textSecondary })}>Completed uploads for this server and account. Clearing the queue keeps this history.</Text>}
      ListEmptyComponent={<View style={tw`py-12 gap-4 items-center`}>
        {history.isLoading ? <ActivityIndicator color={colors.primary} /> : <>
          <Text style={tw.style('text-lg font-medium text-center', { color: colors.text })}>{account ? 'No completed uploads yet' : 'Log in to see your uploads'}</Text>
          {!account && <Button label="Open settings" variant="outlined" onPress={() => router.push('/settings')} />}
        </>}
      </View>}
      renderItem={({ item }) => <View style={tw.style('py-4 gap-2', { borderBottomWidth: 1, borderColor: colors.outline })}>
        <Text numberOfLines={2} style={tw.style('text-base font-medium', { color: colors.text })}>{item.asset.filename}</Text>
        <Text style={tw.style('text-sm', { color: colors.textSecondary })}>{item.albumName} · {item.result?.duplicate ? 'Existing cloud copy linked' : 'Uploaded'}</Text>
        <Text style={tw.style('text-xs', { color: colors.textSecondary })}>{new Date(item.completedAt).toLocaleString()}</Text>
      </View>}
      ListFooterComponent={history.isFetchingNextPage ? <ActivityIndicator style={tw`py-5`} color={colors.primary} /> : history.isError ?
        <View style={tw`py-5 gap-3`}><Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>{extract_message(history.error)}</Text>
          <Button label="Retry history" variant="outlined" onPress={() => { void history.refetch(); }} /></View> : null}
    />
  </SafeAreaView>;
}
