import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/hooks/useAuth';
import { getRoleHomeHref } from '@/utils/roleRoutes';
import { Redirect } from 'expo-router';

export default function IndexScreen() {
  const { isLoading, isAuthenticated, role } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Redirect href={getRoleHomeHref(role)} />;
  }

  return <Redirect href="/(auth)/login" />;
}
