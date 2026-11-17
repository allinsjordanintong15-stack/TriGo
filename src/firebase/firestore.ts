import { firebaseApp } from '@/firebase/config';
import { Firestore, getFirestore } from 'firebase/firestore';

export const firestore: Firestore = getFirestore(firebaseApp);

// The app has no emulator mode: it always uses the project in .env
// (EXPO_PUBLIC_FIREBASE_PROJECT_ID). Logged once when this module first loads, so Metro
// shows which backend a dev build talks to. Emulator testing is the rules tests and the
// admin website's `npm run dev:emulator`.
console.info(`[Firestore target] production (${firebaseApp.options.projectId ?? 'no project id'})`);

export const COLLECTIONS = {
  users: 'users',
  contacts: 'contacts',
  bookings: 'bookings',
  ratings: 'ratings',
  driverRatings: 'driverRatings',
  fareSettings: 'fareSettings',
  barangayTariffs: 'barangayTariffs',
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
  quotaSettings: 'quotaSettings',
  deletionRequests: 'deletionRequests',
  warnings: 'warnings',
  adminMessages: 'adminMessages',
} as const;
