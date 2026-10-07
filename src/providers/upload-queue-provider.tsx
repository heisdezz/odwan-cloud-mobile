import type { PropsWithChildren } from 'react';
import { UploadQueueContext, type UploadQueue } from './upload-queue-context';

const unsupported = async () => { throw new Error('Device uploads are available in the mobile app.'); };
const queue: UploadQueue = { backgroundAvailable: false, backgroundError: null, jobs: [], phase: null, paused: true, ready: false, error: null,
  enqueue: unsupported, retry: unsupported, remove: unsupported, clearCompleted: unsupported, reload: unsupported, setPaused: () => {} };
export function UploadQueueProvider({ children }: PropsWithChildren) {
  return <UploadQueueContext.Provider value={queue}>{children}</UploadQueueContext.Provider>;
}
