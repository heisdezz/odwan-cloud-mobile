import type { LocalAsset } from './schema';
import { BULK_INDEXED_ASSETS_SQL, BULK_GALLERY_INDEX_SQL } from './queries';

/** Two bound bulk writes on the native SQLite worker, regardless of page size. */
export async function writeGalleryBatch(db: {
  runAsync: (sql: string, ...params: (string | number)[]) => Promise<unknown>;
  withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
}, assets: LocalAsset[], scanId: string, now = Date.now()) {
  if (!assets.length) return;
  const payload = JSON.stringify(assets);
  await db.withTransactionAsync(async () => {
    await db.runAsync(BULK_INDEXED_ASSETS_SQL, now, payload);
    await db.runAsync(BULK_GALLERY_INDEX_SQL, scanId, payload);
  });
}
