import { extract_message } from '@/helpers/api';
import { validateUploadResult } from './upload-api';
import { createUploadProgressReporter } from './upload-progress';
import { UploadConnectionError, UploadError, type UploadProgress, type UploadResult } from './upload-types';

/** RN's native multipart transport streams URI-backed files and reports bytes written. */
export function sendUploadWithProgress(options: {
  serverUrl: string; testToken: string; objectKey: string; body: FormData; signal: AbortSignal;
  onProgress: (progress: UploadProgress) => void;
}, createRequest: () => XMLHttpRequest = () => new XMLHttpRequest()): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    if (options.signal.aborted) { reject(new Error('Upload paused.')); return; }
    const request = createRequest();
    let settled = false;
    const cleanup = () => {
      options.signal.removeEventListener('abort', abort);
      request.onload = request.onerror = request.onabort = request.ontimeout = null;
      request.upload.onprogress = null;
    };
    const fail = (error: unknown) => { if (!settled) { settled = true; cleanup(); reject(error); } };
    const abort = () => {
      fail(new Error('Upload paused.'));
      request.abort();
    };
    const progress = createUploadProgressReporter(options.onProgress);
    request.upload.onprogress = (event) => {
      if (!settled && !options.signal.aborted) progress(event.loaded, event.lengthComputable ? event.total : null);
    };
    request.onerror = request.ontimeout = () => fail(new UploadConnectionError());
    request.onabort = () => fail(options.signal.aborted ? new Error('Upload paused.') : new UploadConnectionError());
    request.onload = () => {
      if (settled) return;
      try {
        if (request.status === 0) throw new UploadConnectionError();
        let body: unknown;
        try { body = JSON.parse(request.responseText); }
        catch { throw new UploadError(`Upload failed (HTTP ${request.status}).`, request.status); }
        if (request.status < 200 || request.status >= 300) {
          const error = body as { error?: unknown };
          throw new UploadError(typeof error?.error === 'string' ? error.error : extract_message(body), request.status);
        }
        const result = validateUploadResult(body);
        settled = true; cleanup(); resolve(result);
      } catch (error) { fail(error); }
    };
    options.signal.addEventListener('abort', abort, { once: true });
    try {
      request.open('POST', `${options.serverUrl}/api/test/s3/upload?${new URLSearchParams({ key: options.objectKey })}`);
      request.setRequestHeader('X-S3-Test-Token', options.testToken);
      request.setRequestHeader('Accept', 'application/json');
      // Let native FormData supply its own multipart boundary.
      request.send(options.body);
    } catch (error) { fail(options.signal.aborted ? new Error('Upload paused.') : error); }
  });
}
