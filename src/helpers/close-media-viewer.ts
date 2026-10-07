import { router } from 'expo-router';
export function closeMediaViewer() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
