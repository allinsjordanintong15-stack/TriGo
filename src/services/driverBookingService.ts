import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLLECTIONS, firestore } from '@/firebase';
import { docToBooking } from '@/services/bookingService';
import { Booking, BookingStatus, VehicleType } from '@/types';
import {
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
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
  'arriving',
  'in_progress',
];

const REQUEST_UNAVAILABLE_MESSAGE =
  'This ride request is no longer available. Another driver may have accepted it.';

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
 * Accept an open standard booking. Runs as a transaction so two drivers cannot claim
 * the same booking; the driver is also marked unavailable for other requests.
 */
export async function acceptBooking(bookingId: string, driverId: string): Promise<void> {
  const bookingRef = doc(firestore, COLLECTIONS.bookings, bookingId);
  const driverRef = doc(firestore, COLLECTIONS.drivers, driverId);

  try {
    await runTransaction(firestore, async (transaction) => {
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

      transaction.update(bookingRef, {
        driverId,
        status: 'accepted',
        acceptedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(driverRef, {
        isAvailable: false,
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
