import { User, UserRole } from '@/types';
import { DocumentData, DocumentSnapshot, Timestamp } from 'firebase/firestore';

export function timestampToDate(value: Timestamp | Date | null | undefined): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  return value.toDate();
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
    createdAt: timestampToDate(data.createdAt),
    updatedAt: timestampToDate(data.updatedAt),
  };
}
