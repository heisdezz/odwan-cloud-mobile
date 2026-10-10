import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { TabSlot, useTabsWithTriggers } from 'expo-router/ui';
import { Keyboard, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JellyTabBarHeadless, type TabsIconProps, type TabsItem } from 'react-native-jelly-tabs';

import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';
import { useSelectionNavigation } from '@/hooks/use-selection-navigation';

type TabBarProps = Pick<ReturnType<typeof useTabsWithTriggers>, 'state' | 'navigation'>;

function HomeIcon({ color }: TabsIconProps) {
  return <Image source={require('@/assets/images/tabIcons/home-outline.svg')} tintColor={color} contentFit="contain" style={tw`h-5 w-5`} />;
}

function ExploreIcon({ color }: TabsIconProps) {
  return <Image source={require('@/assets/images/tabIcons/explore-outline.svg')} tintColor={color} contentFit="contain" style={tw`h-5 w-5`} />;
}

function ActiveHomeIcon(props: TabsIconProps) {
  return (
    <View style={tw`flex-row items-center gap-1`}>
      <HomeIcon {...props} />
      <Text numberOfLines={1} style={tw.style('text-xs font-medium', { color: props.color })}>Cloud</Text>
    </View>
  );
}

function ActiveExploreIcon(props: TabsIconProps) {
  return (
    <View style={tw`flex-row items-center gap-1`}>
      <ExploreIcon {...props} />
      <Text numberOfLines={1} style={tw.style('text-xs font-medium', { color: props.color })}>Albums</Text>
    </View>
  );
}

function SettingsIcon({ color }: TabsIconProps) {
  return <Image source={require('@/assets/images/tabIcons/settings-outline.svg')} tintColor={color} contentFit="contain" style={tw`h-5 w-5`} />;
}

function ActiveSettingsIcon(props: TabsIconProps) {
  return <View style={tw`flex-row items-center gap-1`}>
    <SettingsIcon {...props} />
    <Text numberOfLines={1} style={tw.style('text-xs font-medium', { color: props.color })}>Settings</Text>
  </View>;
}

function GalleryIcon({ color }: TabsIconProps) {
  return <Image source={require('@/assets/images/tabIcons/gallery-outline.svg')} tintColor={color} contentFit="contain" style={tw`h-5 w-5`} />;
}
function ActiveGalleryIcon(props: TabsIconProps) {
  return <View style={tw`flex-row items-center gap-1`}><GalleryIcon {...props} /><Text numberOfLines={1} style={tw.style('text-xs font-medium', { color: props.color })}>Device</Text></View>;
}

function FloatingTabBar({ state, navigation }: TabBarProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const selectionActive = useSelectionNavigation((state) => state.hidden);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const items = useMemo<TabsItem[]>(() => state.routes.map((route) => {
    const home = route.name === 'index' || route.name === 'home';
    const settings = route.name === 'settings';
    const gallery = route.name === 'gallery';
    return {
      key: route.key,
      label: '',
      accessibilityLabel: home ? 'Cloud' : settings ? 'Settings' : gallery ? 'Device' : 'Albums',
      activeIcon: home ? ActiveHomeIcon : settings ? ActiveSettingsIcon : gallery ? ActiveGalleryIcon : ActiveExploreIcon,
      inactiveIcon: home ? HomeIcon : settings ? SettingsIcon : gallery ? GalleryIcon : ExploreIcon,
      labelStyle: tw`text-base font-medium`,
    };
  }), [state.routes]);

  if (keyboardVisible || selectionActive) return null;

  return (
    <View collapsable={false} style={tw.style('absolute self-center w-11/12 max-w-sm h-16 z-20', {
      elevation: 20,
      bottom: Math.max(insets.bottom, 12) + 12,
    })}>
      <JellyTabBarHeadless
        items={items}
        selectedIndex={state.index}
        colors={{
          surface: colors.backgroundElement,
          selectedSurface: colors.backgroundSelected,
          activeContent: colors.text,
          inactiveContent: colors.textSecondary,
        }}
        onTabPress={({ index }) => {
          const route = state.routes[index];
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (event.defaultPrevented) return false;
          if (index !== state.index) navigation.navigate(route.name, route.params);
        }}
        onTabLongPress={({ index }) => {
          navigation.emit({ type: 'tabLongPress', target: state.routes[index].key });
        }}
      />
    </View>
  );
}

export default function AppTabs() {
  const colors = useTheme();
  const { NavigationContent, state, navigation } = useTabsWithTriggers({
    triggers: [
      { type: 'internal', name: 'home', href: '/' },
      { type: 'internal', name: 'gallery', href: '/gallery' },
      { type: 'internal', name: 'explore', href: '/explore' },
      { type: 'internal', name: 'settings', href: '/settings' },
    ],
    backBehavior: 'history',
  });
  return (
    <NavigationContent>
      <View style={tw.style('flex-1', { backgroundColor: colors.background })}>
        <View style={tw`flex-1`}><TabSlot detachInactiveScreens={false} style={tw`flex-1`} /></View>
        <FloatingTabBar state={state} navigation={navigation} />
      </View>
    </NavigationContent>
  );
}
