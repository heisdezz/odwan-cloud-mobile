import { pb } from '@/client/pb';
import { mediaStreamUrl } from '@/helpers/media';
import { matchesViewerScope, type ViewerItem, type ViewerScope } from '@/helpers/media-viewer';
import { useServerStore } from '@/stores/server-store';

export async function shareMedia(item: ViewerItem, scope: ViewerScope | undefined, signal: AbortSignal) {
  const uri = item.kind === 'local' ? item.uri : scope ? mediaStreamUrl(scope.serverUrl, item.id) : undefined;
  if (!uri || !matchesViewerScope(scope, useServerStore.getState())) throw new Error('Reopen the item to share it.');
  const response = await fetch(uri, { headers: item.kind === 'remote' ? { Authorization: pb.authStore.token } : undefined, signal });
  if (!response.ok) throw new Error(`Could not prepare media (${response.status}).`);
  const blob = await response.blob();
  if (signal.aborted || !matchesViewerScope(scope, useServerStore.getState())) throw new Error('Sharing cancelled.');
  const file = new File([blob], item.name, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: item.name });
  else {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = item.name; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
