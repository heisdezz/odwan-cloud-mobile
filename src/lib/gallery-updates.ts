import type { LocalAsset } from '@/db/schema';
import { waitForGalleryIdle } from './gallery-scheduler';

/** Metadata only for changed/new assets; ID-only reconciliation handles deletions. */
export async function syncGalleryUpdates(options: {
  signal: AbortSignal;
  knownIds: string[];
  loadChanged: (offset: number) => Promise<{ assets: LocalAsset[]; next?: number }>;
  loadIds: (offset: number) => Promise<{ ids: string[]; next?: number }>;
  loadMissing: (ids: string[]) => Promise<LocalAsset[]>;
  write: (assets: LocalAsset[]) => Promise<unknown>;
  finish: (ids: string[]) => Promise<unknown>;
  onProgress?: (count: number) => void;
  waitForTurn?: () => Promise<void>;
}) {
  const known = new Set(options.knownIds);
  const ids = new Set<string>();
  let count = 0;
  async function turn() {
    if (options.signal.aborted) throw new Error('Gallery sync cancelled.');
    await (options.waitForTurn?.() ?? waitForGalleryIdle(options.signal));
    if (options.signal.aborted) throw new Error('Gallery sync cancelled.');
  }
  async function write(assets: LocalAsset[]) {
    if (options.signal.aborted) throw new Error('Gallery sync cancelled.');
    await options.write(assets);
    assets.forEach((asset) => known.add(asset.id));
    count += assets.length;
    options.onProgress?.(count);
  }
  let offset: number | undefined = 0;
  while (offset !== undefined) {
    await turn();
    const page = await options.loadChanged(offset);
    await write(page.assets);
    if (page.next !== undefined && page.next <= offset) throw new Error('Media library returned a repeated page cursor.');
    offset = page.next;
  }
  offset = 0;
  while (offset !== undefined) {
    await turn();
    const page = await options.loadIds(offset);
    page.ids.forEach((id) => ids.add(id));
    // Imports can retain an old modification timestamp; detect them by ID too.
    const missing = page.ids.filter((id) => !known.has(id));
    for (let at = 0; at < missing.length; at += 20) {
      await turn();
      await write(await options.loadMissing(missing.slice(at, at + 20)));
    }
    if (page.next !== undefined && page.next <= offset) throw new Error('Media library returned a repeated page cursor.');
    offset = page.next;
  }
  if (options.signal.aborted) throw new Error('Gallery sync cancelled.');
  await options.finish([...ids]);
  return count;
}
