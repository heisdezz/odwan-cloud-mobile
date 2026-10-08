import { expect, test } from 'bun:test';
import { createUploadPreferencesStore } from '../src/stores/upload-preferences-store';

test('pause choice survives store recreation and stays scoped to the server account', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
  const first = createUploadPreferencesStore(storage);
  const scope = { serverUrl: 'https://example.com', accountId: 'admin' };
  first.getState().setPaused(scope, true);
  const reopened = createUploadPreferencesStore(storage);
  expect(Object.values(reopened.getState().pausedByScope)).toEqual([true]);
  reopened.getState().setPaused({ ...scope, serverUrl: 'https://other.example.com' }, false);
  expect(Object.values(reopened.getState().pausedByScope)).toEqual([true, false]);
});
