import { firebaseApp } from '@/firebase/config';
import { Firestore, getFirestore } from 'firebase/firestore';

export const firestore: Firestore = getFirestore(firebaseApp);

export const COLLECTIONS = {
  users: 'users',
  bookings: 'bookings',
  ratings: 'ratings',
  notifications: 'notifications',
  fareSettings: 'fareSettings',
  outOfAreaRequests: 'outOfAreaRequests',
  drivers: 'drivers',
} as const;
