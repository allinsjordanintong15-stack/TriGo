import { collection, doc, getDoc, getDocs, query, where, type DocumentData, type Timestamp } from 'firebase/firestore';

import { readBooking, sortNewestFirst, type AdminBooking } from '../bookings/bookings';
import { db } from '../firebase/config';
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
