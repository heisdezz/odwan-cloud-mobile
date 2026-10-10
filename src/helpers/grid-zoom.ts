export const MIN_GRID_COLUMNS = 2;
export const MAX_GRID_COLUMNS = 6;
export const clampColumns = (value: number) =>
  Math.max(MIN_GRID_COLUMNS, Math.min(MAX_GRID_COLUMNS, Math.round(value)));

export function gridWindow(
  count: number,
  columns: number,
  width: number,
  height: number,
  offset: number,
  top = 0,
  bufferRows = 2,
) {
  "worklet";
  const size = width / columns;
  const firstRow = Math.max(0, Math.floor((offset - top) / size));
  const lastRow = Math.max(
    firstRow,
    Math.ceil((offset + height - top) / size) - 1,
  );
  return {
    first: Math.max(0, (firstRow - bufferRows) * columns),
    last: Math.min(count - 1, (lastRow + bufferRows + 1) * columns - 1),
  };
}
export function gridPinchTarget(options: {
  count: number;
  columns: number;
  scale: number;
  width: number;
  height: number;
  offset: number;
  x: number;
  y: number;
  top: number;
  bottom: number;
}) {
  const { count, columns, width, height, offset, x, y, top, bottom } = options;
  const next = clampColumns(columns / options.scale);
  const oldSize = width / columns,
    newSize = width / next;
  const position = Math.max(0, offset + y - top);
  const row = Math.floor(position / oldSize);
  const index = Math.min(
    Math.max(0, count - 1),
    row * columns + Math.max(0, Math.min(columns - 1, Math.floor(x / oldSize))),
  );
  const fraction = position / oldSize - row;
  const maxOffset = Math.max(
    0,
    Math.ceil(count / next) * newSize + top + bottom - height,
  );
  return {
    columns: next,
    offset: Math.max(
      0,
      Math.min(
        maxOffset,
        Math.floor(index / next) * newSize + fraction * newSize + top - y,
      ),
    ),
    index,
  };
}

/** Closest actual cell center, including incomplete final rows and content insets. */
export function gridPinchAnchor(count: number, columns: number, width: number, offset: number, x: number, y: number, top = 0) {
  'worklet';
  const size = width / columns;
  if (count <= 0 || size <= 0) return { index: -1, x: 0, y: 0, size: 0 };
  const lastRow = Math.ceil(count / columns) - 1;
  const row = Math.max(0, Math.min(lastRow, Math.floor((offset + y - top) / size)));
  let best = { index: 0, x: size / 2, y: top + size / 2 - offset, size };
  let distance = Infinity;
  for (let candidateRow = Math.max(0, row - 1); candidateRow <= Math.min(lastRow, row + 1); candidateRow++) {
    const lastColumn = Math.min(columns - 1, count - candidateRow * columns - 1);
    const column = Math.max(0, Math.min(lastColumn, Math.floor(x / size)));
    const centerX = (column + 0.5) * size;
    const centerY = top + (candidateRow + 0.5) * size - offset;
    const nextDistance = (centerX - x) ** 2 + (centerY - y) ** 2;
    if (nextDistance < distance || (nextDistance === distance && candidateRow === row)) { distance = nextDistance; best = { index: candidateRow * columns + column, x: centerX, y: centerY, size }; }
  }
  return best;
}
