import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';
import { nativeMMKV } from './mmkv.native';
import { migratePreferences } from './migrate-preferences';

const legacy = {
  getItem: (key: string) => Storage.getItemSync(key),
  setItem: (key: string, value: string) => Storage.setItemSync(key, value),
  removeItem: (key: string) => { Storage.removeItemSync(key); },
};

const mmkv = nativeMMKV?.preferences;
// Migrate saved server/grid/viewer preferences; Expo Go continues using SQLite.
export const preferencesStorage: StateStorage = mmkv ? migratePreferences({
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => { mmkv.remove(key); },
}, legacy) : legacy;
