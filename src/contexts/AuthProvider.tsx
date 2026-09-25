import { AuthContext, AuthContextValue } from '@/hooks/useAuth';
import { getUserProfile } from '@/services/authService';
import { subscribeToDriverRecord } from '@/services/driverService';
import { DriverRecord, DriverUser, Passenger, User } from '@/types';
import { auth } from '@/firebase';
import { isMobileUserRole } from '@/utils/roleRoutes';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [driverRecord, setDriverRecord] = useState<DriverRecord | null>(null);
  // uid whose drivers/{uid} snapshot has been received (or failed), so the driver area
  // never renders against a record that belongs to a previous session.
  const [driverRecordLoadedFor, setDriverRecordLoadedFor] = useState<string | null>(null);

  // Only the most recent profile load may update state. During registration the
  // auth listener's load can resolve after refreshProfile() and must not clobber it.
  const latestLoadId = useRef(0);

  const loadProfile = useCallback(async (user: FirebaseUser | null) => {
    const loadId = ++latestLoadId.current;

    if (!user) {
      setProfile(null);
      return;
    }

    try {
      const loaded = await getUserProfile(user.uid);
      if (loadId !== latestLoadId.current) return;
      setProfile(loaded);
    } catch {
      if (loadId !== latestLoadId.current) return;
      // Keep the current profile on a transient failure (e.g. offline) for the same user.
      setProfile((current) => (current?.uid === user.uid ? current : null));
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

  // Drivers always have a drivers/{uid} record; passengers get one once an admin approves
  // their driver application. Keep it live so admin changes apply immediately.
  const driverUid = profile && isMobileUserRole(profile.role) ? profile.uid : null;

  useEffect(() => {
    if (!driverUid) {
      setDriverRecord(null);
      setDriverRecordLoadedFor(null);
      return;
    }

    return subscribeToDriverRecord(
      driverUid,
      (record) => {
        setDriverRecord(record);
        setDriverRecordLoadedFor(driverUid);
      },
      () => {
        setDriverRecord(null);
        setDriverRecordLoadedFor(driverUid);
      },
    );
  }, [driverUid]);

  const value = useMemo<AuthContextValue>(() => {
    const role = profile?.role ?? null;
    const isDriver = role === 'driver';
    const driverRecordLoaded = profile !== null && driverRecordLoadedFor === profile.uid;
    const currentDriverRecord = driverRecordLoaded ? driverRecord : null;

    return {
      firebaseUser,
      role,
      profile,
      passenger: role === 'passenger' ? (profile as Passenger) : null,
      driver: isDriver ? (profile as DriverUser) : null,
      driverRecord: currentDriverRecord,
      driverRecordLoaded,
      isVerifiedDriver: currentDriverRecord?.isVerified === true,
      hasDriverMode: isDriver || (role === 'passenger' && currentDriverRecord !== null),
      // Driver accounts wait for their record; passenger screens do not need it to render.
      isLoading: isLoading || (isDriver && !driverRecordLoaded),
      isAuthenticated: Boolean(firebaseUser && isMobileUserRole(role)),
      refreshProfile,
    };
  }, [firebaseUser, profile, driverRecord, driverRecordLoadedFor, isLoading, refreshProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
