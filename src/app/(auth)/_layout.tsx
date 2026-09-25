import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/hooks/useAuth';
import { getRoleHomeHref } from '@/utils/roleRoutes';
import { Redirect, Stack } from 'expo-router';

export default function AuthLayout() {
  const { isLoading, isAuthenticated, role } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Redirect href={getRoleHomeHref(role)} />;
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
