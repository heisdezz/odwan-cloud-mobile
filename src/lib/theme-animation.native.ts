import { isRunningInExpoGo } from 'expo';
import { AccessibilityInfo } from 'react-native';

export async function animateThemeChange(change: () => void) {
  if (isRunningInExpoGo()) {
    change();
    return;
  }
  if (await AccessibilityInfo.isReduceMotionEnabled()) {
    change();
    return;
  }
  let switchTheme: typeof import('react-native-theme-switch-animation').default;
  try {
    // Load only when requested: Expo Go does not contain this native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    switchTheme = require('react-native-theme-switch-animation').default;
  } catch {
    change();
    return;
  }
  await new Promise<void>((resolve) => {
    let changed = false;
    const apply = () => {
      if (!changed) {
        changed = true;
        change();
      }
    };
    const timeout = setTimeout(() => {
      apply();
      resolve();
    }, 1000);
    try {
      switchTheme({
        switchThemeFunction: () => {
          apply();
          setTimeout(() => { clearTimeout(timeout); resolve(); }, 350);
        },
        animationConfig: { type: 'fade', duration: 300 },
      });
    } catch {
      clearTimeout(timeout);
      apply();
      resolve();
    }
  });
}
