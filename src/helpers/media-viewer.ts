import type { MediaItemResponse } from '../../pocketbase-types';
import type { LocalAsset } from '../db/schema';
import { mediaName } from './media';

export type ViewerItem = {
  id: string; name: string; video: boolean; available: boolean;
  width: number; height: number;
} & ({ kind: 'remote'; record: MediaItemResponse } | { kind: 'local'; uri: string });
export type ViewerScope = { serverUrl: string; accountId: string; revision: number };
export type ViewerSession = {
  id: string; items: ViewerItem[]; selectedId: string;
  scope?: ViewerScope; albumId?: string;
  // Undefined means the end of the list. Pages contain metadata, never media bytes.
  loadMore?: () => Promise<ViewerItem[] | undefined>;
};
export function remoteViewerItem(record: MediaItemResponse): ViewerItem {
  let width = 0, height = 0;
  try {
    const data = JSON.parse(record.metadata_json || '{}');
    const w = Number(data?.width), h = Number(data?.height);
    width = Number.isFinite(w) && w > 0 ? w : 0;
    height = Number.isFinite(h) && h > 0 ? h : 0;
  } catch { /* Missing dimensions are filled by the image's onLoad event. */ }
  return { kind: 'remote', record, id: record.id, name: mediaName(record),
    video: record.mime_type.startsWith('video/'),
    available: record.upload_status === 'success' && !!record.storage_backend && !!record.storage_bucket && !!record.storage_key,
    width, height };
}
export function localViewerItem(asset: LocalAsset): ViewerItem {
  return { kind: 'local', id: asset.id, uri: asset.uri, name: asset.filename,
    video: asset.mediaType === 'video', available: true, width: asset.width, height: asset.height };
}
export function appendViewerItems(current: ViewerItem[], incoming: ViewerItem[]): ViewerItem[] {
  const ids = new Set(current.map((item) => item.id));
  const added = incoming.filter((item) => { if (ids.has(item.id)) return false; ids.add(item.id); return true; });
  return added.length ? [...current, ...added] : current;
}
export function matchesViewerScope(scope: ViewerScope | undefined, current: { verifiedUrl: string | null; account: { id: string } | null; revision: number }): boolean {
  return !scope || (scope.serverUrl === current.verifiedUrl && scope.accountId === current.account?.id && scope.revision === current.revision);
}
