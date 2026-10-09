import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { galleryDay, galleryMonths, mediaDate } from '../src/helpers/media-timeline';
import { LOCAL_STORE_TABLES, GALLERY_INDEX_MIGRATION } from '../src/db/schema';
import { READ_BACKUP_SUMMARY_SQL } from '../src/db/backup-summary';
import { TRASH_REMOTE_BACKUPS_SQL, RESTORE_REMOTE_BACKUPS_SQL, RESET_REMOTE_BACKUPS_SQL } from '../src/db/remote-backup-reset';
import { createTaskQueue } from '../src/lib/task-queue';
import { createThumbnailLookup } from '../src/lib/thumbnail-lookup';
import { deleteServerMedia } from '../src/lib/server-media-delete';

test('month jumps use the first item of each month and skip invalid dates', () => {
  const dates = [new Date(2026, 9, 9).getTime(), new Date(2026, 9, 2).getTime(), undefined, new Date(2026, 8, 1).getTime()];
  expect(galleryMonths(dates, (date) => date).map((month) => month.index)).toEqual([0, 3]);
  expect(mediaDate('invalid')).toBeNull();
  expect(galleryDay(0)).toBe('');
});

test('backup summary and trash restoration respect device version and server scope', () => {
  const db = new Database(':memory:'); db.exec(LOCAL_STORE_TABLES + GALLERY_INDEX_MIGRATION);
  db.run("INSERT INTO gallery_index VALUES ('asset',2,'scan')");
  db.run("INSERT INTO gallery_index VALUES ('other',1,'scan')");
  const insert = db.prepare("INSERT INTO backup_status VALUES ('asset',?,?,?,'backed_up',?,'hash',NULL,1)");
  insert.run(1,'server','account','old'); insert.run(2,'server','account','current'); insert.run(2,'other-server','account','current');
  expect(db.query(READ_BACKUP_SUMMARY_SQL).get('server','account')).toEqual({ total: 2, backedUp: 1 });
  db.run(TRASH_REMOTE_BACKUPS_SQL, 10,'server','account',JSON.stringify(['current']));
  expect(db.query(READ_BACKUP_SUMMARY_SQL).get('server','account').backedUp).toBe(0);
  expect(db.query("SELECT remote_id,file_hash FROM backup_status WHERE server_url='server' AND modified_at=2").get()).toEqual({ remote_id:'current', file_hash:'hash' });
  db.run(RESTORE_REMOTE_BACKUPS_SQL, 11,'server','account',JSON.stringify(['current']));
  expect(db.query(READ_BACKUP_SUMMARY_SQL).get('server','account').backedUp).toBe(1);
  db.run(RESET_REMOTE_BACKUPS_SQL, 12,'server','account',JSON.stringify(['current']));
  db.run(RESTORE_REMOTE_BACKUPS_SQL, 13,'server','account',JSON.stringify(['current']));
  expect(db.query(READ_BACKUP_SUMMARY_SQL).get('server','account').backedUp).toBe(0);
  expect(db.query(READ_BACKUP_SUMMARY_SQL).get('other-server','account').backedUp).toBe(1);
  db.close();
});

test('cache clearing waits for started work without starting paused queued work', async () => {
  const queue = createTaskQueue(1); let finish; let nextStarted = false;
  const started = queue(() => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve(); queue.setPaused(true);
  const next = queue(async () => { nextStarted = true; });
  let idle = false; const waited = queue.whenIdle().then(() => { idle = true; });
  await Promise.resolve(); expect(idle).toBe(false);
  finish(); await started; await waited;
  expect(nextStarted).toBe(false);
  queue.setPaused(false); await next; expect(nextStarted).toBe(true);
});

test('in-flight thumbnail lookup cannot repopulate memory after cache clear', async () => {
  const cache = createThumbnailLookup(); let finish;
  const started = cache.get('photo', () => new Promise((resolve) => { finish = resolve; }));
  await Promise.resolve(); cache.clear(); finish('deleted.jpg'); await started;
  expect(await cache.get('photo', async () => 'regenerated.jpg')).toBe('regenerated.jpg');
});

test('unsupported custom trash endpoints must not be reported as successful deletion', async () => {
  const result = await deleteServerMedia(['photo'], async () => { throw { status: 404 }; }, () => true, () => {}, false);
  expect(result.deleted).toEqual([]); expect(result.failed).toHaveLength(1);
});
