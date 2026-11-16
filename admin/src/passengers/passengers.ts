import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';

import { readBooking, sortNewestFirst, type AdminBooking } from '../bookings/bookings';
import { db } from '../firebase/config';
import { countByUser } from './passengerTable';
import type { Passenger } from './search';

// Read-only passenger views. users/{uid} with role 'passenger' (this includes passengers
// whose driver application was approved: their role stays 'passenger').

export type { Passenger } from './search';
export { matchesSearch } from './search';

export type DriverApplicationStatus = 'pending' | 'approved' | 'rejected';

function readPassenger(uid: string, data: DocumentData): Passenger {
  return {
    uid,
    fullName: data.fullName ?? '',
    email: data.email ?? '',
    mobileNumber: data.mobileNumber ?? '',
    createdAt: (data.createdAt as Timestamp | undefined)?.toDate?.() ?? null,
  };
}

/** All passengers, A–Z by name. Search is done in the browser (Firestore has no text search). */
export async function loadPassengers(): Promise<Passenger[]> {
  const snapshot = await getDocs(query(collection(db, 'users'), where('role', '==', 'passenger')));
  return snapshot.docs
    .map((d) => readPassenger(d.id, d.data()))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));
}

export type PassengerDetail = {
  passenger: Passenger;
  role: string;
  bookings: AdminBooking[];
  driverApplicationStatus: DriverApplicationStatus | null;
};

export async function loadPassengerDetail(uid: string): Promise<PassengerDetail | null> {
  const [userSnap, bookingsSnap, applicationSnap] = await Promise.all([
    getDoc(doc(db, 'users', uid)),
    getDocs(query(collection(db, 'bookings'), where('passengerId', '==', uid))),
    getDoc(doc(db, 'driverApplications', uid)),
  ]);
  if (!userSnap.exists()) return null;
  const status = applicationSnap.data()?.status;
  return {
    passenger: readPassenger(uid, userSnap.data()),
    role: userSnap.data().role ?? '',
    bookings: sortNewestFirst(bookingsSnap.docs.map((d) => readBooking(d.id, d.data()))),
    driverApplicationStatus: status === 'pending' || status === 'approved' || status === 'rejected' ? status : null,
  };
}

// ─── Passengers table ───────────────────────────────────────────────────────

export type PassengerListEntry = {
  passenger: Passenger;
  /** users/{uid}.profileImage (Google sign-in photo); null when none. */
  profileImage: string | null;
  /** Complaints from drivers naming this passenger (reportedUserId). */
  complaints: number;
  /** Warnings to them as a passenger that are still active. */
  activeWarnings: number;
};

/**
 * All passengers, A–Z, with complaint and active-warning counts. Three queries: the
 * passengers, complaints filed by drivers, and active passenger warnings (equality filters
 * only, so no composite index). Complaints from before 2026-11-10 have no reportedUserId and
 * are not counted.
 */
export async function loadPassengerList(): Promise<PassengerListEntry[]> {
  const [usersSnap, complaintsSnap, warningsSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('role', '==', 'passenger'))),
    getDocs(query(collection(db, 'complaints'), where('reporterRole', '==', 'driver'))),
    getDocs(query(collection(db, 'warnings'), where('role', '==', 'passenger'), where('status', '==', 'active'))),
  ]);
  const complaints = countByUser(complaintsSnap.docs.map((d) => d.data().reportedUserId as string | undefined));
  const warnings = countByUser(warningsSnap.docs.map((d) => d.data().userId as string | undefined));
  return usersSnap.docs
    .map((d) => {
      const data = d.data();
      return {
        passenger: readPassenger(d.id, data),
        profileImage: typeof data.profileImage === 'string' && data.profileImage ? data.profileImage : null,
        complaints: complaints.get(d.id) ?? 0,
        activeWarnings: warnings.get(d.id) ?? 0,
      };
    })
    .sort((a, b) => a.passenger.fullName.localeCompare(b.passenger.fullName));
}

export type PassengerRowExtras = {
  completedTrips: number;
  /** Bookings the passenger cancelled themselves. */
  cancelledTrips: number;
  /** A verified drivers/{uid} record exists (approved applicant). */
  isDriver: boolean;
};

/**
 * Trip counts and the driver tag for the rows on screen only: one document read and two
 * count queries per passenger (equality filters only, no composite index).
 */
export async function loadPassengerRowExtras(uids: string[]): Promise<Map<string, PassengerRowExtras>> {
  const entries = await Promise.all(
    uids.map(async (uid) => {
      const bookings = collection(db, 'bookings');
      const [driverSnap, completed, cancelled] = await Promise.all([
        getDoc(doc(db, 'drivers', uid)).catch(() => null),
        getCountFromServer(query(bookings, where('passengerId', '==', uid), where('status', '==', 'completed'))),
        getCountFromServer(
          query(
            bookings,
            where('passengerId', '==', uid),
            where('status', '==', 'cancelled'),
            where('cancelledBy', '==', 'passenger'),
          ),
        ),
      ]);
      return [
        uid,
        {
          completedTrips: completed.data().count,
          cancelledTrips: cancelled.data().count,
          isDriver: driverSnap?.data()?.isVerified === true,
        },
      ] as const;
    }),
  );
  return new Map(entries);
}
