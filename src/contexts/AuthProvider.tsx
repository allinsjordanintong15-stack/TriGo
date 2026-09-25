import { AuthContext, AuthContextValue } from '@/hooks/useAuth';
import { getUserProfile } from '@/services/authService';
import { PASSENGER_ROLE } from '@/constants';
import { Passenger } from '@/types';
import { auth } from '@/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Only the most recent profile load may update state. During registration the
  // auth listener's load can resolve after refreshProfile() and must not clobber it.
  const latestLoadId = useRef(0);

  const loadProfile = useCallback(async (user: FirebaseUser | null) => {
    const loadId = ++latestLoadId.current;

    if (!user) {
      setPassenger(null);
      return;
    }

    try {
      const profile = await getUserProfile(user.uid);
      if (loadId !== latestLoadId.current) return;
      setPassenger(profile?.role === PASSENGER_ROLE ? (profile as Passenger) : null);
    } catch {
      if (loadId !== latestLoadId.current) return;
      // Keep the current profile on a transient failure (e.g. offline) for the same user.
      setPassenger((current) => (current?.uid === user.uid ? current : null));
    }
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
