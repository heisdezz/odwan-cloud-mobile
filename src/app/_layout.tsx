import { useEffect } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Button } from '@/components/ui';
import { useOnboardingStore } from '@/stores/onboarding-store';
import { KeyboardProvider } from 'react-native-keyboard-controller';
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
  return <GestureHandlerRootView style={tw`flex-1`}><QueryProvider><ServerSessionProvider><UploadQueueProvider><GallerySyncProvider><AppThemeProvider><KeyboardProvider><MediaViewerProvider><ThemedNavigation /></MediaViewerProvider></KeyboardProvider></AppThemeProvider></GallerySyncProvider></UploadQueueProvider></ServerSessionProvider></QueryProvider></GestureHandlerRootView>;
}

function ThemedNavigation() {
  const ready = useOnboardingStore((state) => state.ready);
  const completed = useOnboardingStore((state) => state.completed);
  const error = useOnboardingStore((state) => state.error);
  const initialize = useOnboardingStore((state) => state.initialize);
  useEffect(() => { void initialize(); }, [initialize]);
  const { colorScheme } = useAppTheme();
  const colors = useTheme();
  const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, background: colors.background, card: colors.backgroundElement, text: colors.text, primary: colors.primary, border: colors.outline } }}>
      <AnimatedSplashOverlay />
      {ready ? <Stack initialRouteName="(main)" screenOptions={{ headerShown: true }}>
        <Stack.Protected guard={completed}>
          <Stack.Screen name="(main)" options={{ headerShown: false }} />
          <Stack.Screen name="device-album/[id]" options={{ title: 'Device album' }} />
          <Stack.Screen name="album/[id]/index" options={{ title: 'Album' }} />
          <Stack.Screen name="media/[mediaId]/index" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', contentStyle: tw`bg-black` }} />
          <Stack.Screen name="album/[id]/[mediaId]/index" options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'fade', contentStyle: tw`bg-black` }} />
          <Stack.Screen name="auth/index" options={{ title: 'Log in' }} />
          <Stack.Screen name="uploads/current" options={{ title: 'Current uploads' }} />
          <Stack.Screen name="uploads/history" options={{ title: 'Upload history' }} />
          <Stack.Screen name="trash" options={{ title: 'Trash' }} />
        </Stack.Protected>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack> : <View style={tw.style('flex-1 items-center justify-center px-6 gap-4', { backgroundColor: colors.background })}>
        {error ? <><Text accessibilityRole="alert" style={tw.style('text-base text-center', { color: colors.text })}>{error}</Text>
          <Button label="Retry" onPress={() => { void initialize(); }} /></> : <ActivityIndicator color={colors.primary} />}
      </View>}
      <Toaster theme={colorScheme} position="top-center" />
    </ThemeProvider>
  );
}
