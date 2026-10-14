import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

import { BOOKING_STATUS_LABELS, type BookingStatus } from '../bookings/bookings';
import { db } from '../firebase/config';
import { readRequest, sortRequestsNewestFirst, type AdminOutOfAreaRequest } from './requests';

// Read-only Out-of-Area Trips view. A confirmed request has its booking at
// bookings/{requestId} (created in the passenger's confirm commit), which carries the trip
// status after that.

export type OutOfAreaTrip = {
  request: AdminOutOfAreaRequest;
  passengerName: string;
  driverName: string | null;
  /** Status of bookings/{requestId}; null when no booking exists (not confirmed). */
  bookingStatus: BookingStatus | null;
};

async function loadNames(uids: string[]): Promise<Map<string, string>> {
  const snapshots = await Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid))));
  const names = new Map<string, string>();
  for (const snap of snapshots) {
    const fullName = snap.data()?.fullName;
    if (typeof fullName === 'string' && fullName) names.set(snap.id, fullName);
  }
  return names;
}

/** All out-of-area requests, newest first, with names and the linked booking status. */
export async function loadOutOfAreaTrips(): Promise<OutOfAreaTrip[]> {
  const [requestsSnap, bookingsSnap] = await Promise.all([
    getDocs(collection(db, 'outOfAreaRequests')),
    getDocs(query(collection(db, 'bookings'), where('bookingType', '==', 'out_of_area'))),
  ]);
  const requests = sortRequestsNewestFirst(requestsSnap.docs.map((d) => readRequest(d.id, d.data())));

  const bookingStatuses = new Map<string, BookingStatus>();
  for (const booking of bookingsSnap.docs) {
    const status = booking.data().status;
    if (typeof status === 'string' && status in BOOKING_STATUS_LABELS) {
      bookingStatuses.set(booking.id, status as BookingStatus);
    }
  }

  const uids = new Set<string>();
  for (const request of requests) {
    if (request.passengerId) uids.add(request.passengerId);
    if (request.driverId) uids.add(request.driverId);
  }
  const names = await loadNames([...uids]);

  return requests.map((request) => ({
    request,
    passengerName: names.get(request.passengerId) ?? '',
    driverName: request.driverId ? (names.get(request.driverId) ?? '') : null,
    bookingStatus: bookingStatuses.get(request.requestId) ?? null,
  }));
}
