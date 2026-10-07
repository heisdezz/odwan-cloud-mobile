import { createContext, useContext } from 'react';
import type { LocalAsset } from '@/db/schema';
import type { UploadDestination, UploadJob, UploadPhase } from '@/lib/upload-types';

export type UploadQueue = {
  backgroundAvailable: boolean; backgroundError: string | null;
  jobs: UploadJob[]; phase: UploadPhase; paused: boolean; ready: boolean; error: unknown;
  enqueue: (assets: LocalAsset[], destination: UploadDestination, token: string) => Promise<void>;
  retry: () => Promise<void>; remove: (id: string) => Promise<void>; clearCompleted: () => Promise<void>;
  reload: () => Promise<void>;
  setPaused: (value: boolean) => void;
};
export const UploadQueueContext = createContext<UploadQueue | null>(null);
export function useUploadQueue() {
  const queue = useContext(UploadQueueContext);
  if (!queue) throw new Error('UploadQueueProvider is missing.');
  return queue;
}
