import { createTaskQueue } from './task-queue';

/** Slow server originals never consume the slots reserved for device thumbnails. */
export function createThumbnailQueues() {
  const local = createTaskQueue(2);
  const remote = createTaskQueue(1);
  return { local, remote, setBusy: (busy: boolean) => local.setConcurrency(busy ? 1 : 2) };
}
