import type { createMMKV } from 'react-native-mmkv';

// Loading Nitro in Expo Go/older APKs throws. Keep its fallback outside the native import.
function loadMMKV() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const api = require('react-native-mmkv') as { createMMKV: typeof createMMKV };
    const preferences = api.createMMKV({ id: 'odwan.preferences', compareBeforeSet: true });
    return { ...api, preferences };
  } catch { return null; }
}
export const nativeMMKV = loadMMKV();
