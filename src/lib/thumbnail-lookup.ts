/** Bounded URI lookup only: decoded images remain managed by expo-image. */
export function createThumbnailLookup(limit = 512) {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Thumbnail lookup limit must be a positive integer.');
  const resident = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();
  return {
    clear() { resident.clear(); pending.clear(); },
    get(identity: string, load: () => Promise<string>): Promise<string> {
      const uri = resident.get(identity);
      if (uri) {
        resident.delete(identity); resident.set(identity, uri);
        return Promise.resolve(uri);
      }
      const existing = pending.get(identity);
      if (existing) return existing;
      const request = Promise.resolve().then(load).then((value) => {
        if (pending.get(identity) === request) {
          resident.set(identity, value);
          while (resident.size > limit) resident.delete(resident.keys().next().value!);
        }
        return value;
      }).finally(() => { if (pending.get(identity) === request) pending.delete(identity); });
      pending.set(identity, request);
      return request;
    },
    invalidate(uri: string) {
      for (const [key, value] of resident) if (value === uri) resident.delete(key);
    },
  };
}
