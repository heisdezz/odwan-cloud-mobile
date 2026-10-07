export const MIN_GRID_COLUMNS = 2;
export const MAX_GRID_COLUMNS = 6;
export const clampColumns = (value: number) => Math.max(MIN_GRID_COLUMNS, Math.min(MAX_GRID_COLUMNS, Math.round(value)));
