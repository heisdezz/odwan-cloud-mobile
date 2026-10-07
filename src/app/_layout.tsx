import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Toaster } from 'sonner-native';
import { MediaViewerProvider } from '@/providers/media-viewer-provider';
import { QueryProvider } from '@/providers/query-provider';
import { ServerSessionProvider } from '@/providers/server-session-provider';
import { UploadQueueProvider } from '@/providers/upload-queue-provider';
import { GallerySyncProvider } from '@/providers/gallery-sync-provider';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import tw from '@/lib/tw';
import * as SplashScreen from 'expo-splash-screen';
import { AppThemeProvider, useAppTheme } from '@/providers/app-theme-provider';
import { useTheme } from '@/hooks/use-theme';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

void SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  initialRouteName: '(main)',
  anchor: '(main)',
};

export default function RootLayout() {
  return <GestureHandlerRootView style={tw`flex-1`}><QueryProvider><ServerSessionProvider><UploadQueueProvider><GallerySyncProvider><AppThemeProvider><BottomSheetModalProvider><MediaViewerProvider><ThemedNavigation /></MediaViewerProvider></BottomSheetModalProvider></AppThemeProvider></GallerySyncProvider></UploadQueueProvider></ServerSessionProvider></QueryProvider></GestureHandlerRootView>;
}

function ThemedNavigation() {
  const { colorScheme } = useAppTheme();
  const colors = useTheme();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: colors.background, card: colors.backgroundElement, text: colors.text, primary: colors.primary, border: colors.outline } }}>
      <AnimatedSplashOverlay />
      <Stack initialRouteName="(main)" screenOptions={{ headerShown: true }}>
        <Stack.Screen name="(main)" options={{ headerShown: false }} />
        <Stack.Screen name="device-album/[id]" options={{ title: 'Device album' }} />
        <Stack.Screen name="album/[id]/index" options={{ title: 'Album' }} />
        <Stack.Screen name="media/[mediaId]/index" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', contentStyle: tw`bg-black` }} />
        <Stack.Screen name="album/[id]/[mediaId]/index" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', contentStyle: tw`bg-black` }} />
        <Stack.Screen name="auth/index" options={{ title: 'Log in' }} />
      </Stack>
      <Toaster theme={colorScheme} position="top-center" />
    </ThemeProvider>
  );
}
