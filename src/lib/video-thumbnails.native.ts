import { createVideoPlayer, type VideoSource, type VideoThumbnail } from 'expo-video';
import { createTaskQueue } from './task-queue';

const enqueue = createTaskQueue(2);

export function generateVideoThumbnail<T>(source: VideoSource, signal: AbortSignal, consume: (frame: VideoThumbnail) => Promise<T>) {
  return enqueue(async () => {
    if (signal.aborted) throw new Error('Thumbnail request cancelled.');
    const player = createVideoPlayer(null);
    player.muted = true;
    player.bufferOptions = { preferredForwardBufferDuration: 1, maxBufferBytes: 2 * 1024 * 1024 };
    let ended = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let abort: () => void = () => {};
    const interrupted = new Promise<never>((_, reject) => {
      abort = () => reject(new Error('Thumbnail request cancelled.'));
      signal.addEventListener('abort', abort, { once: true });
      timeout = setTimeout(() => reject(new Error('Video preview timed out.')), 20_000);
    });
    try {
      const work = (async () => {
        await player.replaceAsync(source);
        if (ended || signal.aborted) throw new Error('Thumbnail request cancelled.');
        const [thumbnail] = await player.generateThumbnailsAsync(0, { maxWidth: 256, maxHeight: 256 });
        if (!thumbnail) throw new Error('No video preview could be generated.');
        try { return await consume(thumbnail); }
        finally { thumbnail.release(); }
      })();
      return await Promise.race([work, interrupted]);
    } finally {
      ended = true;
      clearTimeout(timeout);
      signal.removeEventListener('abort', abort);
      player.release();
    }
  }, signal);
}
