import { AuthContext, AuthContextValue } from '@/hooks/useAuth';
import { getUserProfile } from '@/services/authService';
import { PASSENGER_ROLE } from '@/constants';
import { Passenger } from '@/types';
import { auth } from '@/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (user: FirebaseUser | null) => {
    if (!user) {
      setPassenger(null);
      return;
    }

    const profile = await getUserProfile(user.uid);
    if (profile?.role === PASSENGER_ROLE) {
      setPassenger(profile as Passenger);
      return;
    }

    setPassenger(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(auth.currentUser);
  }, [loadProfile]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      try {
        await loadProfile(user);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      passenger,
      isLoading,
      isAuthenticated: Boolean(firebaseUser && passenger),
      refreshProfile,
    }),
    [firebaseUser, passenger, isLoading, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
