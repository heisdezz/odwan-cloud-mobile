import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

// A separate preferences database; restore before the first grid layout.
export const preferencesStorage: StateStorage = {
  getItem: (key) => Storage.getItemSync(key),
  setItem: (key, value) => Storage.setItemSync(key, value),
  removeItem: (key) => { Storage.removeItemSync(key); },
};
