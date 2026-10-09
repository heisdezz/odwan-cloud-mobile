/** Hidden recyclers keep their existing layout, then catch up once on focus. */
export function createFocusedGridColumns(read: () => number | null, subscribeSource: (listener: () => void) => () => void) {
  let value = read();
  let unsubscribe: (() => void) | undefined;
  const listeners = new Set<() => void>();
  const update = () => {
    const next = read();
    if (next === value) return;
    value = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => value,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    setFocused(focused: boolean) {
      if (focused) { unsubscribe ??= subscribeSource(update); update(); }
      else { unsubscribe?.(); unsubscribe = undefined; }
    },
  };
}
