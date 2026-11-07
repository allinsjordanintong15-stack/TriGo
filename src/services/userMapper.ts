import { LegalConsent, User, UserRole } from '@/types';
import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';

export function timestampToDate(value: Timestamp | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return value.toDate();
}

/** users/{uid}.legalConsent, or null when missing or malformed (then the app asks again). */
export function toLegalConsent(value: unknown): LegalConsent | null {
  if (!value || typeof value !== 'object') return null;
  const { version, acceptedAt } = value as { version?: unknown; acceptedAt?: unknown };
  if (typeof version !== 'string') return null;
  if (!(acceptedAt instanceof Timestamp) && !(acceptedAt instanceof Date)) return null;
  return { version, acceptedAt: timestampToDate(acceptedAt) };
}

export function docToUser(snapshot: DocumentSnapshot<DocumentData>): User {
  const data = snapshot.data();

  if (!data) {
    throw new Error('User document is empty.');
  }

  return {
    uid: data.uid ?? snapshot.id,
    fullName: data.fullName ?? '',
    email: data.email ?? '',
    mobileNumber: data.mobileNumber ?? '',
    role: data.role as UserRole,
    profileImage: data.profileImage ?? null,
    legalConsent: toLegalConsent(data.legalConsent),
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}
