import { useEffect, useMemo, useState } from 'react';
import { Image } from 'expo-image';
import { TabSlot, useTabsWithTriggers } from 'expo-router/ui';
import { Keyboard, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { JellyTabBarHeadless, type TabsIconProps, type TabsItem } from 'react-native-jelly-tabs';

import { useTheme } from '@/hooks/use-theme';
import tw from '@/lib/tw';

type TabBarProps = Pick<ReturnType<typeof useTabsWithTriggers>, 'state' | 'navigation'>;

function HomeIcon({ color }: TabsIconProps) {
  return <Image source={require('@/assets/images/tabIcons/home-outline.svg')} tintColor={color} contentFit="contain" style={tw`h-7 w-7`} />;
}

function ExploreIcon({ color }: TabsIconProps) {
  return <Image source={require('@/assets/images/tabIcons/explore-outline.svg')} tintColor={color} contentFit="contain" style={tw`h-7 w-7`} />;
}

function ActiveHomeIcon(props: TabsIconProps) {
  return (
    <View style={tw`flex-row items-center gap-2 px-2`}>
      <HomeIcon {...props} />
      <Text numberOfLines={1} style={tw.style('text-base font-medium', { color: props.color })}>Home</Text>
    </View>
  );
}

function ActiveExploreIcon(props: TabsIconProps) {
  return (
    <View style={tw`flex-row items-center gap-2 px-2`}>
      <ExploreIcon {...props} />
      <Text numberOfLines={1} style={tw.style('text-base font-medium', { color: props.color })}>Explore</Text>
    </View>
  );
}

function FloatingTabBar({ state, navigation }: TabBarProps) {
  const colors = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const items = useMemo<TabsItem[]>(() => state.routes.map((route) => {
    const home = route.name === 'index' || route.name === 'home';
    return {
      key: route.key,
      label: '',
      accessibilityLabel: home ? 'Home' : 'Explore',
      activeIcon: home ? ActiveHomeIcon : ActiveExploreIcon,
      inactiveIcon: home ? HomeIcon : ExploreIcon,
      labelStyle: tw`text-base font-medium`,
    };
  }), [state.routes]);

  if (keyboardVisible) return null;

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
      { type: 'internal', name: 'explore', href: '/explore' },
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
