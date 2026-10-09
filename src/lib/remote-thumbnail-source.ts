/** The backend JPEG download completes before publishing; failures clean up partial cache files. */
export async function withRemoteThumbnailSource<T, R>(options: {
  download: (signal: AbortSignal, progress: (written: number, total: number) => void) => Promise<T>;
  publish: (file: T) => Promise<R>;
  cleanup: () => void | Promise<void>;
}, limits = { timeoutMs: 60_000, maxBytes: 1024 * 1024 }): Promise<R> {
  const controller = new AbortController();
  let failure: Error | undefined;
  const cancel = (message: string) => {
    failure ??= new Error(message);
    controller.abort();
  };
  const timer = setTimeout(() => cancel('Server preview download timed out. Retry the preview.'), limits.timeoutMs);
  try {
    let file: T;
    try {
      file = await options.download(controller.signal, (written, total) => {
        if (written > limits.maxBytes || total > limits.maxBytes)
          cancel('Server preview exceeds the download limit.');
      });
    } catch (error) { throw failure ?? error; }
    clearTimeout(timer);
    if (failure) throw failure;
    return await options.publish(file);
  } finally {
    clearTimeout(timer);
    await options.cleanup();
  }
}
