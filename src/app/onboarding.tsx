import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/use-theme';
import { useOnboardingStore } from '@/stores/onboarding-store';
import tw from '@/lib/tw';

type Destination = '/gallery' | '/settings';
type SlideKind = 'gallery' | 'cloud' | 'backup';

const slides: { kind: SlideKind; eyebrow: string; title: string; description: string }[] = [
  {
    kind: 'gallery',
    eyebrow: '01 / YOUR GALLERY',
    title: 'Every moment,\nin one place.',
    description: 'Browse the photos and videos on your device. Your gallery stays ready, even when you are offline.',
  },
  {
    kind: 'cloud',
    eyebrow: '02 / YOUR CLOUD',
    title: 'Your server.\nYour library.',
    description: 'Connect your own server to see your cloud library and organize it into albums.',
  },
  {
    kind: 'backup',
    eyebrow: '03 / YOUR CHOICE',
    title: 'Back up what\nmatters to you.',
    description: 'Select the items you want, choose an album, and follow each upload as it completes.',
  },
];

function SlideArtwork({ kind, height }: { kind: SlideKind; height: number }) {
  const colors = useTheme();
  const symbol = kind === 'gallery'
    ? { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' } as const
    : kind === 'cloud'
      ? { ios: 'icloud', android: 'cloud', web: 'cloud' } as const
      : { ios: 'icloud.and.arrow.up', android: 'cloud_upload', web: 'cloud_upload' } as const;
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={tw.style('w-full rounded-3xl items-center justify-center overflow-hidden', { height, backgroundColor: colors.backgroundElement })}>
    <View style={tw.style('absolute -top-10 -right-8 rounded-full', { width: height * 0.9, height: height * 0.9, backgroundColor: colors.backgroundSelected })} />
    <View style={tw.style('absolute -bottom-12 -left-8 rounded-full', { width: height * 0.8, height: height * 0.8, backgroundColor: colors.backgroundSelected })} />
    {kind === 'gallery' ? <View style={tw`flex-row gap-2 items-center`}>
      {['image', 'video', 'image'].map((type, index) => <View key={index}
        style={tw.style('rounded-2xl items-center justify-center', {
          width: height * 0.27, height: height * (index === 1 ? 0.47 : 0.38),
          backgroundColor: index === 1 ? colors.primary : colors.background,
        })}>
        <SymbolView name={type === 'video' ? { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' } : { ios: 'photo', android: 'image', web: 'image' }}
          size={height * 0.14} tintColor={index === 1 ? colors.onPrimary : colors.textSecondary} />
      </View>)}
    </View> : <View style={tw.style('rounded-3xl items-center justify-center', {
      width: height * 0.54, height: height * 0.54, backgroundColor: colors.primary,
    })}>
      <SymbolView name={symbol} size={height * 0.3} tintColor={colors.onPrimary} />
    </View>}
  </View>;
}

export default function OnboardingScreen() {
  const colors = useTheme();
  const { width, height, fontScale } = useWindowDimensions();
  const compact = height < 650 || fontScale > 1.15;
  const artworkHeight = height < 560 ? 0 : Math.min(compact ? 110 : 220, height * 0.25);
  const titleSize = height < 560 ? 'text-2xl' : compact ? 'text-3xl' : 'text-4xl';
  const artworkSpacing = artworkHeight === 0 ? '' : compact ? 'mt-4' : 'mt-7';
  const carousel = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const completed = useOnboardingStore((state) => state.completed);
  const complete = useOnboardingStore((state) => state.complete);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Navigate after the root stack has made the main screens available.
    if (completed && destination) router.replace(destination);
  }, [completed, destination]);

  function goTo(index: number) {
    const next = Math.max(0, Math.min(slides.length - 1, index));
    setPage(next);
    carousel.current?.scrollTo({ x: next * width, animated: true });
  }

  async function finish(next: Destination) {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await complete();
      setDestination(next);
    } catch {
      setSaving(false);
      setError('Could not save your preferences. Please try again.');
    }
  }

  return <SafeAreaView style={tw.style('flex-1', { backgroundColor: colors.background })}>
    <View style={tw`flex-row items-center justify-between px-6 pt-2 pb-2`}>
      <Text style={tw.style('text-xl font-semibold', { color: colors.text })}>Odwan</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Skip onboarding"
        accessibilityState={{ disabled: saving }} disabled={saving} onPress={() => { void finish('/gallery'); }}
        style={tw`min-h-11 px-3 items-center justify-center`}>
        <Text style={tw.style('text-sm font-medium', { color: colors.textSecondary })}>Skip</Text>
      </Pressable>
    </View>

    <ScrollView ref={carousel} horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false}
      scrollEnabled={!saving} style={tw`flex-1`}
      onMomentumScrollEnd={({ nativeEvent }) => setPage(Math.max(0, Math.min(slides.length - 1, Math.round(nativeEvent.contentOffset.x / width))))}>
      {slides.map((slide) => <View key={slide.kind} style={tw.style('flex-1 justify-center px-7', { width })}>
        <View style={tw`w-full max-w-lg self-center`}>
          {artworkHeight > 0 && <SlideArtwork kind={slide.kind} height={artworkHeight} />}
          <Text style={tw.style(`text-xs font-semibold ${artworkSpacing} mb-2`, { color: colors.primary })}>{slide.eyebrow}</Text>
          <Text accessibilityRole="header" style={tw.style(`${titleSize} font-semibold mb-3`, { color: colors.text })}>{slide.title}</Text>
          <Text style={tw.style(`${compact ? 'text-sm leading-5' : 'text-base leading-6'}`, { color: colors.textSecondary })}>{slide.description}</Text>
        </View>
      </View>)}
    </ScrollView>

    <View style={tw`px-6 pb-4 gap-3`}>
      <View style={tw`flex-row items-center justify-center`} accessibilityLabel={`Step ${page + 1} of ${slides.length}`}>
        {slides.map((slide, index) => <Pressable key={slide.kind} accessibilityRole="button"
          accessibilityLabel={`Go to step ${index + 1} of ${slides.length}`}
          accessibilityState={{ selected: page === index }} onPress={() => goTo(index)}
          style={tw`h-11 w-11 items-center justify-center`}>
          <View style={tw.style('h-2 rounded-full', { width: page === index ? 24 : 8, backgroundColor: page === index ? colors.primary : colors.outline })} />
        </Pressable>)}
      </View>
      {error && <Text accessibilityRole="alert" style={tw.style('text-sm text-center', { color: colors.error })}>{error}</Text>}
      {page < slides.length - 1 ? <>
        <Button label="Continue" disabled={saving} onPress={() => goTo(page + 1)} />
        <Text style={tw.style('text-xs text-center', { color: colors.textSecondary })}>Swipe to explore</Text>
      </> : <>
        <Button label="Open device gallery" loading={saving} onPress={() => { void finish('/gallery'); }} />
        <Button label="Connect my server" variant="outlined" disabled={saving} onPress={() => { void finish('/settings'); }} />
      </>}
    </View>
  </SafeAreaView>;
}
