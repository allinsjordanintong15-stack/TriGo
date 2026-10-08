import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLLECTIONS, firestore } from '@/firebase';
import { docToBooking } from '@/services/bookingService';
import { docToDriverRecord } from '@/services/driverService';
import { Booking, BookingStatus, PaymentMethod, VehicleType } from '@/types';
import { canDriverCancelBooking, getDisplayFare } from '@/utils/booking';
import {
  collection,
  doc,
  DocumentData,
  getCountFromServer,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  runTransaction,
  serverTimestamp,
  startAfter,
  Timestamp,
  Transaction,
  where,
} from 'firebase/firestore';

export class DriverBookingServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DriverBookingServiceError';
  }
}

/** Booking statuses during which the assigned driver is busy with the trip. */
export const DRIVER_ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  'accepted',
  'arrived',
  'in_progress',
];

/** Finished trips shown in the driver's trip history. */
export const DRIVER_FINISHED_BOOKING_STATUSES: BookingStatus[] = ['completed', 'cancelled'];

const REQUEST_UNAVAILABLE_MESSAGE =
  'This ride request is no longer available. Another driver may have accepted it.';

const TRIP_UPDATE_FAILED_MESSAGE =
  'Unable to update this trip. Please check your internet connection and try again.';

/**
 * Open standard bookings a driver with this vehicle type may accept: pending and
 * not yet assigned. Out-of-area bookings are excluded (their driver is agreed upfront).
 */
export function subscribeToOpenBookings(
  vehicleType: VehicleType,
  onUpdate: (bookings: Booking[]) => void,
  onError: (error: Error) => void,
): () => void {
  const openQuery = query(
    collection(firestore, COLLECTIONS.bookings),
    where('status', '==', 'pending'),
    where('driverId', '==', null),
    where('bookingType', '==', 'standard'),
    where('vehicleType', '==', vehicleType),
  );

  return onSnapshot(
    openQuery,
    (snapshot) => onUpdate(snapshot.docs.map((d) => docToBooking(d.id, d.data()))),
    (error) => onError(error),
  );
}

/** Bookings assigned to this driver that are still in progress. */
export function subscribeToDriverActiveBookings(
  driverId: string,
  onUpdate: (bookings: Booking[]) => void,
  onError: (error: Error) => void,
): () => void {
  const activeQuery = query(
    collection(firestore, COLLECTIONS.bookings),
    where('driverId', '==', driverId),
    where('status', 'in', DRIVER_ACTIVE_BOOKING_STATUSES),
  );

  return onSnapshot(
    activeQuery,
    (snapshot) =>
      onUpdate(
        snapshot.docs
          .map((d) => docToBooking(d.id, d.data()))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
      ),
    (error) => onError(error),
  );
}

/**
 * Accept an open standard booking (T1). The transaction reads both the booking and the
 * driver's record, so two drivers cannot claim the same booking and one driver cannot
 * claim two. The driver is marked unavailable and linked to the booking through
 * `currentBookingId` in the same commit (Firestore rules require both).
 */
