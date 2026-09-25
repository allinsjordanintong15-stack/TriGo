import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PLACEHOLDER_KEY_PATTERNS = [
  /^YOUR_/i,
  /^your_/i,
  /YOUR_GOOGLE_MAPS_API_KEY/i,
  /YOUR_API_KEY/i,
  /^AIzaSy\.{3,}$/,
];

export function isExpoGo(): boolean {
  return Constants.appOwnership === 'expo';
}

export function isDevelopmentBuild(): boolean {
  return Constants.executionEnvironment === 'bare' || Constants.appOwnership === null;
}

export function getGoogleMapsApiKey(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const fromExtra = Constants.expoConfig?.extra?.googleMapsApiKeyConfigured;
  if (fromExtra === false) {
    return undefined;
  }

  return undefined;
}

export function isGoogleMapsApiKeyConfigured(): boolean {
  const key = getGoogleMapsApiKey();
  if (!key) {
    return false;
  }

  return !PLACEHOLDER_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

export function getMapLoadErrorMessage(): string {
  const lines = [
    'Google Maps failed to load.',
    '',
    'Check:',
    '1. Google Maps API key (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)',
    '2. Maps SDK for Android enabled in Google Cloud',
    '3. Android package name (com.trigo.passenger)',
    '4. SHA-1 certificate fingerprint on the API key',
    '5. react-native-maps plugin in app.config.ts',
    '6. Rebuild the Android app after native config changes',
  ];

  if (isExpoGo()) {
    lines.push('', 'You are running in Expo Go — native API key config does not apply.');
    lines.push('If the map is still black, confirm Google Play Services is installed.');
  } else if (!isGoogleMapsApiKeyConfigured()) {
    lines.push('', 'No valid Google Maps API key was found for this build.');
  }

  return lines.join('\n');
}

export function logMapDiagnostics(): void {
  if (!__DEV__) {
    return;
  }

  console.log('[TriGo Map] Platform:', Platform.OS);
  console.log('[TriGo Map] Running in Expo Go:', isExpoGo());
  console.log(
    '[TriGo Map] Google Maps API key configured:',
    isGoogleMapsApiKeyConfigured() ? 'yes' : 'no',
  );
  console.log('[TriGo Map] Google Maps configuration loaded');
}
