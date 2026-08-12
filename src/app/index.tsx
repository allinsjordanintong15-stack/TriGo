import { LoadingScreen } from '@/components/LoadingScreen';
import { useAuth } from '@/hooks/useAuth';
import { Redirect } from 'expo-router';

export default function IndexScreen() {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isAuthenticated) {
    return <Redirect href="/(passenger)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}
