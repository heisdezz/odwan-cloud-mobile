import { extract_message } from '@/helpers/api';
import type { BackupScope } from '@/db/schema';
import type { UploadRepository } from '@/db/upload-queue';
import { UploadConnectionError, UploadError, type UploadJob, type UploadResult } from './upload-types';

/** One worker survives repeated wakeups; confirmed bytes are never resent for an album retry. */
export function createUploadWorker(options: {
  repository: UploadRepository;
  scope: () => BackupScope | null;
  upload: (job: UploadJob, signal: AbortSignal) => Promise<UploadResult>;
  organize: (job: UploadJob, result: UploadResult, signal: AbortSignal) => Promise<void>;
  confirm: (job: UploadJob, result: UploadResult) => Promise<void>;
  status?: (job: UploadJob, state: 'pending' | 'uploading' | 'error', error?: string) => Promise<void>;
  changed: () => void;
  connectionLost?: (job: UploadJob) => void;
  completed?: (job: UploadJob) => void;
}) {
  let running: Promise<void> | null = null;
  let controller: AbortController | null = null;
  let requested = false;
  let epoch = 0;
  const pump = async () => {
    const generation = epoch;
    let blocked = false;
    do {
      requested = false;
      const scope = options.scope();
      if (!scope) return;
      const job = await options.repository.claim(scope);
      if (!job) return;
      controller = new AbortController();
      const signal = controller.signal;
      const current = () => {
        const active = options.scope();
        return generation === epoch && !signal.aborted && active?.serverUrl === job.serverUrl && active.accountId === job.accountId;
      };
      // Scope can change while SQLite is reading the next entry.
      try {
        if (!current()) { await options.repository.update(job.id, 'queued'); return; }
        options.changed();
        await options.status?.(job, 'uploading');
        if (!current()) { await options.repository.update(job.id, 'queued'); await options.status?.(job, 'pending'); return; }
        let result = job.result;
        if (!result) {
          result = await options.upload(job, signal);
          await options.repository.update(job.id, 'organizing', result); options.changed();
        }
        if (!current()) { await options.repository.update(job.id, 'queued'); await options.status?.(job, 'pending'); return; }
        await options.confirm(job, result);
        if (!current()) { await options.repository.update(job.id, 'queued'); return; }
        await options.organize(job, result, signal);
        if (!current()) { await options.repository.update(job.id, 'queued'); await options.status?.(job, 'pending'); return; }
        await options.repository.update(job.id, 'success', result);
        options.completed?.(job);
      } catch (error) {
        if (!current()) { await options.repository.update(job.id, 'queued'); await options.status?.(job, 'pending'); }
        else if (error instanceof UploadConnectionError) {
          await options.repository.update(job.id, 'queued');
          await options.status?.(job, 'pending');
          blocked = true;
          options.connectionLost?.(job);
        }
        else {
          await options.repository.update(job.id, 'error', undefined, extract_message(error));
          await options.status?.(job, 'error', extract_message(error));
          blocked = !(error instanceof UploadError) || [401,403,503].includes(error.status);
        }
      } finally { controller = null; options.changed(); }
      if (blocked) return;
    } while (options.scope());
  };
  const worker: { wake: () => Promise<void>; stop: () => void } = {
    wake() {
      requested = true;
      if (!running) {
        running = pump().finally(() => {
          running = null;
          if (requested) void worker.wake().catch(() => {});
        });
      }
      return running;
    },
    stop() { epoch++; requested = false; controller?.abort(); },
  };
  return worker;
}
