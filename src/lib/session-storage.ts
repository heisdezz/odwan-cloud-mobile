import type { SessionStorage } from './session-vault';

// Web sessions survive a reload within this browser tab; SSR stores nothing.
export const sessionStorage: SessionStorage = {
  getItem: async (key) => typeof window === 'undefined' ? null : window.sessionStorage.getItem(key),
  setItem: async (key, value) => { if (typeof window !== 'undefined') window.sessionStorage.setItem(key, value); },
  removeItem: async (key) => { if (typeof window !== 'undefined') window.sessionStorage.removeItem(key); },
};
