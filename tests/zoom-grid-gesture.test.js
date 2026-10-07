import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// Execute the installed package's gesture callbacks without a native UI runtime.
// This checks our saved patch, including the cancellation bug that can disable scrolling.
function gestureFor(activeColumns) {
  const source = readFileSync(new URL('../node_modules/react-native-zoom-grid/src/ZoomGrid.tsx', import.meta.url), 'utf8');
  const start = source.indexOf('const pinch = Gesture.Pinch()');
  const end = source.indexOf('const renderLayer', start);
  const callbacks = {};
  const chain = {};
  for (const name of ['onStart', 'onUpdate', 'onEnd', 'onFinalize']) chain[name] = (callback) => { callbacks[name] = callback; return chain; };
  const scale = { value: 1 }, savedScale = { value: 1 };
  let pinching = false, committed = activeColumns;
  const evaluate = new Function('Gesture', 'runOnJS', 'setIsPinching', 'scale', 'savedScale', 'focalX', 'focalY', 'prepareZoom', 'activeColumns', 'zoomLevels', 'withTiming', 'handleZoomFinish', source.slice(start, end));
  evaluate({ Pinch: () => chain }, (fn) => fn, (value) => { pinching = value; }, scale, savedScale, { value: 0 }, { value: 0 }, () => {}, activeColumns, [6, 5, 4, 3, 2], (value, options, done) => { done?.(true); return value; }, (value) => { committed = value; pinching = false; });
  return { callbacks, scale, pinching: () => pinching, committed: () => committed };
}
test('cancelled pinch restores scrolling without changing grid density', () => {
  const gesture = gestureFor(3);
  gesture.callbacks.onStart({ focalX: 100, focalY: 100 });
  gesture.callbacks.onUpdate({ scale: 1.2 });
  expect(gesture.pinching()).toBe(true);
  gesture.callbacks.onFinalize({}, false);
  expect(gesture.pinching()).toBe(false);
  expect(gesture.scale.value).toBe(1);
  expect(gesture.committed()).toBe(3);
});
test('zoom transitions snap to the neighboring level and stay within two to six columns', () => {
  for (const [initial, scale, expected] of [[3, 2, 2], [3, 0.5, 4], [2, 2, 2], [6, 0.1, 6], [3, 1.01, 3]]) {
    const gesture = gestureFor(initial);
    gesture.callbacks.onStart({ focalX: 100, focalY: 100 });
    gesture.callbacks.onUpdate({ scale });
    gesture.callbacks.onEnd();
    gesture.callbacks.onFinalize({}, true);
    expect(gesture.committed()).toBe(expected);
    expect(gesture.pinching()).toBe(false);
  }
});
