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

export function getFirebaseErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof FirebaseError) {
    return FIREBASE_AUTH_ERROR_MESSAGES[error.code] ?? fallback;
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
