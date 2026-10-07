import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { UPSERT_LOCAL_ASSET_SQL, UPSERT_BACKUP_STATUS_SQL } from '../src/db/queries';
import { LOCAL_STORE_SCHEMA } from '../src/db/schema';

test('backup records survive reopening and remain scoped to asset version and account', () => {
  const directory = mkdtempSync(join(tmpdir(), 'odwan-sqlite-'));
  const path = join(directory, 'test.db');
  let db = new Database(path);
  try {
    db.exec(LOCAL_STORE_SCHEMA);
    db.run("INSERT INTO local_assets VALUES ('photo',1,'photo.jpg','content://photo','image',100,200,1,1)");
    db.run("INSERT INTO local_assets VALUES ('photo',2,'photo.jpg','content://photo','image',100,200,1,2)");
    db.run("INSERT INTO backup_status VALUES ('photo',1,'https://server','account','backed_up','remote','hash',NULL,1)");
    db.close();
    db = new Database(path);
    db.exec(LOCAL_STORE_SCHEMA);
    expect(db.query('SELECT status FROM backup_status').get()).toEqual({ status: 'backed_up' });
    expect(db.query('SELECT status FROM backup_status WHERE modified_at=2').get()).toBeNull();
    expect(db.query("SELECT status FROM backup_status WHERE account_id='other'").get()).toBeNull();
    expect(db.query("SELECT status FROM backup_status WHERE server_url='https://other'").get()).toBeNull();
  } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('database rejects unconfirmed backups and orphaned assets', () => {
  const db = new Database(':memory:');
  try {
    db.exec(LOCAL_STORE_SCHEMA);
    db.run("INSERT INTO local_assets VALUES ('photo',1,'photo.jpg','content://photo','image',100,200,1,1)");
    expect(() => db.run("INSERT INTO backup_status VALUES ('photo',1,'server','account','backed_up',NULL,NULL,NULL,1)")).toThrow();
    expect(() => db.run("INSERT INTO backup_status VALUES ('missing',1,'server','account','pending',NULL,NULL,NULL,1)")).toThrow();
  } finally { db.close(); }
});


test('the app prepared inserts bind nine values and preserve backups when an asset is refreshed', () => {
  const db = new Database(':memory:');
  try {
    db.exec(LOCAL_STORE_SCHEMA);
    const assets = db.prepare(UPSERT_LOCAL_ASSET_SQL);
    const backups = db.prepare(UPSERT_BACKUP_STATUS_SQL);
    assets.run('photo', 1, 'photo.jpg', 'content://old', 'image', 100, 200, 1, 10);
    backups.run('photo', 1, 'server', 'account', 'backed_up', 'remote', 'hash', null, 10);
    assets.run('photo', 1, 'renamed.jpg', 'content://new', 'image', 300, 400, 1, 20);
    expect(db.query('SELECT filename, uri, width, height, last_seen_at FROM local_assets').get()).toEqual({
      filename: 'renamed.jpg', uri: 'content://new', width: 300, height: 400, last_seen_at: 20,
    });
    expect(db.query('SELECT status, remote_id, file_hash FROM backup_status').get()).toEqual({
      status: 'backed_up', remote_id: 'remote', file_hash: 'hash',
    });
    assets.run('photo', 2, 'renamed.jpg', 'content://new', 'image', 300, 400, 1, 30);
    expect(db.query('SELECT COUNT(*) AS count FROM local_assets').get().count).toBe(2);
    backups.run('photo', 2, 'server', 'account', 'pending', null, null, null, 30);
    expect(db.query('SELECT status FROM backup_status WHERE modified_at=2').get().status).toBe('pending');
  } finally { db.close(); }
});
