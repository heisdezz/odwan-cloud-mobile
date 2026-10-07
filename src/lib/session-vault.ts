import { normalizeServerUrl } from './server-connection';

export type SavedSession = {
  token: string;
  account: { id: string; email: string };
};
export type SessionStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

/** Serializes per-server writes so a pending save cannot undo logout. */
export function createSessionVault(storage: SessionStorage) {
  const writes = new Map<string, Promise<void>>();
  const keyFor = (url: string) => 'odwan.session.' + Array.from(normalizeServerUrl(url))
    .map((character) => character.codePointAt(0)!.toString(16)).join('-');
  const write = (key: string, action: () => Promise<void>) => {
    const next = (writes.get(key) ?? Promise.resolve()).catch(() => {}).then(action);
    writes.set(key, next);
    void next.finally(() => { if (writes.get(key) === next) writes.delete(key); }).catch(() => {});
    return next;
  };
  return {
    async read(url: string): Promise<SavedSession | null> {
      const key = keyFor(url);
      await writes.get(key)?.catch(() => {});
      const value = await storage.getItem(key);
      if (!value) return null;
      try {
        const session = JSON.parse(value) as SavedSession;
        if (typeof session.token === 'string' && session.token &&
          typeof session.account?.id === 'string' && session.account.id &&
          typeof session.account.email === 'string') return session;
      } catch { /* Discard corrupt values rather than blocking startup. */ }
      await write(key, async () => { if (await storage.getItem(key) === value) await storage.removeItem(key); });
      return null;
    },
    save: (url: string, session: SavedSession, current: () => boolean = () => true) =>
      write(keyFor(url), async () => { if (current()) await storage.setItem(keyFor(url), JSON.stringify(session)); }),
    remove: (url: string, current: () => boolean = () => true) =>
      write(keyFor(url), async () => { if (current()) await storage.removeItem(keyFor(url)); }),
  };
}
