import UploadSheet from '@/components/overlays/upload-sheet';
import { UploadQueueContent } from './upload-queue-content';

export function UploadQueueSheet({ onClose }: { onClose: () => void }) {
  return <UploadSheet onClose={onClose}><UploadQueueContent onClose={onClose} /></UploadSheet>;
}
