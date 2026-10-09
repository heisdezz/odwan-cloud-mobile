/** Network I/O finishes before any decoder sees the file. Decoders never open HTTP streams. */
export async function withRemoteThumbnailSource<T, R>(options: {
  download: (signal: AbortSignal, progress: (written: number, total: number) => void) => Promise<T>;
  decode: (file: T) => Promise<R>;
  cleanup: () => void | Promise<void>;
}, limits = { timeoutMs: 45_000, maxBytes: 256 * 1024 * 1024 }): Promise<R> {
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
          cancel('This original is too large for an on-device server preview.');
      });
    } catch (error) { throw failure ?? error; }
    clearTimeout(timer);
    if (failure) throw failure;
    return await options.decode(file);
  } finally {
    clearTimeout(timer);
    await options.cleanup();
  }
}
