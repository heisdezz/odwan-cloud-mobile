import { expect, test } from 'bun:test';
import { QueryClient } from '@tanstack/react-query';
import { createMediaItemsSelector } from '../src/helpers/media-pages';

test('refresh with changed page totals preserves the grid data and unchanged tile records', () => {
  const client = new QueryClient();
  const select = createMediaItemsSelector();
  const key = ['media-items', 'refresh-test'];
  const original = { pages: [{ items: [{ id: 'a', filename: 'a.jpg' }, { id: 'b', filename: 'b.jpg' }], totalItems: 2 }], pageParams: [1] };
  client.setQueryData(key, original);
  const before = select(client.getQueryData(key).pages);
  client.setQueryData(key, { pages: [{ items: JSON.parse(JSON.stringify(original.pages[0].items)), totalItems: 3 }], pageParams: [1] });
  const after = select(client.getQueryData(key).pages);
  expect(after).toBe(before);
  expect(after[0]).toBe(before[0]);
  client.clear();
});

test('changed records update while unaffected tiles keep their identity', () => {
  const select = createMediaItemsSelector();
  const a = { id: 'a', filename: 'a.jpg' }, b = { id: 'b', filename: 'b.jpg' };
  const before = select([{ items: [a, b] }]);
  const changed = { ...b, filename: 'renamed.jpg' };
  const after = select([{ items: [a, changed] }]);
  expect(after).not.toBe(before);
  expect(after[0]).toBe(a);
  expect(after[1]).toBe(changed);
});

test('pagination deduplicates IDs and a new empty filter does not retain old records', () => {
  const select = createMediaItemsSelector();
  const a = { id: 'a' }, b = { id: 'b' }, updatedB = { id: 'b', filename: 'latest.jpg' }, c = { id: 'c' };
  expect(select([{ items: [a, b] }, { items: [updatedB, c] }])).toEqual([a, updatedB, c]);
  expect(select(undefined)).toEqual([]);
  const empty = select([]);
  expect(select([{ items: [] }])).toBe(empty);
});
