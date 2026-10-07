import { useInfiniteQuery } from '@tanstack/react-query';
import { uploadRepository } from '@/db/upload-repository.native';
import { useServerStore } from '@/stores/server-store';

export function useUploadHistory() {
  const url = useServerStore((state) => state.verifiedUrl);
  const accountId = useServerStore((state) => state.account?.id);
  return useInfiniteQuery({ queryKey: ['upload-history', url, accountId], enabled: !!url && !!accountId,
    initialPageParam: 0, queryFn: ({ pageParam }) => uploadRepository.history({ serverUrl: url!, accountId: accountId! }, 100, pageParam),
    getNextPageParam: (page, pages) => page.length === 100 ? pages.length * 100 : undefined,
    staleTime: Infinity, networkMode: 'always', refetchOnWindowFocus: false,
  });
}
