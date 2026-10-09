import { test, expect } from 'bun:test';
import { patchMovedMedia } from '../src/lib/server-media-move';

test('moving changes library membership without hiding media from the full library or target album', () => {
  const moved = { id: 'moved', album_id: 'source' }; const untouched = { id: 'other', album_id: 'source' };
  const page = { items: [moved, untouched] }; const otherPage = { items: [{ id: 'elsewhere' }] };
  const data = { pages: [page, otherPage], pageParams: [1, 2] }; const ids = new Set(['moved']);
  const home = patchMovedMedia(data, ids, 'target', null);
  expect(home.pages[0].items).toEqual([{ id: 'moved', album_id: 'target' }, untouched]);
  expect(home.pages[1]).toBe(otherPage);
  expect(patchMovedMedia(data, ids, 'target', 'source').pages[0].items).toEqual([untouched]);
  expect(patchMovedMedia(data, ids, 'target', 'target').pages[0].items).toHaveLength(2);
  expect(patchMovedMedia(data, new Set(['absent']), 'target', null)).toBe(data);
  expect(page.items[0]).toBe(moved);
  expect(home.pageParams).toBe(data.pageParams);
});
