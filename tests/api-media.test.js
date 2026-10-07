import { expect, test } from 'bun:test';
import { extract_message } from '../src/helpers/api';
import { mediaAspectRatio, mediaName, mediaStreamUrl } from '../src/helpers/media';

test('extracts PocketBase response messages before wrapper messages', () => {
  expect(extract_message({ message: 'generic', response: { message: 'Invalid credentials' } })).toBe('Invalid credentials');
  expect(extract_message({ response: { data: { message: 'Validation failed' } } })).toBe('Validation failed');
});
test('handles standard errors, causes, strings and missing errors', () => {
  expect(extract_message(new Error('Network failed'))).toBe('Network failed');
  expect(extract_message({ cause: new Error('Timeout') })).toBe('Timeout');
  expect(extract_message('  failed  ')).toBe('failed');
  expect(extract_message(null)).toBe('An unknown error occurred.');
  expect(extract_message({ message: ' ' })).toBe('An unexpected error occurred.');
});
test('extracts nested field validation safely', () => {
  expect(extract_message({ data: { data: { email: { message: 'Invalid email' }, other: null } } })).toBe('email: Invalid email');
  expect(extract_message({ response: { data: { password: { message: 'Too short' } } } })).toBe('password: Too short');
});
test('uses safe masonry ratios with missing or invalid metadata', () => {
  expect(mediaAspectRatio('{"width":1200,"height":800}')).toBe(1.5);
  expect(mediaAspectRatio('{"width":800,"height":1200}')).toBeCloseTo(2 / 3);
  for (const value of [undefined, 'bad json', 'null', '{"width":10,"height":0}', '{"width":"NaN","height":1}']) expect(mediaAspectRatio(value)).toBe(1);
  expect(mediaAspectRatio('{"width":10000,"height":1}')).toBe(2);
});
test('uses the authenticated streaming path and readable file names', () => {
  expect(mediaStreamUrl('https://example.com/pb/', 'id with / slash')).toBe('https://example.com/pb/api/media/id%20with%20%2F%20slash/stream');
  expect(mediaName({ original_relative_path: 'Photos/Trip/image.jpg', id: 'a' })).toBe('image.jpg');
  expect(mediaName({ original_relative_path: 'Photos\\image.jpg', id: 'a' })).toBe('image.jpg');
});
