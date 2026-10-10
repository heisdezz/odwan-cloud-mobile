/** Hit-test actual cells; padding and empty cells in the final row are not selectable. */
export function gridSelectionIndex(count: number, columns: number, width: number, offset: number, x: number, y: number, top: number) {
  'worklet';
  if (count <= 0 || width <= 0 || x < 0 || x >= width || offset + y < top) return -1;
  const size = width / columns;
  const index = Math.floor((offset + y - top) / size) * columns + Math.floor(x / size);
  return index < count ? index : -1;
}

/** Recompute from the starting selection so reversing a drag restores untouched items. */
export function gridRangeSelection<T>(data: readonly T[], key: (item: T) => string, base: ReadonlySet<string>, anchor: number, end: number, adding: boolean) {
  const selected = new Set(base);
  for (let index = Math.max(0, Math.min(anchor, end)); index <= Math.min(data.length - 1, Math.max(anchor, end)); index++) {
    const id = key(data[index]);
    if (adding) selected.add(id); else selected.delete(id);
  }
  return selected;
}
