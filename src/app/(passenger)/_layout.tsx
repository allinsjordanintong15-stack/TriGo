import { LoadingScreen } from '@/components/LoadingScreen';
import { BookingDraftProvider } from '@/contexts/BookingDraftContext';
import { useAuth } from '@/hooks/useAuth';
import { Redirect, Stack } from 'expo-router';

export default function PassengerLayout() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
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
