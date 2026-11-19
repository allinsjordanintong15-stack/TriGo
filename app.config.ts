import { ExpoConfig, ConfigContext } from 'expo/config';

// APP_VARIANT (set per EAS build profile in eas.json): 'preview' builds install next to the
// development client and the production app, with their own package / bundle ID, name and
// link scheme. Anything else (unset) = the normal app.
const IS_PREVIEW = process.env.APP_VARIANT === 'preview';

const BASE_ID = 'com.trigo.passenger';
const APP_ID = IS_PREVIEW ? `${BASE_ID}.preview` : BASE_ID;

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: IS_PREVIEW ? 'TriGo (Preview)' : 'TriGo',
  slug: 'TriGo',
  scheme: IS_PREVIEW ? 'trigo-preview' : 'trigo',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: APP_ID,
    // Camera and photo library texts come from the expo-image-picker plugin, the location
    // text from expo-location (below). Local notifications need no Info.plist text.
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'TriGo uses your location to set pickup points and show your ride on the map.',
      // Only standard HTTPS/TLS (Firebase, OpenRouteService): no export-compliance prompt.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    ...config.android,
    package: APP_ID,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#1B5E3A',
    },
    predictiveBackGestureEnabled: false,
    // VIBRATE: new-request alert for drivers (React Native Vibration).
    // POST_NOTIFICATIONS: Android 13+ local ride-request notifications (expo-notifications).
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'CAMERA',
      'VIBRATE',
      'POST_NOTIFICATIONS',
    ],
  },
  web: {
    favicon: './assets/images/icon.png',
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'TriGo uses your location to set pickup points and show your ride on the map.',
      },
    ],
    [
      'expo-image-picker',
      {
        cameraPermission:
          'TriGo uses the camera to take photos of your OR/CR and driver\'s license for your driver application.',
        photosPermission:
          'TriGo accesses your photos so you can choose images of your OR/CR and driver\'s license for your driver application.',
        microphonePermission: false,
      },
    ],
    '@maplibre/maplibre-react-native',
    [
      // Local notifications only (no push): status-bar icon is a white shape on transparent.
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#1B5E3A',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        backgroundColor: '#1B5E3A',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
  ],
   experiments: {
     typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '7a704286-e428-4379-bbc5-756e72e857c1',
    },
  },
});
