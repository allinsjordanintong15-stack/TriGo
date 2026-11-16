import { collection, doc, getDoc, getDocs, limit, orderBy, query, Timestamp, where } from 'firebase/firestore';

import { readComplaint, type AdminComplaint } from '../complaints/complaints';
import { db } from '../firebase/config';
import type { DateRange } from '../lib/dateRange';
import { readBooking, type AdminBooking } from './bookings';

// Trips → Bookings: every booking (standard and out-of-area) created in a date range, and one
// booking's detail page. Read only (admins never write bookings).

/** The list query returns at most this many bookings (newest first). */
export const BOOKING_QUERY_LIMIT = 500;

export type BookingListEntry = {
  booking: AdminBooking;
  passengerName: string;
  /** null when the booking has no driver. */
  driverName: string | null;
};

export type BookingList = {
  entries: BookingListEntry[];
  /** True when the query hit BOOKING_QUERY_LIMIT, so older bookings in the range are not shown. */
  truncated: boolean;
};

/** users/{uid}.fullName for each distinct uid (one read per person, not per row). */
async function loadNames(uids: string[]): Promise<Map<string, string>> {
  const snapshots = await Promise.all(
    uids.map((uid) => getDoc(doc(db, 'users', uid)).catch(() => null)),
  );
  const names = new Map<string, string>();
  for (const snap of snapshots) {
    const fullName = snap?.data()?.fullName;
    if (snap && typeof fullName === 'string' && fullName) names.set(snap.id, fullName);
  }
  return names;
}

/**
 * Bookings created in the range, newest first, at most BOOKING_QUERY_LIMIT, with passenger
 * and driver names. Type and status are filtered in the browser, so the status counts cover
 * the whole range. Range and order on createdAt use Firestore's automatic single-field index.
 */
export async function loadBookings(range: DateRange): Promise<BookingList> {
  const snapshot = await getDocs(
    query(
      collection(db, 'bookings'),
      where('createdAt', '>=', Timestamp.fromDate(range.start)),
      where('createdAt', '<', Timestamp.fromDate(range.end)),
      orderBy('createdAt', 'desc'),
      limit(BOOKING_QUERY_LIMIT),
    ),
  );
  const bookings = snapshot.docs.map((d) => readBooking(d.id, d.data()));
  const uids = new Set<string>();
  for (const booking of bookings) {
    if (booking.passengerId) uids.add(booking.passengerId);
    if (booking.driverId) uids.add(booking.driverId);
  }
  const names = await loadNames([...uids]);
  return {
    entries: bookings.map((booking) => ({
      booking,
      passengerName: names.get(booking.passengerId) ?? '',
      driverName: booking.driverId ? (names.get(booking.driverId) ?? '') : null,
    })),
    truncated: snapshot.size >= BOOKING_QUERY_LIMIT,
  };
}

export type BookingPerson = { uid: string; name: string; mobileNumber: string };

/** commissions/{bookingId}, written by the driver's app when the trip completed. */
export type BookingCommission = { amountCentavos: number; percentage: number | null; finalFare: number | null };

/** ratings/{bookingId}, from the passenger after the trip. */
export type BookingRating = { stars: number; tags: string[]; comment: string; createdAt: Date | null };

export type BookingDetail = {
  booking: AdminBooking;
  passenger: BookingPerson | null;
  driver: (BookingPerson & { vehiclePlate: string }) | null;
  commission: BookingCommission | null;
  rating: BookingRating | null;
  /** Reports on this booking by its passenger and by its driver (complaint ID = bookingId_reporterUid). */
  complaints: AdminComplaint[];
};

async function loadPerson(uid: string): Promise<BookingPerson> {
  const data = (await getDoc(doc(db, 'users', uid)).catch(() => null))?.data();
  return {
    uid,
    name: typeof data?.fullName === 'string' ? data.fullName : '',
    mobileNumber: typeof data?.mobileNumber === 'string' ? data.mobileNumber : '',
  };
}

/**
 * One booking with its people, commission, rating and complaints. Every read is by document
 * ID (no queries, no indexes): about 8 reads.
 */
export async function loadBookingDetail(bookingId: string): Promise<BookingDetail | null> {
  const bookingSnap = await getDoc(doc(db, 'bookings', bookingId));
  if (!bookingSnap.exists()) return null;
  const booking = readBooking(bookingSnap.id, bookingSnap.data());
  const complaintIds = [booking.passengerId, booking.driverId]
    .filter((uid): uid is string => Boolean(uid))
    .map((uid) => `${bookingId}_${uid}`);

  const [passenger, driver, driverRecord, commissionSnap, ratingSnap, complaintSnaps] = await Promise.all([
    booking.passengerId ? loadPerson(booking.passengerId) : Promise.resolve(null),
    booking.driverId ? loadPerson(booking.driverId) : Promise.resolve(null),
    booking.driverId ? getDoc(doc(db, 'drivers', booking.driverId)).catch(() => null) : Promise.resolve(null),
    getDoc(doc(db, 'commissions', bookingId)),
    getDoc(doc(db, 'ratings', bookingId)),
    Promise.all(complaintIds.map((id) => getDoc(doc(db, 'complaints', id)))),
  ]);

  const commissionData = commissionSnap.data();
  const ratingData = ratingSnap.data();
  return {
    booking,
    passenger,
    driver: driver
      ? { ...driver, vehiclePlate: String(driverRecord?.data()?.vehiclePlate ?? '') }
      : null,
    commission:
      commissionData && typeof commissionData.amountCentavos === 'number'
        ? {
            amountCentavos: commissionData.amountCentavos,
            percentage: typeof commissionData.percentage === 'number' ? commissionData.percentage : null,
            finalFare: typeof commissionData.finalFare === 'number' ? commissionData.finalFare : null,
          }
        : null,
    rating:
      ratingData && typeof ratingData.stars === 'number'
        ? {
            stars: ratingData.stars,
            tags: Array.isArray(ratingData.tags) ? ratingData.tags.filter((t): t is string => typeof t === 'string') : [],
            comment: typeof ratingData.comment === 'string' ? ratingData.comment : '',
            createdAt: (ratingData.createdAt as Timestamp | undefined)?.toDate?.() ?? null,
          }
        : null,
    complaints: complaintSnaps.filter((snap) => snap.exists()).map((snap) => readComplaint(snap.id, snap.data())),
  };
}
