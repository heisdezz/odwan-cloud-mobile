import { runLocalDatabase } from './local-store.native';
import { createUploadRepository } from './upload-queue';
export const uploadRepository = createUploadRepository(runLocalDatabase);
