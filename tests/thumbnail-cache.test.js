import { expect, test } from 'bun:test';
import { createPersistentThumbnailCache } from '../src/lib/persistent-thumbnail-cache';
import { thumbnailDimensions, thumbnailIdentity } from '../src/helpers/thumbnail';

test('preview dimensions stay within 256px without stretching or upscaling', () => {
  expect(thumbnailDimensions(1920, 1080)).toEqual({ width: 256, height: 144 });
  expect(thumbnailDimensions(1080, 1920)).toEqual({ width: 144, height: 256 });
  expect(thumbnailDimensions(800, 800)).toEqual({ width: 256, height: 256 });
  expect(thumbnailDimensions(80, 60)).toEqual({ width: 80, height: 60 });
  expect(() => thumbnailDimensions(0, 1080)).toThrow();
  expect(() => thumbnailDimensions(Infinity, 1080)).toThrow();
});
test('concurrent cells generate once and a new cache instance reuses persisted output', async () => {
  const disk = new Map();
  const storage = { read: async (key) => disk.get(key) };
  let count = 0;
  const generate = async () => { count++; await Promise.resolve(); disk.set('media-v1', 'file:///thumbnail.jpg'); return 'file:///thumbnail.jpg'; };
  const firstSession = createPersistentThumbnailCache(storage);
  expect(await Promise.all([firstSession('media-v1', generate), firstSession('media-v1', generate)])).toEqual(['file:///thumbnail.jpg', 'file:///thumbnail.jpg']);
  expect(count).toBe(1);
  const afterRestart = createPersistentThumbnailCache(storage);
  expect(await afterRestart('media-v1', generate)).toBe('file:///thumbnail.jpg');
  expect(count).toBe(1);
  disk.delete('media-v1');
  await afterRestart('media-v1', generate);
  expect(count).toBe(2);
});
test('failed generation can be retried and media versions/accounts have separate identities', async () => {
  const cache = createPersistentThumbnailCache({ read: async () => undefined });
  await expect(cache('failed', async () => { throw new Error('decode failed'); })).rejects.toThrow('decode failed');
  expect(await cache('failed', async () => 'file:///fixed.jpg')).toBe('file:///fixed.jpg');
  const key = ['remote', 'http://server', 'account', 'record', 'hash'];
  expect(thumbnailIdentity(key)).not.toBe(thumbnailIdentity([...key.slice(0, -1), 'changed-hash']));
  expect(thumbnailIdentity(key)).not.toBe(thumbnailIdentity(['remote', 'http://server', 'other-account', 'record', 'hash']));
  expect(thumbnailIdentity(['local', 'asset', 1])).not.toBe(thumbnailIdentity(['local', 'asset', 2]));
});
