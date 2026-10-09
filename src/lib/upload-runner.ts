/** Serializes the native service lifecycle as well as the transfer worker. */
export function createUploadRunner(options: {
  worker: { wake: () => Promise<void>; stop: () => void };
  canRun: () => boolean;
  hasPending: () => Promise<boolean>;
  background?: { start: () => Promise<void>; stop: () => Promise<void> };
  maxBackgroundDurationMs?: number;
  onBackgroundDeadline?: () => void;
  onBackgroundError: (error: unknown) => void;
}) {
  let running: Promise<void> | null = null;
  let requested = false;
  let epoch = 0;
  const runner = {
    wake(): Promise<void> {
      requested = true;
      if (running) return running;
      const generation = epoch;
      let deadline: ReturnType<typeof setTimeout> | undefined;
      let starting: Promise<void> | undefined;
      running = (async () => {
        requested = false;
        if (!options.canRun() || !await options.hasPending() || generation !== epoch) return;
        if (options.background) {
          // Foreground transfers needn't wait for permissions or HeadlessJS startup.
          // Still join startup before stopping so native services never overlap.
          starting = (async () => {
            try {
              await options.background!.start();
              if (generation !== epoch) return;
              if (options.maxBackgroundDurationMs) deadline = setTimeout(() => {
                runner.stop();
                options.onBackgroundDeadline?.();
                options.onBackgroundError(new Error('Background upload time limit reached. Open the app and resume the queue.'));
              }, options.maxBackgroundDurationMs);
            } catch (error) { options.onBackgroundError(error); }
          })();
        }
        do {
          requested = false;
          if (generation !== epoch || !options.canRun()) return;
          await options.worker.wake();
        } while (requested);
      })().finally(async () => {
        await starting;
        if (deadline) clearTimeout(deadline);
        // Finish stop before another wake can start a new native task.
        try { await options.background?.stop(); } catch (error) { options.onBackgroundError(error); }
        running = null;
        if (requested && options.canRun()) void runner.wake().catch(() => {});
      });
      return running;
    },
    stop() { epoch++; requested = false; options.worker.stop(); },
  };
  return runner;
}
