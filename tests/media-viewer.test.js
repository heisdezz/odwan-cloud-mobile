import { expect, test } from 'bun:test';
import { appendViewerItems, localViewerItem, matchesViewerScope, remoteViewerItem } from '../src/helpers/media-viewer';

const asset = (id) => localViewerItem({ id, uri: `content://media/${id}`, filename: `${id}.jpg`, mediaType: 'image', width: 100, height: 200 });
test('pagination preserves the viewed list order and skips duplicate records across pages', () => {
  const current = [asset('a'), asset('b')];
  const merged = appendViewerItems(current, [asset('b'), asset('c'), asset('c')]);
  expect(merged.map((item) => item.id)).toEqual(['a', 'b', 'c']);
  expect(merged[1]).toBe(current[1]);
  expect(current.length).toBe(2);
  expect(appendViewerItems(current, [asset('b')])).toBe(current);
});
test('server snapshots are rejected after logout, switching servers, accounts or connection revision', () => {
  const scope = { serverUrl: 'http://server', accountId: 'account', revision: 1 };
  const current = { verifiedUrl: scope.serverUrl, account: { id: scope.accountId }, revision: 1 };
  expect(matchesViewerScope(scope, current)).toBe(true);
  expect(matchesViewerScope(scope, { ...current, account: null })).toBe(false);
  expect(matchesViewerScope(scope, { ...current, account: { id: 'other' } })).toBe(false);
  expect(matchesViewerScope(scope, { ...current, verifiedUrl: 'http://other' })).toBe(false);
  expect(matchesViewerScope(scope, { ...current, revision: 2 })).toBe(false);
  expect(matchesViewerScope(undefined, { ...current, account: null })).toBe(true);
});
test('a successful database status alone does not make an incomplete upload playable', () => {
  const record = { id: 'a', original_relative_path: 'album/video.mp4', mime_type: 'video/mp4', metadata_json: '{"width":1080,"height":1920}', upload_status: 'success', storage_backend: 's3', storage_bucket: 'bucket', storage_key: '' };
  expect(remoteViewerItem(record)).toMatchObject({ available: false, video: true, name: 'video.mp4', width: 1080, height: 1920 });
  expect(remoteViewerItem({ ...record, storage_key: 'key' }).available).toBe(true);
  expect(remoteViewerItem({ ...record, metadata_json: 'invalid' }).width).toBe(0);
  expect(remoteViewerItem({ ...record, metadata_json: '{"width":"Infinity","height":-5}' })).toMatchObject({ width: 0, height: 0 });
});
