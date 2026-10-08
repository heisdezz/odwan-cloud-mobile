import type { LocalAsset } from '@/db/schema';

/** First paint comes from SQLite; the next load reconciles the actual album. */
export function createCachedAlbumLoader(options: {
  read: () => Promise<{ assets: LocalAsset[] } | null>;
  scan: (signal: AbortSignal) => Promise<LocalAsset[]>;
  save: (assets: LocalAsset[], signal: AbortSignal) => Promise<void>;
}) {
  let restored = false;
  let refreshNeeded = false;
  return {
    async load({ signal }: { signal: AbortSignal }) {
      if (!restored) {
        const cached = await options.read();
        if (signal.aborted) throw new Error('Album loading cancelled.');
        restored = true;
        if (cached) { refreshNeeded = true; return cached.assets; }
      }
      const assets = await options.scan(signal);
      if (signal.aborted) throw new Error('Album loading cancelled.');
      await options.save(assets, signal);
      return assets;
    },
    takeRefresh() {
      const needed = refreshNeeded;
      refreshNeeded = false;
      return needed;
    },
  };
}
