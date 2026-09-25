import { ExpoConfig, ConfigContext } from 'expo/config';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'TriGo',
  slug: 'TriGo',
  scheme: 'trigo',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'TriGo uses your location to set pickup points and show your ride on the map.',
    },
  },
  android: {
    ...config.android,
    package: config.android?.package ?? 'com.trigo.passenger',
      adaptiveIcon: {
        backgroundColor: '#E8F3EC',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'CAMERA'],
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: GOOGLE_MAPS_API_KEY,
      },
    },
  },
  web: {
    favicon: './assets/favicon.png',
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
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: GOOGLE_MAPS_API_KEY,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    ...config.extra,
    googleMapsApiKeyConfigured: Boolean(GOOGLE_MAPS_API_KEY),
  },
});
