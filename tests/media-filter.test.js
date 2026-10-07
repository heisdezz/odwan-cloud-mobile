import { expect, test } from 'bun:test';
import PocketBase from 'pocketbase';
import { matchesMediaFilter, mediaMimePattern } from '../src/helpers/media-filter';
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
