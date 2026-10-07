import { expect, test } from 'bun:test';
import plugin from '../plugins/with-upload-service';

test('Android service configuration is repeatable and adds only dataSync permissions', () => {
  const manifest = { application: [{}] };
  plugin.configureUploadService(manifest); plugin.configureUploadService(manifest);
  expect(manifest.application[0].service).toHaveLength(1);
  expect(manifest.application[0].service[0].$).toMatchObject({
    'android:name': 'com.asterinet.react.bgactions.RNBackgroundActionsTask',
    'android:foregroundServiceType': 'dataSync', 'android:exported': 'false', 'android:stopWithTask': 'false',
  });
  expect(manifest['uses-permission']).toHaveLength(4);
  expect(manifest['uses-permission'].some((permission) => permission.$['android:name'].includes('LOCATION'))).toBe(false);
});
