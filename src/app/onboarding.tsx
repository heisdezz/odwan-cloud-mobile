import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useOnboardingStore } from '@/stores/onboarding-store';
import tw from '@/lib/tw';

type Destination = '/gallery' | '/settings';

export default function OnboardingScreen() {
  const colors = useTheme();
  const completed = useOnboardingStore((state) => state.completed);
  const complete = useOnboardingStore((state) => state.complete);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    // Navigate after the root stack has made the main screens available.
    if (completed && destination) router.replace(destination);
  }, [completed, destination]);
  async function finish(next: Destination) {
    setSaving(true); setError(null);
    try { await complete(); setDestination(next); }
    catch { setSaving(false); setError('Could not save your preferences. Please try again.'); }
  }
  return <SafeAreaView style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <ScrollView contentContainerStyle={tw.style('px-6 pt-6 pb-4', { flexGrow: 1 })}>
      <View style={tw`w-full max-w-lg self-center flex-1`}>
        <View style={tw`flex-row items-center justify-between mb-8`}>
          <Text style={tw.style('text-xl font-semibold', { color: colors.text })}>Odwan</Text>
          <Button label="Skip" variant="text" disabled={saving} onPress={() => { void finish('/gallery'); }} />
        </View>
        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
          style={tw.style('self-center w-full max-w-xs rounded-2xl p-4 mb-8', { backgroundColor: colors.backgroundElement })}>
          <View style={tw`flex-row items-center justify-between pb-4`}>
            <SymbolView name={{ ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' }} size={26} tintColor={colors.text} />
            <View style={tw.style('h-11 w-11 rounded-full items-center justify-center', { backgroundColor: colors.backgroundSelected })}>
              <SymbolView name={{ ios: 'icloud.and.arrow.up', android: 'cloud_upload', web: 'cloud_upload' }} size={25} tintColor={colors.primary} />
            </View>
          </View>
          <View style={tw`flex-row gap-2`}>
            {['photo', 'video', 'photo'].map((kind, index) => <View key={index} style={tw.style('flex-1 aspect-square rounded-xl items-center justify-center', { backgroundColor: colors.backgroundSelected })}>
              <SymbolView name={kind === 'video' ? { ios: 'play.rectangle', android: 'smart_display', web: 'smart_display' } : { ios: 'photo', android: 'image', web: 'image' }} size={30} tintColor={colors.textSecondary} />
            </View>)}
          </View>
        </View>
        <Text accessibilityRole="header" style={tw.style('text-4xl font-semibold mb-4', { color: colors.text })}>Your photos.{'\n'}Your cloud.</Text>
        <Text style={tw.style('text-base leading-6 mb-7', { color: colors.textSecondary })}>Browse the photos and videos on your phone, then back up the ones you choose to your own server.</Text>
        <View style={tw`gap-5 mb-8`}>
          <View style={tw`gap-1`}>
            <Text style={tw.style('text-base font-semibold', { color: colors.text })}>Start with your gallery</Text>
            <Text style={tw.style('text-sm leading-5', { color: colors.textSecondary })}>Allow photo access when asked. Pinch to resize the grid, or hold and drag to select items.</Text>
          </View>
          <View style={tw`gap-1`}>
            <Text style={tw.style('text-base font-semibold', { color: colors.text })}>Connect when you’re ready</Text>
            <Text style={tw.style('text-sm leading-5', { color: colors.textSecondary })}>Add your server URL in Settings and log in. Choose an album and queue uploads one at a time.</Text>
          </View>
        </View>
        <View style={tw`mt-auto gap-3 pt-2`}>
          {error && <Text accessibilityRole="alert" style={tw.style('text-sm', { color: colors.error })}>{error}</Text>}
          <Button label="Open device gallery" loading={saving} onPress={() => { void finish('/gallery'); }} />
          <Button label="Connect my server" variant="outlined" disabled={saving} onPress={() => { void finish('/settings'); }} />
          <Text style={tw.style('text-xs text-center leading-5', { color: colors.textSecondary })}>You choose what gets uploaded. You can revisit this guide in Settings.</Text>
        </View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
