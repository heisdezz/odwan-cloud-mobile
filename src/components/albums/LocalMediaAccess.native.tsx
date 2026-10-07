import { useState, type PropsWithChildren } from 'react';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { ActivityIndicator, Linking, Platform, Text, View } from 'react-native';
import { toast } from 'sonner-native';
import { Button } from '@/components/ui';
import { extract_message } from '@/helpers/api';
import { useTheme } from '@/hooks/use-theme';
import { presentPermissionsPicker } from '@/lib/device-media.native';
import tw from '@/lib/tw';
import { useGallerySync } from '@/providers/gallery-sync-provider.native';

export default function LocalMediaAccess({ children }: PropsWithChildren) {
  const colors = useTheme();
  const { permission, allowed, cacheReadable, requestPermission, refresh } = useGallerySync();
  const [requesting, setRequesting] = useState(false);
  const request = async () => {
    setRequesting(true);
    try {
      if (permission && !permission.canAskAgain) await Linking.openSettings();
      else await requestPermission();
    } catch (error) { toast.error(extract_message(error)); }
    finally { setRequesting(false); }
  };
  if (Platform.OS === 'android' && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return <View style={tw`flex-1 justify-center px-6 gap-3 pb-24`}>
    <Text style={tw.style('text-xl text-center font-medium', { color: colors.text })}>Device albums need an Odwan build</Text>
    <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Install the Odwan APK to browse albums on this device.</Text>
  </View>;
  if (!permission) return <ActivityIndicator style={tw`flex-1`} color={colors.text} />;
  if (!allowed) return <View style={tw`flex-1 justify-center px-6 gap-4 pb-24`}>
    <Text style={tw.style('text-xl font-medium text-center', { color: colors.text })}>Albums on your device</Text>
    <Text style={tw.style('text-base text-center', { color: colors.textSecondary })}>Allow access to photos and videos to browse your device albums.</Text>
    <Button label={permission.canAskAgain ? 'Allow gallery access' : 'Open app settings'} loading={requesting} onPress={() => { void request(); }} />
  </View>;
  if (!cacheReadable) return <ActivityIndicator style={tw`flex-1`} color={colors.text} />;
  return <View style={tw`flex-1`}>
    {permission.accessPrivileges === 'limited' && <View style={tw`px-6 pb-3 gap-2`}>
      <Text style={tw.style('text-sm', { color: colors.textSecondary })}>Showing only photos and videos you allowed.</Text>
      <Button variant="text" label="Manage access" onPress={() => {
        void presentPermissionsPicker().then(() => refresh()).catch((error) => toast.error(extract_message(error)));
      }} />
    </View>}
    {children}
  </View>;
}
