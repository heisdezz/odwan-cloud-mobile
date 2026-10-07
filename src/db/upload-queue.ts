import type { BackupScope } from './schema';
import type { UploadJob, UploadResult } from '@/lib/upload-types';

type Database = {
  runAsync: (sql: string, ...params: (string | number | null)[]) => Promise<unknown>;
  getAllAsync: <T>(sql: string, ...params: (string | number | null)[]) => Promise<T[]>;
};
type Row = Omit<UploadJob, 'asset' | 'result'> & { asset: string; result: string | null };
const decode = (row: Row): UploadJob => ({ ...row, asset: JSON.parse(row.asset), result: row.result ? JSON.parse(row.result) : null });
const COLUMNS = `id, server_url AS serverUrl, account_id AS accountId, asset_json AS asset,
  album_id AS albumId, album_name AS albumName, object_key AS objectKey, state,
  result_json AS result, error, created_at AS createdAt`;
const SELECT = `SELECT ${COLUMNS} FROM upload_queue`;

export function createUploadRepository(run: <T>(task: (db: Database) => Promise<T>) => Promise<T>) {
  return {
    async enqueue(jobs: UploadJob[]) {
      if (!jobs.length) return;
      // One native write, regardless of how many items are selected.
      await run((db) => db.runAsync(`INSERT OR IGNORE INTO upload_queue
        (id,server_url,account_id,asset_id,modified_at,asset_json,album_id,album_name,object_key,state,result_json,error,created_at)
        SELECT json_extract(value,'$.id'),json_extract(value,'$.serverUrl'),json_extract(value,'$.accountId'),
          json_extract(value,'$.asset.id'),json_extract(value,'$.asset.modifiedAt'),json_extract(value,'$.asset'),
          json_extract(value,'$.albumId'),json_extract(value,'$.albumName'),json_extract(value,'$.objectKey'),
          'queued',NULL,NULL,json_extract(value,'$.createdAt') FROM json_each(?)`, JSON.stringify(jobs)));
    },
    async list(scope: BackupScope): Promise<UploadJob[]> {
      const rows = await run((db) => db.getAllAsync<Row>(`${SELECT} WHERE server_url=? AND account_id=? ORDER BY rowid`, scope.serverUrl, scope.accountId));
      return rows.map(decode);
    },
    async claim(scope: BackupScope): Promise<UploadJob | null> {
      const rows = await run((db) => db.getAllAsync<Row>(`UPDATE upload_queue
        SET state=CASE WHEN result_json IS NULL THEN 'uploading' ELSE 'organizing' END
        WHERE id=(SELECT id FROM upload_queue WHERE server_url=? AND account_id=? AND state='queued' ORDER BY rowid LIMIT 1)
        AND state='queued' RETURNING ${COLUMNS}`, scope.serverUrl, scope.accountId));
      return rows[0] ? decode(rows[0]) : null;
    },
    async update(id: string, state: UploadJob['state'], result?: UploadResult, error: string | null = null) {
      await run((db) => db.runAsync('UPDATE upload_queue SET state=?, result_json=COALESCE(?,result_json), error=? WHERE id=?', state, result ? JSON.stringify(result) : null, error, id));
    },
    async recover() {
      await run((db) => db.runAsync("UPDATE upload_queue SET state='queued' WHERE state IN ('uploading','organizing')"));
    },
    async retry(scope: BackupScope) {
      await run((db) => db.runAsync("UPDATE upload_queue SET state='queued',error=NULL WHERE server_url=? AND account_id=? AND state='error'", scope.serverUrl, scope.accountId));
    },
    async remove(id: string) {
      await run((db) => db.runAsync("DELETE FROM upload_queue WHERE id=? AND state IN ('queued','error','success')", id));
    },
    async clearCompleted(scope: BackupScope) {
      await run((db) => db.runAsync("DELETE FROM upload_queue WHERE server_url=? AND account_id=? AND state='success'", scope.serverUrl, scope.accountId));
    },
  };
}
export type UploadRepository = ReturnType<typeof createUploadRepository>;