export async function acceptBooking(bookingId: string, driverId: string): Promise<void> {
  const bookingRef = doc(firestore, COLLECTIONS.bookings, bookingId);
  const driverRef = doc(firestore, COLLECTIONS.drivers, driverId);

  try {
    await runTransaction(firestore, async (transaction) => {
      const driverSnapshot = await transaction.get(driverRef);
      const driverData = driverSnapshot.data();
      if (!driverSnapshot.exists() || !driverData) {
        throw new DriverBookingServiceError('Your driver record could not be found.');
      }

      const driver = docToDriverRecord(driverSnapshot.id, driverData);
      if (!driver.isVerified) {
        throw new DriverBookingServiceError(
          'Your account must be verified by a TriGo administrator before you can accept rides.',
        );
      }
      if (driver.currentBookingId) {
        throw new DriverBookingServiceError('You already have an active trip.');
      }
      if (driver.currentRequestId) {
        throw new DriverBookingServiceError(
          'You have a pending out-of-area fare proposal. Withdraw it first.',
        );
      }
      if (!driver.isOnline || !driver.isAvailable) {
        throw new DriverBookingServiceError('Go online and be available to accept rides.');
      }

      const snapshot = await transaction.get(bookingRef);
      if (!snapshot.exists()) {
        throw new DriverBookingServiceError(REQUEST_UNAVAILABLE_MESSAGE);
      }

      const booking = docToBooking(snapshot.id, snapshot.data());
      if (
        booking.status !== 'pending' ||
        booking.driverId !== null ||
        booking.bookingType !== 'standard'
      ) {
        throw new DriverBookingServiceError(REQUEST_UNAVAILABLE_MESSAGE);
      }
      if (booking.vehicleType !== driver.vehicleType) {
        throw new DriverBookingServiceError('This request is for a different vehicle type.');
      }

      transaction.update(bookingRef, {
        driverId,
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(driverRef, {
        isAvailable: false,
        currentBookingId: bookingId,
        updatedAt: serverTimestamp(),
      });
    });
  } catch (error) {
    if (error instanceof DriverBookingServiceError) {
      throw error;
    }

    const code = (error as { code?: string }).code;
    if (code === 'permission-denied') {
      // The booking is no longer open to this driver (accepted by someone else,
      // cancelled), or the driver went offline / became unavailable meanwhile.
      throw new DriverBookingServiceError(
        'Unable to accept this request. It may have been taken, or you are no longer online and available.',
      );
    }

    throw new DriverBookingServiceError(
      'Unable to accept this request. Please check your internet connection and try again.',
    );
  }
}

// ─── Trip lifecycle (assigned driver only) ──────────────────────────────────

/** Reads the booking in a transaction and checks it is this driver's, in an expected status. */
async function getAssignedBooking(
  transaction: Transaction,
  bookingId: string,
  driverId: string,
  allowedStatuses: BookingStatus[],
): Promise<Booking> {
  const snapshot = await transaction.get(doc(firestore, COLLECTIONS.bookings, bookingId));
  if (!snapshot.exists()) {
    throw new DriverBookingServiceError('This trip could not be found.');
  }

  const booking = docToBooking(snapshot.id, snapshot.data());
  if (booking.driverId !== driverId) {
    throw new DriverBookingServiceError('This trip is not assigned to you.');
  }
  if (booking.status === 'cancelled') {
    throw new DriverBookingServiceError('The passenger cancelled this ride.');
  }
  if (!allowedStatuses.includes(booking.status)) {
    throw new DriverBookingServiceError('This trip has already moved on. Please try again.');
  }

  return booking;
}

/**
 * Driver record fields for ending a trip (T4 / T6): unlink the booking and become
 * available again if still online and verified. A driver whose verification was revoked
 * mid-ride goes offline instead.
 */
async function getTripEndDriverUpdate(transaction: Transaction, driverId: string) {
  const snapshot = await transaction.get(doc(firestore, COLLECTIONS.drivers, driverId));
  const data = snapshot.data();
  const driver = snapshot.exists() && data ? docToDriverRecord(snapshot.id, data) : null;
  const canBeAvailable = driver !== null && driver.isOnline && driver.isVerified;

  return {
    currentBookingId: null,
    isOnline: canBeAvailable,
    isAvailable: canBeAvailable,
    updatedAt: serverTimestamp(),
  };
}

async function runTripUpdate(update: (transaction: Transaction) => Promise<void>): Promise<void> {
  try {
    await runTransaction(firestore, update);
  } catch (error) {
    if (error instanceof DriverBookingServiceError) {
      throw error;
    }
    throw new DriverBookingServiceError(TRIP_UPDATE_FAILED_MESSAGE);
  }
}

/** T2: accepted → arrived. */
export async function markArrived(bookingId: string, driverId: string): Promise<void> {
  await runTripUpdate(async (transaction) => {
    await getAssignedBooking(transaction, bookingId, driverId, ['accepted']);
    transaction.update(doc(firestore, COLLECTIONS.bookings, bookingId), {
      status: 'arrived',
      arrivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/** T3: arrived → in_progress. */
export async function startTrip(bookingId: string, driverId: string): Promise<void> {
  await runTripUpdate(async (transaction) => {
    await getAssignedBooking(transaction, bookingId, driverId, ['arrived']);
    transaction.update(doc(firestore, COLLECTIONS.bookings, bookingId), {
      status: 'in_progress',
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * T4: in_progress → completed. `finalFare` is the agreed fare (out-of-area) or the
 * estimated fare; it cannot be edited, and Firestore rules enforce the same value.
 */
export async function completeTrip(
  bookingId: string,
  driverId: string,
  // TEMP until Task 4: passenger selects method at booking
  paymentMethod: PaymentMethod,
): Promise<void> {
  await runTripUpdate(async (transaction) => {
    const booking = await getAssignedBooking(transaction, bookingId, driverId, ['in_progress']);
    const driverUpdate = await getTripEndDriverUpdate(transaction, driverId);

    transaction.update(doc(firestore, COLLECTIONS.bookings, bookingId), {
      status: 'completed',
      completedAt: serverTimestamp(),
      finalFare: getDisplayFare(booking),
      paymentMethod,
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(firestore, COLLECTIONS.drivers, driverId), driverUpdate);
  });
}

/** T6: the assigned driver cancels before the ride starts (accepted or arrived). */
export async function cancelTripAsDriver(
  bookingId: string,
  driverId: string,
  reason: string,
): Promise<void> {
  const trimmedReason = reason.trim().slice(0, 200);
  if (!trimmedReason) {
    throw new DriverBookingServiceError('Please choose a reason for cancelling.');
  }

  await runTripUpdate(async (transaction) => {
    const booking = await getAssignedBooking(transaction, bookingId, driverId, [
      'accepted',
      'arrived',
    ]);
    if (!canDriverCancelBooking(booking)) {
      throw new DriverBookingServiceError('This trip can no longer be cancelled.');
    }
    const driverUpdate = await getTripEndDriverUpdate(transaction, driverId);

    transaction.update(doc(firestore, COLLECTIONS.bookings, bookingId), {
      status: 'cancelled',
      cancelledBy: 'driver',
      cancellationReason: trimmedReason,
      cancelledAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.update(doc(firestore, COLLECTIONS.drivers, driverId), driverUpdate);
  });
}

// ─── Trip history ───────────────────────────────────────────────────────────
// Needs the composite index bookings(driverId ASC, status ASC, updatedAt DESC) from
// firestore.indexes.json. Finished bookings are never updated again, so updatedAt is
// when the trip ended.

export const TRIP_HISTORY_PAGE_SIZE = 20;

export type TripHistoryCursor = QueryDocumentSnapshot<DocumentData>;

export interface TripHistoryPage {
  trips: Booking[];
  cursor: TripHistoryCursor | null;
  hasMore: boolean;
}

export async function fetchDriverTripHistory(
  driverId: string,
  after: TripHistoryCursor | null = null,
): Promise<TripHistoryPage> {
  const historyQuery = after
    ? query(
        collection(firestore, COLLECTIONS.bookings),
        where('driverId', '==', driverId),
        where('status', 'in', DRIVER_FINISHED_BOOKING_STATUSES),
        orderBy('updatedAt', 'desc'),
        startAfter(after),
        limit(TRIP_HISTORY_PAGE_SIZE),
      )
    : query(
        collection(firestore, COLLECTIONS.bookings),
        where('driverId', '==', driverId),
        where('status', 'in', DRIVER_FINISHED_BOOKING_STATUSES),
        orderBy('updatedAt', 'desc'),
        limit(TRIP_HISTORY_PAGE_SIZE),
      );

  try {
    const snapshot = await getDocs(historyQuery);
    return {
      trips: snapshot.docs.map((d) => docToBooking(d.id, d.data())),
      cursor: snapshot.docs[snapshot.docs.length - 1] ?? after,
      hasMore: snapshot.docs.length === TRIP_HISTORY_PAGE_SIZE,
    };
  } catch (error) {
    const code = (error as { code?: string }).code;
    // A missing composite index fails with failed-precondition; the logged error
    // includes the Console link that creates it.
    console.warn('[TriGo] fetchDriverTripHistory failed', error);
    throw new DriverBookingServiceError(
      code === 'failed-precondition'
        ? 'Trip history is not available yet: the database index is still being set up.'
        : 'Unable to load your trips. Please check your internet connection and try again.',
    );
  }
}

/**
 * Number of trips this driver completed since `since` (dashboard summary). Uses the same
 * trip-history index; updatedAt of a completed booking is its completion time.
 */
export async function countDriverCompletedTripsSince(
  driverId: string,
  since: Date,
): Promise<number> {
  const completedQuery = query(
    collection(firestore, COLLECTIONS.bookings),
    where('driverId', '==', driverId),
    where('status', '==', 'completed'),
    where('updatedAt', '>=', Timestamp.fromDate(since)),
    orderBy('updatedAt', 'desc'),
  );

  try {
    const snapshot = await getCountFromServer(completedQuery);
    return snapshot.data().count;
  } catch (error) {
    console.warn('[TriGo] countDriverCompletedTripsSince failed', error);
    throw new DriverBookingServiceError("Unable to load today's trips.");
  }
}

// ─── Declined requests ──────────────────────────────────────────────────────
// Declining an open booking needs no Firestore write: the request stays open for
// other drivers and is only hidden for this driver, on this device.

const declinedKey = (driverId: string) => `trigo.driver.${driverId}.declinedBookings`;
const MAX_DECLINED_TRACKED = 200;

export async function getDeclinedBookingIds(driverId: string): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(declinedKey(driverId));
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export async function declineBooking(driverId: string, bookingId: string): Promise<string[]> {
  const current = await getDeclinedBookingIds(driverId);
  const updated = [bookingId, ...current.filter((id) => id !== bookingId)].slice(
    0,
    MAX_DECLINED_TRACKED,
  );

  try {
    await AsyncStorage.setItem(declinedKey(driverId), JSON.stringify(updated));
  } catch {
    // Still hidden for this session via the returned list.
  }

  return updated;
}
