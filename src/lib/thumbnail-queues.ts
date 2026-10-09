import { createTaskQueue } from './task-queue';

/** Keep new thumbnail work out of active gestures while allowing cache hits. */
export function createThumbnailQueues() {
  const local = createTaskQueue(2);
  const remote = createTaskQueue(1);
  return { local, remote, setBusy: (busy: boolean) => {
    local.setPaused(busy); remote.setPaused(busy);
  } };
}
