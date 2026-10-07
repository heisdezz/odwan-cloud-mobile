type StringStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

/** Move each preference only once, after a successful write to its new store. */
export function migratePreferences(storage: StringStorage, legacy: StringStorage): StringStorage {
  const migrated = new Set<string>();
  const removeLegacy = (key: string) => {
    if (!migrated.has(key)) { legacy.removeItem(key); migrated.add(key); }
  };
  return {
    getItem: (key) => {
      const current = storage.getItem(key);
      if (current !== null) { migrated.add(key); return current; }
      if (migrated.has(key)) return null;
      const previous = legacy.getItem(key);
      if (previous !== null) {
        storage.setItem(key, previous);
        removeLegacy(key);
      }
      migrated.add(key);
      return previous;
    },
    setItem: (key, value) => { storage.setItem(key, value); removeLegacy(key); },
    removeItem: (key) => { storage.removeItem(key); removeLegacy(key); },
  };
}
