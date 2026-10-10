import * as Haptics from 'expo-haptics';

/** Feedback is optional: unsupported platforms and disabled haptics never interrupt an action. */
export function selectionFeedback() {
  void Haptics.selectionAsync().catch(() => {});
}
