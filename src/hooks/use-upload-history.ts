import { useInfiniteQuery } from '@tanstack/react-query';
import type { UploadHistoryItem } from '@/lib/upload-types';
export function useUploadHistory() {
  return useInfiniteQuery({ queryKey: ['upload-history', 'unsupported'], initialPageParam: 0,
    queryFn: async (): Promise<UploadHistoryItem[]> => [], getNextPageParam: () => undefined,
  });
}
