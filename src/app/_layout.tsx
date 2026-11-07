import { LegalConsentGate } from '@/components/legal/LegalConsentGate';
import { AuthProvider } from '@/contexts/AuthProvider';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(passenger)" />
          <Stack.Screen name="(driver)" />
          <Stack.Screen name="legal/index" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="legal/[document]" options={{ animation: 'slide_from_right' }} />
        </Stack>
        {/* Over every screen: passengers and drivers without the current legal version. */}
        <LegalConsentGate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
