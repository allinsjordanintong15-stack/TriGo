import { LoadingScreen } from '@/components/LoadingScreen';
import { DriverActivityProvider } from '@/contexts/DriverActivityContext';
import { useAuth } from '@/hooks/useAuth';
import { goOffline } from '@/services/driverService';
import { getRoleHomeHref } from '@/utils/roleRoutes';
import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

export default function DriverLayout() {
  const { isLoading, isAuthenticated, role, driverRecord, driverRecordLoaded, hasDriverMode } =
    useAuth();

  // If an admin revokes verification while the driver is on duty, take them offline
  // so they stop appearing in passenger driver searches.
  const mustGoOffline =
    driverRecord !== null &&
    !driverRecord.isVerified &&
    (driverRecord.isOnline || driverRecord.isAvailable);
  const driverId = driverRecord?.driverId ?? null;

  useEffect(() => {
    if (mustGoOffline && driverId) {
      goOffline(driverId).catch(() => {
        // Retried on the next record update; passenger search also filters isVerified.
      });
    }
  }, [mustGoOffline, driverId]);

  if (isLoading || (isAuthenticated && !driverRecordLoaded)) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Driver mode: driver accounts, or passengers whose driver application was approved and
  // who have an admin-created drivers/{uid} record. Everyone else goes to their own home.
  if (!hasDriverMode) {
    return <Redirect href={getRoleHomeHref(role)} />;
  }

  return (
    <DriverActivityProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </DriverActivityProvider>
  );
}
