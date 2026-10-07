import type { ConfigContext, ExpoConfig } from 'expo/config';
import app from './app.json';

export default ({ config }: ConfigContext): ExpoConfig => {
  const projectId = process.env.EXPO_PROJECT_ID?.trim() || config.extra?.eas?.projectId;
  return {
    ...config,
    name: config.name ?? app.expo.name,
    slug: config.slug ?? app.expo.slug,
    extra: { ...config.extra, ...(projectId ? { eas: { ...config.extra?.eas, projectId } } : {}) },
  };
};
