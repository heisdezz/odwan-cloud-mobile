import { Pressable, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
export type AlbumSort = 'name' | 'newest' | 'count';
export function AlbumBrowserTools({ search, onSearch, sort, onSort, remote = false }: {
  search: string; onSearch: (value: string) => void; sort: AlbumSort; onSort: (value: AlbumSort) => void; remote?: boolean;
}) {
  const colors = useTheme();
  const choices: AlbumSort[] = remote ? ['name', 'newest', 'count'] : ['name', 'count'];
  return <View style={tw`px-4 pb-3 flex-row gap-2 items-center`}>
    <View style={tw.style('flex-1 flex-row min-h-12 items-center px-3 rounded-xl gap-2', { backgroundColor: colors.backgroundElement })}>
      <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={20} tintColor={colors.textSecondary} />
      <TextInput accessibilityLabel="Search albums" placeholder="Search albums" value={search} onChangeText={onSearch} returnKeyType="search"
        placeholderTextColor={colors.textSecondary} style={tw.style('flex-1 min-h-12 text-base', { color: colors.text })} />
      {!!search && <Pressable accessibilityRole="button" accessibilityLabel="Clear album search" onPress={() => onSearch('')} style={tw`min-h-11 min-w-11 items-center justify-center`}>
        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor={colors.textSecondary} />
      </Pressable>}
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Sort albums: ${sort}. Change sort order`}
      onPress={() => onSort(choices[(choices.indexOf(sort) + 1) % choices.length])} style={tw.style('min-h-12 px-3 rounded-xl justify-center', { backgroundColor: colors.backgroundElement })}>
      <Text style={tw.style('text-sm font-medium', { color: colors.text })}>{sort === 'name' ? 'A–Z' : sort === 'newest' ? 'Newest' : 'Items'}</Text>
    </Pressable>
  </View>;
}
