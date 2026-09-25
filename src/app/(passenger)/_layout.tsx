import { LoadingScreen } from '@/components/LoadingScreen';
import { BookingDraftProvider } from '@/contexts/BookingDraftContext';
import { useAuth } from '@/hooks/useAuth';
import { getRoleHomeHref } from '@/utils/roleRoutes';
import { Redirect, Stack } from 'expo-router';

export default function PassengerLayout() {
  const { isLoading, isAuthenticated, role } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Passenger screens are for passengers only; other roles go to their own area.
  if (role !== 'passenger') {
    return <Redirect href={getRoleHomeHref(role)} />;
  }

  return (
    <BookingDraftProvider>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      />
    </BookingDraftProvider>
  );
}
