import type { QueryClient } from '@tanstack/react-query';

const SERVER_QUERIES = new Set(['media-capabilities', 'media-items', 'albums', 'media-viewer', 'viewer-file-token', 'backup-status', 'upload-token']);
export function clearServerQueries(client: QueryClient) {
  const predicate = (query: { queryKey: readonly unknown[] }) => SERVER_QUERIES.has(String(query.queryKey[0]))
    || query.queryKey[0] === 'media-thumbnail' && query.queryKey[1] === 'remote';
  void client.cancelQueries({ predicate });
  client.removeQueries({ predicate });
}
