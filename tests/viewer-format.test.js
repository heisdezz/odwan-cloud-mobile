import { expect, test } from 'bun:test';
import { playbackTime, viewerDate, viewerClock } from '../src/helpers/viewer-format';

test('video positions handle minutes, hours and invalid native durations', () => {
  expect(playbackTime(15)).toBe('0:15');
  expect(playbackTime(125)).toBe('2:05');
  expect(playbackTime(3661)).toBe('1:01:01');
  expect(playbackTime(NaN)).toBe('0:00');
  expect(playbackTime(-10)).toBe('0:00');
});
test('missing and invalid capture times are omitted from viewer metadata', () => {
  expect(viewerDate(undefined)).toBeUndefined();
  expect(viewerDate('invalid')).toBeUndefined();
  expect(viewerClock('invalid')).toBeUndefined();
  expect(viewerDate(1791284400000)).toBeTruthy();
});
