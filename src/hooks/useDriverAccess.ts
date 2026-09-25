import { useAuth } from '@/hooks/useAuth';
import { DriverRecord } from '@/types';

export type DriverAccessStatus = 'no_record' | 'pending_verification' | 'verified';

export interface DriverAccess {
  status: DriverAccessStatus;
  driverRecord: DriverRecord | null;
  /** Driver booking actions (reviewing requests, proposing fares, trips) require this. */
  canPerformDriverActions: boolean;
}

export function useDriverAccess(): DriverAccess {
  const { driverRecord, isVerifiedDriver } = useAuth();

  const status: DriverAccessStatus = !driverRecord
    ? 'no_record'
    : isVerifiedDriver
      ? 'verified'
      : 'pending_verification';

  return {
    status,
    driverRecord,
    canPerformDriverActions: status === 'verified',
  };
}
