import { requireOptionalNativeModule } from 'expo-modules-core';
import type * as SecureStore from 'expo-secure-store';
import type { SessionStorage } from './session-vault';
import type { MMKV } from 'react-native-mmkv';
import { getRandomBytesAsync } from 'expo-crypto';
import { nativeMMKV } from './mmkv.native';

const secure: typeof SecureStore | null = requireOptionalNativeModule('ExpoSecureStore')
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('expo-secure-store') : null;
const keyName = 'odwan.mmkv.sessions.key';
let encryptedStorage: Promise<MMKV | null> | undefined;

function sessions() {
  if (!encryptedStorage) {
    encryptedStorage = (async () => {
      if (!nativeMMKV) return null;
      if (!secure) throw new Error('Rebuild the app to enable encrypted saved login sessions.');
      let encryptionKey = await secure.getItemAsync(keyName);
      if (!encryptionKey) {
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        encryptionKey = Array.from(await getRandomBytesAsync(32), (byte) => alphabet[byte & 63]).join('');
        await secure.setItemAsync(keyName, encryptionKey, { keychainAccessible: secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
      }
      return nativeMMKV.createMMKV({ id: 'odwan.sessions', encryptionKey, encryptionType: 'AES-256', compareBeforeSet: true });
    })();
    void encryptedStorage.catch(() => { encryptedStorage = undefined; });
  }
  return encryptedStorage;
}

export const sessionStorage: SessionStorage = {
  getItem: async (key) => {
    const mmkv = await sessions();
    if (!mmkv) return secure ? secure.getItemAsync(key) : null;
    const saved = mmkv.getString(key);
    if (saved !== undefined) return saved;
    // Preserve sessions made in Expo Go or an older build using SecureStore.
    const previous = secure ? await secure.getItemAsync(key) : null;
    if (previous !== null) { mmkv.set(key, previous); await secure!.deleteItemAsync(key); }
    return previous;
  },
  setItem: async (key, value) => {
    const mmkv = await sessions();
    if (mmkv) { mmkv.set(key, value); return; }
    if (!secure) throw new Error('Rebuild the app to enable saved login sessions.');
    await secure.setItemAsync(key, value, { keychainAccessible: secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },
  removeItem: async (key) => {
    const mmkv = await sessions();
    mmkv?.remove(key);
    if (secure) await secure.deleteItemAsync(key);
  },
};
