import { expect, test } from 'bun:test';
import PocketBase from 'pocketbase';
import { indexMediaFilters, matchesMediaFilter, mediaMimePattern } from '../src/helpers/media-filter';

test('indexed filters preserve album ordering, object identity and the unfiltered snapshot', () => {
  const items = [
    { id: '1', type: 'video' }, { id: '2', type: 'photo' },
    { id: '3', type: 'image/jpeg' }, { id: '4', type: 'video/mp4' },
    { id: '5', type: 'audio/mp3' },
  ];
  const indexed = indexMediaFilters(items, (item) => item.type);
  expect(indexed.all).toBe(items);
  expect(indexed.images).toEqual([items[1], items[2]]);
  expect(indexed.videos).toEqual([items[0], items[3]]);
  expect(indexed.images[0]).toBe(items[1]);
  expect(indexMediaFilters([], (item) => item.type)).toEqual({ all: [], images: [], videos: [] });
});
import { createGridStore } from '../src/stores/grid-store';

test('filters recognize device photo types and server MIME types', () => {
  const types = ['photo', 'image', 'image/jpeg', 'image/heic', 'video', 'video/mp4', 'audio/mp3'];
  expect(types.filter((type) => matchesMediaFilter(type, 'images'))).toEqual(types.slice(0, 4));
  expect(types.filter((type) => matchesMediaFilter(type, 'videos'))).toEqual(['video', 'video/mp4']);
  expect(types.filter((type) => matchesMediaFilter(type, 'all'))).toEqual(types);
  const client = new PocketBase();
  expect(client.filter('mime_type ~ {:mime}', { mime: mediaMimePattern('videos') })).toBe('mime_type ~ "video/%"');
  expect(mediaMimePattern('all')).toBeUndefined();
});

test('media selection persists without overwriting column density and handles old preferences', () => {
  let saved = JSON.stringify({ state: { columns: 5 }, version: 0 });
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; }, removeItem: () => {} };
  const store = createGridStore(storage);
  expect(store.getState().mediaFilter).toBe('all');
  store.getState().setMediaFilter('videos');
  const next = createGridStore(storage);
  expect(next.getState().mediaFilter).toBe('videos');
  expect(next.getState().columns).toBe(5);
  saved = JSON.stringify({ state: { columns: 3, mediaFilter: 'invalid' }, version: 0 });
  expect(createGridStore(storage).getState().mediaFilter).toBe('all');
});
