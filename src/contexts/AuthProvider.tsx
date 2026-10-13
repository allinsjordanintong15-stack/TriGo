import { AuthContext, AuthContextValue } from '@/hooks/useAuth';
import { getUserProfile } from '@/services/authService';
import { syncOwnContact } from '@/services/contactService';
import { subscribeToDriverApplication } from '@/services/driverApplicationService';
import { subscribeToDriverRecord } from '@/services/driverService';
import { DriverApplicationStatus, DriverRecord, DriverUser, Passenger, User } from '@/types';
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
  // Passengers in driver mode: their driverApplications/{uid} status, which Firestore rules
  // check (with drivers/{uid}) to grant driver access. `loadedFor` works as above.
  const [applicationStatus, setApplicationStatus] = useState<DriverApplicationStatus | null>(
    null,
  );
  const [applicationLoadedFor, setApplicationLoadedFor] = useState<string | null>(null);

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
      if (loaded) {
        syncOwnContact(loaded).catch(() => {
          // Retried on the next profile load; trips only lose the Call button meanwhile.
        });
      }
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

  // Only passengers with a driver record need it: a `driver` account has driver access by role.
  const applicationUid =
    profile?.role === 'passenger' && driverRecord !== null && driverRecordLoadedFor === profile.uid
      ? profile.uid
      : null;

  useEffect(() => {
    if (!applicationUid) {
      setApplicationStatus(null);
      setApplicationLoadedFor(null);
      return;
    }

    return subscribeToDriverApplication(
      applicationUid,
      (application) => {
        setApplicationStatus(application?.status ?? null);
        setApplicationLoadedFor(applicationUid);
      },
      () => {
        setApplicationStatus(null);
        setApplicationLoadedFor(applicationUid);
      },
    );
  }, [applicationUid]);

  const value = useMemo<AuthContextValue>(() => {
    const role = profile?.role ?? null;
    const isDriver = role === 'driver';
    // A passenger's driver record is exposed only once their application status is known,
    // so driver screens never briefly treat them as lacking the driver role.
    const driverRecordLoaded =
      profile !== null &&
      driverRecordLoadedFor === profile.uid &&
      (role !== 'passenger' || driverRecord === null || applicationLoadedFor === profile.uid);
    const currentDriverRecord = driverRecordLoaded ? driverRecord : null;
    // Mirrors isDriver() in firestore.rules: a `driver` account, or a passenger whose
    // driver application was approved (and who has a drivers/{uid} record).
    const hasDriverRole =
      isDriver ||
      (role === 'passenger' && currentDriverRecord !== null && applicationStatus === 'approved');

    return {
      firebaseUser,
      role,
      profile,
      passenger: role === 'passenger' ? (profile as Passenger) : null,
      driver: isDriver ? (profile as DriverUser) : null,
      driverRecord: currentDriverRecord,
      driverRecordLoaded,
      hasDriverRole,
      // Mirrors isVerifiedDriver() in firestore.rules.
      isVerifiedDriver: hasDriverRole && currentDriverRecord?.isVerified === true,
      hasDriverMode: isDriver || (role === 'passenger' && currentDriverRecord !== null),
      // Driver accounts wait for their record; passenger screens do not need it to render.
      isLoading: isLoading || (isDriver && !driverRecordLoaded),
      isAuthenticated: Boolean(firebaseUser && isMobileUserRole(role)),
      refreshProfile,
    };
  }, [
    firebaseUser,
    profile,
    driverRecord,
    driverRecordLoadedFor,
    applicationStatus,
    applicationLoadedFor,
    isLoading,
    refreshProfile,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
