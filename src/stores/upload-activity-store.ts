import { createStore } from 'zustand/vanilla';
import type { BackupStatus } from '@/db/schema';
import type { UploadJob } from '@/lib/upload-types';

export const uploadAssetKey = (id: string, modifiedAt: number) => JSON.stringify([id, modifiedAt]);

export function createUploadActivityStore() {
  const store = createStore(() => ({ scopeKey: '', pending: 0, statuses: {} as Record<string, BackupStatus> }));
  return Object.assign(store, {
    update(jobs: UploadJob[], scopeKey: string) {
      const statuses: Record<string, BackupStatus> = {};
      let pending = 0;
      for (const job of jobs) {
        if (job.state !== 'success') pending++;
        const key = uploadAssetKey(job.asset.id, job.asset.modifiedAt);
        const status = job.result || job.state === 'success' ? 'backed_up'
          : job.state === 'error' ? 'error' : job.state === 'queued' ? 'pending' : 'uploading';
        // Moving one already-confirmed file to another album must not erase its backup badge.
        if (statuses[key] !== 'backed_up') statuses[key] = status;
      }
      store.setState({ scopeKey, pending, statuses });
    },
  });
}
