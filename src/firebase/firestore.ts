import { firebaseApp } from '@/firebase/config';
import { Firestore, getFirestore } from 'firebase/firestore';

export const firestore: Firestore = getFirestore(firebaseApp);

export const COLLECTIONS = {
  users: 'users',
  contacts: 'contacts',
  bookings: 'bookings',
  ratings: 'ratings',
  notifications: 'notifications',
  fareSettings: 'fareSettings',
  outOfAreaRequests: 'outOfAreaRequests',
  drivers: 'drivers',
  driverApplications: 'driverApplications',
  supportContacts: 'supportContacts',
  complaints: 'complaints',
  commissionSettings: 'commissionSettings',
  paymentSettings: 'paymentSettings',
  commissions: 'commissions',
  commissionAccounts: 'commissionAccounts',
  commissionPeriods: 'commissionPeriods',
  commissionPayments: 'commissionPayments',
  paymentReferences: 'paymentReferences',
} as const;
