/* eslint-disable @typescript-eslint/no-require-imports -- Expo Go has no background service module. */
import { AppState, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import type BackgroundService from 'react-native-background-actions';

const service: typeof BackgroundService | null = Platform.OS === 'android' && NativeModules.RNBackgroundActions
  ? require('react-native-background-actions').default : null;
export const backgroundUploadsAvailable = !!service;
export const backgroundUploadsRunning = () => service?.isRunning() ?? false;
let permissionRequested = false;
type UploadNotice = { description: string; percent?: number | null };
let latest: UploadNotice | null = null;
let updating: Promise<void> | null = null;
const noticeOptions = ({ description, percent }: UploadNotice) => ({ taskDesc: description,
  progressBar: { max: 100, value: percent ?? 0, indeterminate: percent == null } });

export async function startUploadBackground() {
  if (!service || service.isRunning()) return;
  if (AppState.currentState !== 'active') throw new Error('Return to the app to resume background uploads.');
  if (Number(Platform.Version) >= 33 && !await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS)) {
    const result = permissionRequested ? null : await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    permissionRequested = true;
    if (result !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Allow notifications in Android settings to enable background uploads.');
  }
  // Permission dialogs may background the activity. Never start a service there.
  if (AppState.currentState !== 'active') throw new Error('Return to the app to resume background uploads.');
  let started!: () => void;
  const ready = new Promise<void>((resolve) => { started = resolve; });
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await service.start(async () => {
      started();
      // The library's stop() releases its HeadlessJS promise. Holding it keeps
      // the existing single worker alive without launching a second uploader.
      await new Promise<void>(() => {});
    }, { taskName: 'OdwanUploads', taskTitle: 'Uploading to cloud', taskDesc: 'Preparing upload queue',
      taskIcon: { name: 'ic_menu_upload', type: 'drawable', package: 'android' },
      linkingURI: 'odwan://uploads/current', foregroundServiceType: ['dataSync'],
      progressBar: { max: 1, value: 0, indeterminate: true } });
    await Promise.race([ready, new Promise<never>((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Background upload service did not start.')), 5000);
    })]);
    if (latest) await updateUploadNotification(latest.description, latest.percent);
  } catch (error) { await service.stop(); throw error; }
  finally { if (timeout) clearTimeout(timeout); }
}
export async function stopUploadBackground() {
  latest = null;
  await updating?.catch(() => {});
  if (service?.isRunning()) await service.stop();
}
export async function updateUploadNotification(description: string, percent?: number | null) {
  latest = { description, percent };
  if (!service?.isRunning()) return;
  if (!updating) {
    updating = (async () => {
      while (latest && service.isRunning()) {
        const notice: UploadNotice = latest;
        await service.updateNotification(noticeOptions(notice));
        if (latest === notice) break;
      }
    })().finally(() => { updating = null; });
  }
  await updating;
}
