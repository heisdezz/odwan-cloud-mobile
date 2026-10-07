/** SQLite BUSY/LOCKED are transient; schema/validation failures must still surface. */
export function isDatabaseBusy(error: unknown): boolean {
  if (typeof error === 'string') return /database (?:is )?(?:locked|busy)|SQLITE_(?:BUSY|LOCKED)/i.test(error);
  if (!error || typeof error !== 'object') return false;
  const value = error as { message?: unknown; code?: unknown; cause?: unknown };
  return /database (?:is )?(?:locked|busy)|SQLITE_(?:BUSY|LOCKED)/i.test(String(value.message ?? ''))
    || value.code === 5 || value.code === 6 || value.code === 'SQLITE_BUSY' || value.code === 'SQLITE_LOCKED'
    || (!!value.cause && value.cause !== error && isDatabaseBusy(value.cause));
}
export async function retryDatabaseBusy<T>(task: () => Promise<T>, wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))): Promise<T> {
  const delays = [100, 250, 500];
  for (let attempt = 0; ; attempt++) {
    try { return await task(); }
    catch (error) {
      if (!isDatabaseBusy(error) || attempt >= delays.length) throw error;
      await wait(delays[attempt]);
    }
  }
}
/** A single initialized connection and an ordered queue, including reads and transactions. */
export function createDatabaseAccess<T>(options: { open: () => Promise<T>; initialize: (db: T) => Promise<void>; close: (db: T) => Promise<void> }) {
  let opening: Promise<T> | undefined;
  let tail: Promise<unknown> = Promise.resolve();
  async function get() {
    opening ??= (async () => {
      const db = await options.open();
      try { await retryDatabaseBusy(() => options.initialize(db)); return db; }
      catch (error) { await options.close(db).catch(() => {}); throw error; }
    })().catch((error) => { opening = undefined; throw error; });
    return opening;
  }
  return {
    run<R>(task: (db: T) => Promise<R>): Promise<R> {
      const request = tail.then(async () => { const db = await get(); return retryDatabaseBusy(() => task(db)); });
      tail = request.catch(() => {});
      return request;
    },
  };
}
