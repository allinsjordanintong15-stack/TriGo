import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { auth } from '../firebase/config';

export const NOT_ADMIN_MESSAGE = 'This account does not have admin access.';

type AuthState = {
  /** Signed-in user with the `admin` custom claim, or null. */
  admin: User | null;
  /** True until the first auth state (and claim check) has resolved. */
  loading: boolean;
  /** Message to show on the login page, e.g. after a non-admin was signed out. */
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOutAdmin: () => Promise<void>;
  clearError: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

/** True only when the ID token carries `admin: true` (set by scripts/setAdminClaim.mjs). */
async function hasAdminClaim(user: User): Promise<boolean> {
  // Force a refresh so a claim granted or revoked since the last sign-in is seen now.
  const token = await user.getIdTokenResult(true);
  return token.claims.admin === true;
}

function signInErrorMessage(error: unknown): string {
  const code = (error as { code?: string }).code;
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
    case 'auth/invalid-email':
      return 'Incorrect email or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return 'Sign-in failed. Please try again.';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdmin(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      let isAdmin = false;
      try {
        isAdmin = await hasAdminClaim(user);
      } catch {
        isAdmin = false;
      }
      if (isAdmin) {
        setAdmin(user);
      } else {
        setAdmin(null);
        setError(NOT_ADMIN_MESSAGE);
        await signOut(auth);
      }
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      setError(signInErrorMessage(e));
    }
  }, []);

  const signOutAdmin = useCallback(async () => {
    setError(null);
    await signOut(auth);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = useMemo(
    () => ({ admin, loading, error, signIn, signOutAdmin, clearError }),
    [admin, loading, error, signIn, signOutAdmin, clearError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>.');
  }
  return context;
}
