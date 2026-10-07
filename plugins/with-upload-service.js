const { withAndroidManifest } = require('expo/config-plugins');

const SERVICE = 'com.asterinet.react.bgactions.RNBackgroundActionsTask';
function configureUploadService(manifest) {
  const permissions = manifest['uses-permission'] ??= [];
  for (const name of ['FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_DATA_SYNC', 'POST_NOTIFICATIONS', 'WAKE_LOCK']) {
    const permission = `android.permission.${name}`;
    if (!permissions.some((entry) => entry.$['android:name'] === permission)) permissions.push({ $: { 'android:name': permission } });
  }
  const application = manifest.application[0];
  const services = application.service ??= [];
  let service = services.find((entry) => entry.$['android:name'] === SERVICE);
  if (!service) { service = { $: { 'android:name': SERVICE } }; services.push(service); }
  service.$['android:foregroundServiceType'] = 'dataSync';
  service.$['android:exported'] = 'false';
  service.$['android:stopWithTask'] = 'false';
  return manifest;
}
module.exports = (config) => withAndroidManifest(config, (mod) => {
  configureUploadService(mod.modResults.manifest);
  return mod;
});
module.exports.configureUploadService = configureUploadService;
