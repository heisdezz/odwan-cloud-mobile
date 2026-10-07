import { createStore } from 'zustand/vanilla';
import { subscribeWithSelector } from 'zustand/middleware';

export type GridRange = { first: number; last: number };
export const createGridVisibilityStore = (initial: GridRange) => createStore(subscribeWithSelector(() => initial));
export type GridVisibilityStore = ReturnType<typeof createGridVisibilityStore>;
export function updateGridVisibility(store: GridVisibilityStore, next: GridRange) {
  const current = store.getState();
  if (current.first !== next.first || current.last !== next.last) store.setState(next);
}
