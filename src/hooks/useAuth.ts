import { createContext, useContext } from 'react';
import { DriverRecord, DriverUser, Passenger, User, UserRole } from '@/types';
import { User as FirebaseUser } from 'firebase/auth';

export interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  /** Role from `users/{uid}`; null when signed out or the profile is missing. */
  role: UserRole | null;
  /** The signed-in user's `users/{uid}` profile, whatever the role. */
  profile: User | null;
  /** Set only when the signed-in user is a passenger. */
  passenger: Passenger | null;
  /** Set only when the signed-in user is a driver (`users/{uid}` account details). */
  driver: DriverUser | null;
  /**
   * The user's `drivers/{uid}` record; null when none exists. Driver accounts always get
   * one from an admin; a passenger gets one when an admin approves their driver application.
   */
  driverRecord: DriverRecord | null;
  /** True once the `drivers/{uid}` lookup has finished for the signed-in user. */
  driverRecordLoaded: boolean;
  /** True only when the `drivers/{uid}` record is verified by an admin. */
  isVerifiedDriver: boolean;
  /** Driver accounts, and passengers whose driver application was approved (driver record exists). */
  hasDriverMode: boolean;
  isLoading: boolean;
  /** True when signed in with a role that has a mobile interface (passenger or driver). */
  isAuthenticated: boolean;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}
