import { FirebaseError } from 'firebase/app';

const FIREBASE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use':
    'An account with this email already exists. Please log in or use a different email.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/weak-password': 'Password is too weak. Please choose a stronger password.',
  'auth/user-not-found': 'No account found with this email. Please check your email or register.',
  'auth/wrong-password': 'Incorrect password. Please try again.',
  'auth/invalid-credential': 'Invalid email or password. Please try again.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed':
    'Unable to connect. Please check your internet connection and try again.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
};

// Firestore error codes are not prefixed (e.g. 'permission-denied'), so they
// cannot collide with the 'auth/...' codes above.
const FIRESTORE_ERROR_MESSAGES: Record<string, string> = {
  'permission-denied':
    'We could not access your account data (permission denied). Please contact support.',
  unavailable:
    'Unable to reach the TriGo server. Please check your internet connection and try again.',
  'deadline-exceeded': 'The server took too long to respond. Please try again.',
  unauthenticated: 'Your session has expired. Please log in again.',
};

/** Logs the underlying Firebase error code in development builds only. */
export function logFirebaseError(context: string, error: unknown): void {
  if (!__DEV__) return;
  const code = error instanceof FirebaseError ? error.code : 'non-firebase-error';
  console.warn(`[${context}] ${code}`, error);
}

export function getFirebaseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof FirebaseError) {
    return (
      FIREBASE_AUTH_ERROR_MESSAGES[error.code] ?? FIRESTORE_ERROR_MESSAGES[error.code] ?? fallback
    );
  }

  if (error instanceof Error && error.message.includes('network')) {
    return 'Unable to connect. Please check your internet connection and try again.';
  }

  return fallback;
}

export function getFirstValidationError(errors: Record<string, string>): string {
  const firstKey = Object.keys(errors)[0];
  return firstKey ? errors[firstKey] : 'Please check your input and try again.';
}
