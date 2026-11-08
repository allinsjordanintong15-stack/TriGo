// When a passenger may cancel ("lock with safety exit"), for the Your Ride screen and the
// cancel pre-check. firestore.rules decides with server time; this uses the phone's clock,
// so near the limit the rules may still refuse (the app then explains and lets them retry).
// Relative imports only, so plain Node tests can load this file
// (tests/booking/passengerCancel.test.ts).

import {
  PASSENGER_CANCELLABLE_STATUSES,
  PASSENGER_NO_SHOW_CANCEL_MINUTES,
} from '../constants/cancellation.ts';
import type { BookingStatus } from '../types';

const MINUTE_MS = 60 * 1000;

export interface CancelFields {
  status: BookingStatus;
  acceptedAt: Date | null;
}

/**
 * cancel: pending, cancel any time.
 * wait_for_driver: accepted; cancelling opens at `opensAt` if the driver has not arrived.
 * driver_late: accepted, the limit has passed and the driver has not arrived: may cancel.
 * locked: arrived, in progress, finished, or accepted without a recorded acceptedAt.
 */
export type PassengerCancelState =
  | { kind: 'cancel' }
  | { kind: 'wait_for_driver'; opensAt: number }
  | { kind: 'driver_late' }
  | { kind: 'locked' };

/** When an accepted booking may be cancelled for a late driver; null otherwise. */
export function noShowCancelOpensAt(booking: CancelFields): number | null {
  if (booking.status !== 'accepted' || booking.acceptedAt === null) return null;
  return booking.acceptedAt.getTime() + PASSENGER_NO_SHOW_CANCEL_MINUTES * MINUTE_MS;
}

export function passengerCancelState(booking: CancelFields, nowMillis: number): PassengerCancelState {
  if (PASSENGER_CANCELLABLE_STATUSES.includes(booking.status)) return { kind: 'cancel' };
  const opensAt = noShowCancelOpensAt(booking);
  if (opensAt === null) return { kind: 'locked' };
  return nowMillis >= opensAt ? { kind: 'driver_late' } : { kind: 'wait_for_driver', opensAt };
}

/** True when the passenger may cancel now (pending, or accepted and the driver is late). */
export function canPassengerCancelNow(booking: CancelFields, nowMillis: number): boolean {
  const { kind } = passengerCancelState(booking, nowMillis);
  return kind === 'cancel' || kind === 'driver_late';
}
