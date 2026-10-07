import { expect, test } from 'bun:test';
import { createGridVisibilityStore, updateGridVisibility } from '../src/lib/grid-visibility';
import { gridWindow } from '../src/helpers/grid-zoom';

test('scrolling inside a row does not publish a new thumbnail window', () => {
  const store = createGridVisibilityStore(gridWindow(100, 4, 400, 400, 10));
  const initial = store.getState();
  let updates = 0;
  store.subscribe(() => updates++);
  for (let y = 11; y < 99; y++) updateGridVisibility(store, gridWindow(100, 4, 400, 400, y));
  expect(store.getState()).toBe(initial);
  expect(updates).toBe(0);
});

test('only cells crossing the buffered boundary need a new preview state', () => {
  const store = createGridVisibilityStore({ first: 0, last: 23 });
  const updates = [];
  for (const index of [0, 12, 24]) store.subscribe((range) => index >= range.first && index <= range.last,
    (enabled) => updates.push({ index, enabled }));
  updateGridVisibility(store, { first: 4, last: 27 });
  expect(updates).toEqual([{ index: 0, enabled: false }, { index: 24, enabled: true }]);
  updateGridVisibility(store, { first: 0, last: 3 });
  expect(updates.slice(2)).toEqual([{ index: 0, enabled: true }, { index: 12, enabled: false }, { index: 24, enabled: false }]);
});
