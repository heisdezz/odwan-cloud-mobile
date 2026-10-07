import { expect, test } from 'bun:test';
import { createGridStore } from '../src/stores/grid-store';

function memoryStorage(value = null) {
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next; },
    removeItem: () => { value = null; },
  };
}

test('grid density survives a new store instance and restores before rendering', () => {
  const storage = memoryStorage();
  const first = createGridStore(storage);
  expect(first.getState().columns).toBeNull();
  first.getState().setColumns(5);
  const reopened = createGridStore(storage);
  expect(reopened.persist.hasHydrated()).toBe(true);
  expect(reopened.getState().columns).toBe(5);
  reopened.getState().setColumns(4);
  expect(createGridStore(storage).getState().columns).toBe(4);
});

test('invalid persisted grid densities cannot break the list layout', () => {
  const stored = (columns) => memoryStorage(JSON.stringify({ state: { columns }, version: 0 }));
  expect(createGridStore(stored(99)).getState().columns).toBe(6);
  expect(createGridStore(stored(-1)).getState().columns).toBe(2);
  const store = createGridStore(stored('bad'));
  expect(store.getState().columns).toBeNull();
  store.getState().setColumns(4);
  store.getState().setColumns(NaN);
  expect(store.getState().columns).toBe(4);
});
