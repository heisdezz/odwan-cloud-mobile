export const MIN_GRID_COLUMNS = 2;
export const MAX_GRID_COLUMNS = 6;
export const clampColumns = (value: number) => Math.max(MIN_GRID_COLUMNS, Math.min(MAX_GRID_COLUMNS, Math.round(value)));
export function columnsAfterPinch(columns: number, scale: number) {
  if (!Number.isFinite(scale) || scale <= 0) return columns;
  // A 30% pinch changes one density step; small accidental movements do nothing.
  return clampColumns(columns - Math.round(Math.log(scale) / Math.log(1.3)));
}
