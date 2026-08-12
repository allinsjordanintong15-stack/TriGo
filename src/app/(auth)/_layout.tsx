import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/hooks/useAuth';
import { Redirect, Stack } from 'expo-router';

export default function AuthLayout() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(passenger)/home" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
