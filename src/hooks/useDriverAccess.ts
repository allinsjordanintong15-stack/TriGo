import { useAuth } from '@/hooks/useAuth';
import { DriverRecord, VehicleType } from '@/types';

const VEHICLE_TYPES: readonly string[] = ['tricycle', 'motorcycle'] satisfies VehicleType[];

/**
 * `role_not_authorized`: a drivers/{uid} record exists, but the account itself lacks driver
 * access in Firestore rules (users/{uid}.role is not `driver` and there is no approved
 * driver application), so every driver read and write would be denied.
 *
 * `invalid_vehicle_type`: drivers/{uid}.vehicleType is not exactly a known vehicle type
 * (e.g. "motorcycle " with a trailing space), so no booking query would ever match it.
 * The stored value is only checked here, never trimmed or rewritten.
 *
 * `revoked`: an admin revoked this driver's verification (DriverRecord.isRevoked), as
 * opposed to `pending_verification`, a record that was never verified.
 */
export type DriverAccessStatus =
  | 'no_record'
  | 'role_not_authorized'
  | 'invalid_vehicle_type'
  | 'revoked'
  | 'pending_verification'
  | 'verified';

/** Shown on Home, Requests and Profile; never includes the admin's private reason. */
export const DRIVER_ACCESS_REVOKED = {
  title: 'Driver access revoked',
  message: 'Please contact the TriGo administrator.',
} as const;

export interface DriverAccess {
  status: DriverAccessStatus;
  driverRecord: DriverRecord | null;
  /** Driver booking actions (reviewing requests, proposing fares, trips) require this. */
  canPerformDriverActions: boolean;
}

export function useDriverAccess(): DriverAccess {
  const { driverRecord, hasDriverRole, isVerifiedDriver } = useAuth();

  const status: DriverAccessStatus = !driverRecord
    ? 'no_record'
    : !hasDriverRole
      ? 'role_not_authorized'
      : driverRecord.isRevoked
        ? 'revoked'
        : !VEHICLE_TYPES.includes(driverRecord.vehicleType)
          ? 'invalid_vehicle_type'
          : isVerifiedDriver
            ? 'verified'
            : 'pending_verification';

  return {
    status,
    driverRecord,
    canPerformDriverActions: status === 'verified',
  };
}
