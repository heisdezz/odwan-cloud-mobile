/** Share concurrent requests and check disk on every new mount/session. Failed jobs remain retryable. */
export function createPersistentThumbnailCache(storage: { read: (key: string) => Promise<string | undefined> }) {
  const pending = new Map<string, Promise<string>>();
  return function get(key: string, generateAndSave: () => Promise<string>) {
    const existing = pending.get(key);
    if (existing) return existing;
    const request = (async () => (await storage.read(key)) ?? await generateAndSave())();
    pending.set(key, request);
    void request.finally(() => { if (pending.get(key) === request) pending.delete(key); }).catch(() => {});
    return request;
  };
}
