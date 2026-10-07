import { expect, test } from 'bun:test';
import { createDatabaseAccess, retryDatabaseBusy } from '../src/db/database-access';
import { Database } from 'bun:sqlite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LOCAL_STORE_SCHEMA } from '../src/db/schema';

test('reads and writes share one initialization and never interleave transactions', async () => {
  let opened = 0, initialized = 0, active = 0, peak = 0;
  const access = createDatabaseAccess({ open: async () => { opened++; return {}; }, initialize: async () => { initialized++; }, close: async () => {} });
  const order = [];
  const job = (name) => access.run(async () => {
    peak = Math.max(peak, ++active); order.push(`${name}:start`);
    await Promise.resolve(); order.push(`${name}:end`); active--; return name;
  });
  expect(await Promise.all([job('write'), job('read'), job('write2')])).toEqual(['write', 'read', 'write2']);
  expect(order).toEqual(['write:start', 'write:end', 'read:start', 'read:end', 'write2:start', 'write2:end']);
  expect(peak).toBe(1); expect(opened).toBe(1); expect(initialized).toBe(1);
});
test('failed initialization closes its connection and a later open can recover', async () => {
  let opened = 0, closed = 0;
  const access = createDatabaseAccess({
    open: async () => { opened++; return {}; },
    initialize: async () => { if (opened === 1) throw new Error('initialization failed'); },
    close: async () => { closed++; },
  });
  await expect(access.run(async () => 'first')).rejects.toThrow('initialization failed');
  expect(await access.run(async () => 'recovered')).toBe('recovered');
  expect(opened).toBe(2); expect(closed).toBe(1);
  await expect(access.run(async () => { throw new Error('bad query'); })).rejects.toThrow('bad query');
  expect(await access.run(async () => 'queue still works')).toBe('queue still works');
});
test('a real SQLite write lock is retried after release and existing backup data survives', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'odwan-lock-'));
  const path = join(directory, 'db.sqlite');
  const writer = new Database(path), reader = new Database(path);
  try {
    writer.exec(LOCAL_STORE_SCHEMA);
    writer.run("INSERT INTO local_assets VALUES ('photo',1,'photo.jpg','content://photo','image',100,200,1,1)");
    writer.run("INSERT INTO backup_status VALUES ('photo',1,'server','account','backed_up','remote','hash',NULL,1)");
    writer.exec('BEGIN IMMEDIATE');
    let waits = 0;
    await retryDatabaseBusy(async () => reader.run("UPDATE local_assets SET last_seen_at=2"), async () => { waits++; writer.exec('ROLLBACK'); });
    expect(waits).toBe(1);
    expect(reader.query('SELECT status FROM backup_status').get().status).toBe('backed_up');
    expect(reader.query('SELECT last_seen_at FROM local_assets').get().last_seen_at).toBe(2);
  } finally { writer.close(); reader.close(); rmSync(directory, { recursive: true, force: true }); }
});
test('only transient locks are retried and permanent locks are bounded', async () => {
  let tries = 0;
  await expect(retryDatabaseBusy(async () => { tries++; throw new Error('database is locked'); }, async () => {})).rejects.toThrow('database is locked');
  expect(tries).toBe(4);
  tries = 0;
  await expect(retryDatabaseBusy(async () => { tries++; throw new Error('constraint failed'); }, async () => {})).rejects.toThrow('constraint failed');
  expect(tries).toBe(1);
});
