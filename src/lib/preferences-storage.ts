import type { StateStorage } from 'zustand/middleware';

// Browser storage is unavailable while Expo statically renders routes.
export const preferencesStorage: StateStorage = {
  getItem: (key) => typeof localStorage === 'undefined' ? null : localStorage.getItem(key),
  setItem: (key, value) => { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); },
  removeItem: (key) => { if (typeof localStorage !== 'undefined') localStorage.removeItem(key); },
};
