import {
  collection,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  Timestamp,
  where,
} from 'firebase/firestore';

import { BOOKING_STATUS_LABELS, readBooking, type AdminBooking, type BookingStatus } from '../bookings/bookings';
import { db } from '../firebase/config';
import type { DateRange } from '../lib/dateRange';
import { readRequest, REQUEST_QUERY_LIMIT, type AdminOutOfAreaRequest } from './requests';

// Read-only Out-of-Area Trips view. A confirmed request has its booking at
// bookings/{requestId} (created in the passenger's confirm commit), which carries the trip
// status after that. A request cancelled after confirming can also have one (cancelled).

export type OutOfAreaTrip = {
  request: AdminOutOfAreaRequest;
  passengerName: string;
  driverName: string | null;
  /** Status of bookings/{requestId}; null when no booking exists (not confirmed). */
  bookingStatus: BookingStatus | null;
};

export type OutOfAreaTripList = {
  trips: OutOfAreaTrip[];
  /** True when the query hit REQUEST_QUERY_LIMIT, so older requests in the range are not shown. */
  truncated: boolean;
};

// Firestore allows at most 30 values in an 'in' filter.
const IN_FILTER_MAX = 30;

async function loadNames(uids: string[]): Promise<Map<string, string>> {
  const snapshots = await Promise.all(uids.map((uid) => getDoc(doc(db, 'users', uid))));
  const names = new Map<string, string>();
  for (const snap of snapshots) {
    const fullName = snap.data()?.fullName;
    if (typeof fullName === 'string' && fullName) names.set(snap.id, fullName);
  }
  return names;
}

/** bookings/{id} statuses for the given ids, read in batches of 30 by document id. */
async function loadBookingStatuses(ids: string[]): Promise<Map<string, BookingStatus>> {
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_FILTER_MAX) chunks.push(ids.slice(i, i + IN_FILTER_MAX));
  const snapshots = await Promise.all(
    chunks.map((chunk) => getDocs(query(collection(db, 'bookings'), where(documentId(), 'in', chunk)))),
  );
  const statuses = new Map<string, BookingStatus>();
  for (const snapshot of snapshots) {
    for (const booking of snapshot.docs) {
      const status = booking.data().status;
      if (typeof status === 'string' && status in BOOKING_STATUS_LABELS) {
        statuses.set(booking.id, status as BookingStatus);
      }
    }
  }
  return statuses;
}

/**
 * Requests created in the range, newest first, at most REQUEST_QUERY_LIMIT, with names and
 * the linked booking status. Range and order on the same field use Firestore's automatic
 * single-field index on createdAt (no composite index).
 */
export async function loadOutOfAreaTrips(range: DateRange): Promise<OutOfAreaTripList> {
  const requestsSnap = await getDocs(
    query(
      collection(db, 'outOfAreaRequests'),
      where('createdAt', '>=', Timestamp.fromDate(range.start)),
      where('createdAt', '<', Timestamp.fromDate(range.end)),
      orderBy('createdAt', 'desc'),
      limit(REQUEST_QUERY_LIMIT),
    ),
  );
  const requests = requestsSnap.docs.map((d) => readRequest(d.id, d.data()));

  // Only a confirmed request, or one cancelled after confirming, can have a booking.
  const maybeBooked = requests
    .filter((request) => request.status === 'accepted' || request.status === 'cancelled')
    .map((request) => request.requestId);

  const uids = new Set<string>();
  for (const request of requests) {
    if (request.passengerId) uids.add(request.passengerId);
    if (request.driverId) uids.add(request.driverId);
  }
  const [bookingStatuses, names] = await Promise.all([loadBookingStatuses(maybeBooked), loadNames([...uids])]);

  return {
    trips: requests.map((request) => ({
      request,
      passengerName: names.get(request.passengerId) ?? '',
      driverName: request.driverId ? (names.get(request.driverId) ?? '') : null,
      bookingStatus: bookingStatuses.get(request.requestId) ?? null,
    })),
    truncated: requestsSnap.size >= REQUEST_QUERY_LIMIT,
  };
}

export type OutOfAreaTripDetail = {
  request: AdminOutOfAreaRequest;
  booking: AdminBooking | null;
  passengerName: string;
  passengerMobile: string;
  /** The booking's driver once claimed, otherwise the driver holding the request. */
  driverId: string | null;
  driverName: string;
  driverMobile: string;
  vehiclePlate: string;
};

export async function loadOutOfAreaTripDetail(requestId: string): Promise<OutOfAreaTripDetail | null> {
  const [requestSnap, bookingSnap] = await Promise.all([
    getDoc(doc(db, 'outOfAreaRequests', requestId)),
    getDoc(doc(db, 'bookings', requestId)),
  ]);
  if (!requestSnap.exists()) return null;
  const request = readRequest(requestSnap.id, requestSnap.data());
  const booking = bookingSnap.exists() ? readBooking(bookingSnap.id, bookingSnap.data()) : null;
  const driverId = booking?.driverId ?? request.driverId;

  const [passengerSnap, driverUserSnap, driverSnap] = await Promise.all([
    request.passengerId ? getDoc(doc(db, 'users', request.passengerId)) : null,
    driverId ? getDoc(doc(db, 'users', driverId)) : null,
    driverId ? getDoc(doc(db, 'drivers', driverId)) : null,
  ]);
  const passenger = passengerSnap?.data();
  const driverUser = driverUserSnap?.data();
  const driver = driverSnap?.data();

  return {
    request,
    booking,
    passengerName: passenger?.fullName ?? '',
    passengerMobile: passenger?.mobileNumber ?? '',
    driverId,
    driverName: driverUser?.fullName ?? driver?.fullName ?? '',
    driverMobile: driverUser?.mobileNumber ?? '',
    vehiclePlate: driver?.vehiclePlate ?? '',
  };
}
