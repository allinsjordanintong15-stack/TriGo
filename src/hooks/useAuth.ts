import { createContext, useContext } from 'react';
import { Passenger } from '@/types';
import { User as FirebaseUser } from 'firebase/auth';

export interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  passenger: Passenger | null;
  isLoading: boolean;
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
