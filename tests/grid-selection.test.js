import { expect, test } from 'bun:test';
import { gridRangeSelection, gridSelectionIndex } from '../src/helpers/grid-selection';
import { thumbnailEvictions } from '../src/helpers/thumbnail-eviction';

const items = Array.from({ length: 10 }, (_, id) => ({ id: String(id) }));
const key = (item) => item.id;

test('drag hit testing respects padding, scrolling and incomplete final rows', () => {
  expect(gridSelectionIndex(10, 3, 300, 0, 50, 10, 20)).toBe(-1);
  expect(gridSelectionIndex(10, 3, 300, 100, 150, 30, 20)).toBe(4);
  expect(gridSelectionIndex(10, 3, 300, 0, 50, 350, 20)).toBe(9);
  expect(gridSelectionIndex(10, 3, 300, 0, 150, 350, 20)).toBe(-1);
  expect(gridSelectionIndex(10, 3, 300, 0, -1, 30, 20)).toBe(-1);
});

test('dragging forwards and backwards restores the starting selection outside the current range', () => {
  const base = new Set(['0', '8']);
  expect([...gridRangeSelection(items, key, base, 3, 6, true)]).toEqual(['0', '8', '3', '4', '5', '6']);
  expect([...gridRangeSelection(items, key, base, 3, 4, true)]).toEqual(['0', '8', '3', '4']);
  expect([...gridRangeSelection(items, key, base, 3, 1, true)]).toEqual(['0', '8', '1', '2', '3']);
  expect([...base]).toEqual(['0', '8']);
});

test('starting from a selected item removes a range without losing unrelated selections', () => {
  const base = new Set(['0', '1', '2', '3', '8']);
  expect([...gridRangeSelection(items, key, base, 1, 3, false)]).toEqual(['0', '8']);
  expect([...gridRangeSelection(items, key, base, 1, 1, false)]).toEqual(['0', '2', '3', '8']);
});

test('cache eviction removes the oldest unprotected previews until the budget is met', () => {
  const entries = [
    { uri: 'visible', bytes: 40, accessedAt: 0 },
    { uri: 'new', bytes: 30, accessedAt: 20 },
    { uri: 'old', bytes: 30, accessedAt: 10 },
  ];
  expect(thumbnailEvictions(entries, 70, new Set(['visible']))).toEqual(['old']);
  expect(thumbnailEvictions(entries, 20, new Set(['visible']))).toEqual(['old', 'new']);
  expect(thumbnailEvictions(entries, 100, new Set())).toEqual([]);
  expect(entries.map((entry) => entry.uri)).toEqual(['visible', 'new', 'old']);
});

import { galleryDateIndices } from '../src/helpers/media-timeline';

test('calendar selection includes the chosen day or month without crossing year boundaries', () => {
  const data = ['2026-10-10T12:00:00', '2026-10-10T13:00:00', '2026-10-09T12:00:00', '2025-10-10T12:00:00', undefined];
  expect(galleryDateIndices(data, (value) => value, 0, 'day')).toEqual([0, 1]);
  expect(galleryDateIndices(data, (value) => value, 0, 'month')).toEqual([0, 1, 2]);
  expect(galleryDateIndices(data, (value) => value, 4, 'day')).toEqual([]);
});
