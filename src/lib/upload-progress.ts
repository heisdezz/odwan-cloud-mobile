import type { UploadProgress } from './upload-types';

/** Native events can be frequent; publish at most four times/second, plus completion. */
export function createUploadProgressReporter(publish: (progress: UploadProgress) => void, now = Date.now) {
  let previous: UploadProgress | null = null;
  let publishedAt = -Infinity;
  return (loaded: number, total: number | null) => {
    if (!Number.isFinite(loaded) || loaded < 0) return;
    const knownTotal = total !== null && Number.isFinite(total) && total > 0 ? total : null;
    const bytes = Math.max(previous?.loaded ?? 0, loaded);
    const percent = knownTotal === null ? null : Math.min(100, Math.floor(bytes / knownTotal * 100));
    const time = now();
    if (previous && bytes === previous.loaded && knownTotal === previous.total) return;
    if (previous && time - publishedAt < 250 && !(percent === 100 && previous.percent !== 100)) return;
    previous = { loaded: bytes, total: knownTotal, percent };
    publishedAt = time;
    publish(previous);
  };
}

export function uploadProgressLabel(progress: UploadProgress): string {
  if (progress.loaded === 0 && progress.percent === null) return 'Starting transfer…';
  if (progress.percent === 100) return '100% sent · Saving to cloud…';
  const bytes = (value: number) => value < 1024 * 1024
    ? `${(value / 1024).toFixed(0)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return progress.percent === null ? `${bytes(progress.loaded)} sent`
    : `${progress.percent}% · ${bytes(progress.loaded)} / ${bytes(progress.total!)}`;
}
