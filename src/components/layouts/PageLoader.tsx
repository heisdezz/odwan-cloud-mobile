import type { ReactNode } from 'react';
import type { QueryObserverResult } from '@tanstack/react-query';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

type PageLoaderProps<TData, TError> = {
  query: QueryObserverResult<TData, TError>;
  children?: ReactNode | ((data: TData) => ReactNode);
  customLoading?: ReactNode;
  customEmpty?: ReactNode;
};

export default function PageLoader<TData, TError = Error>({ query, children, customLoading, customEmpty }: PageLoaderProps<TData, TError>) {
  const colors = useTheme();
  if (query.data === undefined) {
    if (query.isError) return <View style={tw`flex-1 items-center justify-center gap-4 px-6 py-8`}>
      <Text accessibilityRole="alert" style={tw.style('text-base text-center', { color: colors.text })}>{extract_message(query.error)}</Text>
      <Button label="Retry" loading={query.isFetching} onPress={() => { void query.refetch(); }} style={tw`w-full max-w-xs`} />
    </View>;
    if (query.isPending) {
      if (query.fetchStatus === 'idle') return customEmpty ?? null;
      return customLoading ?? <View style={tw`flex-1 items-center justify-center gap-4 py-8`}>
        <ActivityIndicator size="large" color={colors.text} />
        <Text accessibilityLiveRegion="polite" style={tw.style('text-base', { color: colors.textSecondary })}>{query.fetchStatus === 'paused' ? 'Waiting for connection…' : 'Loading…'}</Text>
      </View>;
    }
    return customEmpty ?? null;
  }
  // Keep existing content visible during background fetching or a refetch error.
  return <View style={tw`flex-1`}>{typeof children === 'function' ? children(query.data) : children}</View>;
}
