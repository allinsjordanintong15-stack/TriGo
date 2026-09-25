import { useAuth } from '@/hooks/useAuth';
import { subscribeToDriverApplication } from '@/services/driverApplicationService';
import { DriverApplication } from '@/types';
import { useEffect, useState } from 'react';

export interface DriverApplicationState {
  application: DriverApplication | null;
  /** True until the first snapshot for the signed-in user arrives. */
  loading: boolean;
  error: string;
}

/** Live state of the signed-in user's own driver application. */
export function useDriverApplication(): DriverApplicationState {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;
  const [application, setApplication] = useState<DriverApplication | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setApplication(null);
    setLoadedFor(null);
    setError('');
    if (!uid) return;

    return subscribeToDriverApplication(
      uid,
      (updated) => {
        setApplication(updated);
        setLoadedFor(uid);
        setError('');
      },
      () => {
        setLoadedFor(uid);
        setError('Unable to load your driver application status.');
      },
    );
  }, [uid]);

  return { application, loading: uid !== null && loadedFor !== uid, error };
}
