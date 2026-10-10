import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { gridPinchAnchor, gridPinchTarget, gridWindow } from '../src/helpers/grid-zoom';

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
test('a cancelled pinch removes the overlay and releases the thumbnail reservation', () => {
  const source = readFileSync(new URL('../src/components/media/grid-zoom.tsx', import.meta.url), 'utf8');
  const finalize = source.match(/\.onFinalize\(\(_event, success\) => \{([\s\S]*?)\n    \}\)/)[1];
  const finish = source.match(/const finishPreview = useCallback\(\(serial: number\) => \{([\s\S]*?)\n  \},/)[1];
  const shared = (value) => ({ value, set(next) { this.value = next; } });
  const pinching = shared(true), scale = shared(2), busy = shared(false), previewOpacity = shared(1), gestureId = shared(1);
  let interacting = true, preview = {};
  const finishPreview = new Function('gestureId', 'previewStore', 'previewOpacity', 'scale', 'busy', 'setPinchInteraction', 'serial', finish)
    .bind(null, gestureId, { setState: (state) => { preview = state.preview; } }, previewOpacity, scale, busy, (value) => { interacting = value; });
  finishPreview(0); // A late completion from an older gesture must not clear this preview.
  expect(previewOpacity.value).toBe(1); expect(interacting).toBe(true);
  new Function('pinching', 'busy', 'success', 'previewOpacity', 'scale', 'runOnJS', 'finishPreview', 'gestureId', finalize)(
    pinching, busy, false, previewOpacity, scale, (fn) => fn, finishPreview, gestureId);
  expect(pinching.value).toBe(false); expect(scale.value).toBe(1); expect(busy.value).toBe(false);
  expect(previewOpacity.value).toBe(0); expect(preview).toBeNull(); expect(interacting).toBe(false);
});

test('pinch selects the nearest real tile center, even beyond the incomplete final row', () => {
  expect(gridPinchAnchor(0, 3, 360, 0, 10, 10).index).toBe(-1);
  const anchor = gridPinchAnchor(1000, 3, 360, 1200, 150, 240);
  expect(anchor).toEqual({ index: 37, x: 180, y: 300, size: 120 });
  // Last row only contains its first column; the cell above the finger is closer.
  expect(gridPinchAnchor(4, 3, 360, 0, 350, 150).index).toBe(2);
  expect(gridPinchAnchor(4, 3, 360, 0, 20, 200).index).toBe(3);
});

test('tile-centered commit preserves the chosen tile center across every density', () => {
  for (let columns = 2; columns <= 6; columns++) {
    const anchor = gridPinchAnchor(1000, columns, 360, 6000, 175, 270, 25);
    for (let target = 2; target <= 6; target++) {
      const next = gridPinchTarget({ ...layout, offset: 6000, columns, x: anchor.x, y: anchor.y, top: 25, scale: columns / target });
      expect(next.index).toBe(anchor.index);
      expect((Math.floor(next.index / next.columns) + 0.5) * (360 / next.columns) + 25 - next.offset).toBeCloseTo(anchor.y, 5);
    }
  }
});
