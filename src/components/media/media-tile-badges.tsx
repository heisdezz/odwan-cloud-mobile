import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';
import type { BackupStatus } from '@/db/schema';
import tw from '@/lib/tw';

const backupIcons: Record<BackupStatus | 'untracked', SymbolViewProps['name']> = {
  untracked: { ios: 'icloud.slash', android: 'cloud_off', web: 'cloud_off' },
  pending: { ios: 'icloud.and.arrow.up', android: 'cloud_upload', web: 'cloud_upload' },
  uploading: { ios: 'arrow.triangle.2.circlepath', android: 'sync', web: 'sync' },
  backed_up: { ios: 'checkmark.icloud', android: 'cloud_done', web: 'cloud_done' },
  error: { ios: 'exclamationmark.icloud', android: 'error_outline', web: 'error_outline' },
};

// Decorative overlays: the enclosing tile announces media type and backup state.
export function MediaTileBadges({ video, showBackup = false, status }: {
  video: boolean;
  showBackup?: boolean;
  status?: BackupStatus;
}) {
  return <View pointerEvents="none" accessible={false} style={tw`absolute inset-0`}>
    {video && <View style={tw`absolute top-1 right-1 rounded bg-black/70 p-1`}>
      <SymbolView name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }} size={16} tintColor="white" />
    </View>}
    {showBackup && <View style={tw`absolute bottom-1 right-1 rounded bg-black/70 p-1`}>
      <SymbolView name={backupIcons[status ?? 'untracked']} size={16} tintColor="white" />
    </View>}
  </View>;
}
