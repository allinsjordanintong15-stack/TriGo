import { docToUser } from '@/services/userMapper';
import { PASSENGER_ROLE } from '@/constants';
import { auth, COLLECTIONS, firestore } from '@/firebase';
import { LoginInput, Passenger, RegisterPassengerInput, User } from '@/types';
import { getFirebaseErrorMessage } from '@/utils/errors';
import {
  normalizeMobileNumber,
  validateEmail,
  validateLoginInput,
  validateRegisterInput,
} from '@/validations/auth';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = 'AuthServiceError';
  }
}

async function createPassengerProfile(
  firebaseUser: FirebaseUser,
  fullName: string,
  mobileNumber: string,
): Promise<Passenger> {
  const userRef = doc(firestore, COLLECTIONS.users, firebaseUser.uid);
  const now = serverTimestamp();

  const userData = {
    uid: firebaseUser.uid,
    fullName: fullName.trim(),
    email: firebaseUser.email ?? '',
    mobileNumber: normalizeMobileNumber(mobileNumber),
    role: PASSENGER_ROLE,
    profileImage: firebaseUser.photoURL ?? null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(userRef, userData);

  const snapshot = await getDoc(userRef);
  if (!snapshot.exists()) {
    throw new AuthServiceError('Unable to create your profile. Please try again.');
  }

  return docToUser(snapshot) as Passenger;
}

export async function registerPassenger(
  input: RegisterPassengerInput,
): Promise<Passenger> {
  const validation = validateRegisterInput(input);
  if (!validation.isValid) {
    throw new AuthServiceError(
      'Please fix the errors in the form.',
      validation.errors,
    );
  }

  try {
    const credential = await createUserWithEmailAndPassword(
      auth,
      input.email.trim().toLowerCase(),
      input.password,
    );

    await updateProfile(credential.user, {
      displayName: input.fullName.trim(),
    });

    return await createPassengerProfile(
      credential.user,
      input.fullName,
      input.mobileNumber,
    );
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError(
      getFirebaseErrorMessage(
        error,
        'Unable to create your account. Please try again.',
      ),
    );
  }
}

export async function loginPassenger(input: LoginInput): Promise<Passenger> {
  const validation = validateLoginInput(input.email, input.password);
  if (!validation.isValid) {
    throw new AuthServiceError(
      'Please fix the errors in the form.',
      validation.errors,
    );
  }

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      input.email.trim().toLowerCase(),
      input.password,
    );

    const profile = await getUserProfile(credential.user.uid);
    if (!profile) {
      await signOut(auth);
      throw new AuthServiceError(
        'Your profile could not be found. Please contact support.',
      );
    }

    if (profile.role !== PASSENGER_ROLE) {
      await signOut(auth);
      throw new AuthServiceError(
        'This account is not authorized for passenger access.',
      );
    }

    return profile as Passenger;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      throw error;
    }

    throw new AuthServiceError(
      getFirebaseErrorMessage(error, 'Unable to log in. Please try again.'),
    );
  }
}

export async function getUserProfile(uid: string): Promise<User | null> {
  const userRef = doc(firestore, COLLECTIONS.users, uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    return null;
  }

  return docToUser(snapshot);
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const trimmedEmail = email.trim().toLowerCase();
  const emailError = validateEmail(trimmedEmail);
  if (emailError) {
    throw new AuthServiceError(emailError);
  }

  try {
    await sendPasswordResetEmail(auth, trimmedEmail);
  } catch (error) {
    throw new AuthServiceError(
      getFirebaseErrorMessage(
        error,
        'Unable to send password reset email. Please try again.',
      ),
    );
  }
}

export function getCurrentFirebaseUser(): FirebaseUser | null {
  return auth.currentUser;
}
