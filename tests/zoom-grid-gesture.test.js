import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gridPinchTarget, gridWindow } from '../src/helpers/grid-zoom';

const layout = { count: 1000, columns: 3, width: 360, height: 640, offset: 1200, x: 150, y: 240, top: 0, bottom: 100 };
test('pinch preserves the focal asset at the new density and clamps two to six columns', () => {
  const result = gridPinchTarget({ ...layout, scale: 1.5 });
  expect(result.columns).toBe(2);
  expect(result.index).toBe(37);
  expect(Math.floor((result.offset + layout.y) / (layout.width / result.columns))).toBe(Math.floor(result.index / result.columns));
  expect(gridPinchTarget({ ...layout, scale: 0.1 }).columns).toBe(6);
  expect(gridPinchTarget({ ...layout, scale: 10 }).columns).toBe(2);
  expect(gridPinchTarget({ ...layout, scale: 1.01 }).columns).toBe(3);
});
test('focal alignment never scrolls past either end of a short gallery', () => {
  expect(gridPinchTarget({ ...layout, count: 2, offset: 0, scale: 0.5 }).offset).toBe(0);
  const result = gridPinchTarget({ ...layout, count: 40, offset: 9999, scale: 0.5 });
  expect(result.offset).toBeLessThanOrEqual(Math.ceil(40 / 6) * 60 + 100 - 640 > 0 ? Math.ceil(40 / 6) * 60 + 100 - 640 : 0);
});
test('thumbnail window includes just the viewport and two buffer rows', () => {
  expect(gridWindow(1000, 3, 360, 600, 1200)).toEqual({ first: 24, last: 50 });
  expect(gridWindow(1000, 6, 360, 600, 0)).toEqual({ first: 0, last: 71 });
  expect(gridWindow(0, 3, 360, 600, 0)).toEqual({ first: 0, last: -1 });
  expect(gridWindow(5, 3, 360, 600, 0)).toEqual({ first: 0, last: 4 });
});
test('a cancelled pinch always releases its preview and busy state', () => {
  const source = readFileSync(new URL('../src/components/media/grid-zoom.tsx', import.meta.url), 'utf8');
  const body = source.match(/\.onFinalize\(\(_event, success\) => \{([\s\S]*?)\n    \}\)/)[1];
  const shared = (value) => ({ value, set(next) { this.value = next; } });
  const pinching = shared(true), scale = shared(2), busy = shared(true);
  new Function('pinching', 'scale', 'busy', 'withTiming', 'success', body)(pinching, scale, busy, (value) => value, false);
  expect(pinching.value).toBe(false);
  expect(scale.value).toBe(1);
  expect(busy.value).toBe(false);
});
