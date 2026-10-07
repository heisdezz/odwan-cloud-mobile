import type { LocalAsset } from '@/db/schema';
import { waitForGalleryIdle } from './gallery-scheduler';

/** Only a complete, uncancelled scan can remove unseen gallery entries. */
export async function scanGallery<Cursor>(options: {
  initialCursor: Cursor;
  signal: AbortSignal;
  load: (cursor: Cursor) => Promise<{ assets: LocalAsset[]; next?: Cursor }>;
  write: (assets: LocalAsset[]) => Promise<unknown>;
  finish: () => Promise<unknown>;
  onPage?: (count: number) => void;
  waitForTurn?: () => Promise<void>;
}) {
  let cursor: Cursor | undefined = options.initialCursor;
  let count = 0;
  const visited = new Set<Cursor>();
  while (cursor !== undefined) {
    if (options.signal.aborted) throw new Error('Gallery sync cancelled.');
    await (options.waitForTurn?.() ?? waitForGalleryIdle(options.signal));
    if (options.signal.aborted) throw new Error('Gallery sync cancelled.');
    if (visited.has(cursor)) throw new Error('Media library returned a repeated page cursor.');
    visited.add(cursor);
    const page = await options.load(cursor);
    if (options.signal.aborted) throw new Error('Gallery sync cancelled.');
    await options.write(page.assets);
    count += page.assets.length;
    options.onPage?.(count);
    cursor = page.next;
  }
  if (options.signal.aborted) throw new Error('Gallery sync cancelled.');
  await options.finish();
  return count;
}
