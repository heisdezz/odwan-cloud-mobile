import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { deleteServerMedia, removeDeletedMedia } from '../src/lib/server-media-delete';
import { createMediaSelectionStore } from '../src/lib/media-selection';
import { RESET_REMOTE_BACKUPS_SQL } from '../src/db/remote-backup-reset';
import { LOCAL_STORE_TABLES } from '../src/db/schema';

test('deletion is sequential, deduplicated, and tracks progress and individual failures', async () => {
  let active = 0, maxActive = 0;
  const calls = [], progress = [];
  const result = await deleteServerMedia(['a', 'b', 'a', 'c'], async (id) => {
    calls.push(id); active++; maxActive = Math.max(maxActive, active);
    await Promise.resolve(); active--;
    if (id === 'b') throw new Error('permission denied');
  }, () => true, (done, total) => progress.push([done, total]));
  expect(calls).toEqual(['a', 'b', 'c']);
  expect(maxActive).toBe(1);
  expect(result.deleted).toEqual(['a', 'c']);
  expect(result.failed.map((failure) => failure.id)).toEqual(['b']);
  expect(progress).toEqual([[1, 3], [2, 3], [3, 3]]);
});

test('already deleted records succeed while auth and network failures are retained', async () => {
  const result = await deleteServerMedia(['missing', 'forbidden', 'offline'], async (id) => {
    throw Object.assign(new Error(id), { status: id === 'missing' ? 404 : id === 'forbidden' ? 403 : 0 });
  }, () => true);
  expect(result.deleted).toEqual(['missing']);
  expect(result.failed.map((failure) => failure.id)).toEqual(['forbidden', 'offline']);
});

test('changing the server session stops further deletion without losing confirmed results', async () => {
  let current = true;
  const calls = [];
  const result = await deleteServerMedia(['a', 'b'], async (id) => { calls.push(id); current = false; }, () => current);
  expect(calls).toEqual(['a']);
  expect(result.deleted).toEqual(['a']);
  expect(result.stopped).toBe(true);
});

test('cache removal preserves unrelated pages and never removes failed records', () => {
  const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' };
  const page1 = { items: [a, b] }, page2 = { items: [c] };
  const data = { pages: [page1, page2], pageParams: [1, 2] };
  const next = removeDeletedMedia(data, new Set(['a']));
  expect(next.pages[0].items).toEqual([b]);
  expect(next.pages[1]).toBe(page2);
  expect(next.pageParams).toBe(data.pageParams);
  expect(data.pages[0].items).toEqual([a, b]);
  expect(removeDeletedMedia(data, new Set(['absent']))).toBe(data);
});

test('selection toggles and failed items remain selected for retry', () => {
  const selection = createMediaSelectionStore();
  selection.getState().start('a');
  selection.getState().toggle('b');
  expect([...selection.getState().selected]).toEqual(['a', 'b']);
  selection.getState().remove(['a']);
  expect(selection.getState().selecting).toBe(true);
  expect([...selection.getState().selected]).toEqual(['b']);
  selection.getState().remove(['b']);
  expect(selection.getState().selecting).toBe(false);
  selection.getState().replace(['c', 'd', 'c']);
  expect(selection.getState().selected.size).toBe(2);
  selection.getState().clear();
  expect(selection.getState().selected.size).toBe(0);
});

test('deleted backup references reset only matching server/account records and preserve local originals', () => {
  const db = new Database(':memory:');
  db.exec(LOCAL_STORE_TABLES);
  db.run("INSERT INTO local_assets VALUES ('asset',1,'photo.jpg','file:///photo.jpg','image',100,100,1,1)");
  const insert = db.prepare("INSERT INTO backup_status VALUES ('asset',1,?,?,'backed_up',?,'hash',NULL,1)");
  insert.run('server-one', 'account-one', 'deleted');
  insert.run('server-two', 'account-one', 'deleted');
  insert.run('server-one', 'account-two', 'deleted');
  db.run(RESET_REMOTE_BACKUPS_SQL, 10, 'server-one', 'account-one', JSON.stringify(['deleted']));
  const row = db.query("SELECT status,remote_id,file_hash FROM backup_status WHERE server_url='server-one' AND account_id='account-one'").get();
  expect(row).toEqual({ status: 'pending', remote_id: null, file_hash: null });
  expect(db.query("SELECT COUNT(*) AS count FROM backup_status WHERE status='backed_up'").get().count).toBe(2);
  expect(db.query('SELECT COUNT(*) AS count FROM local_assets').get().count).toBe(1);
  db.close();
});
