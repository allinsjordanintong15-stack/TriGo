import type { BookingStatus } from '@/types';

/**
 * Statuses where the passenger may always cancel. An accepted booking can also be
 * cancelled once the driver is late (see PASSENGER_NO_SHOW_CANCEL_MINUTES); arrived and
 * in-progress bookings cannot. Mirrored in firestore.rules (bookings, T5).
 */
export const PASSENGER_CANCELLABLE_STATUSES: BookingStatus[] = ['pending'];

/**
 * "Lock with safety exit": once a driver accepts, the passenger can cancel only if the
 * driver has not marked arrived this many minutes after accepting (server time).
 * Kept equal to passengerNoShowCancelMinutes() in firestore.rules by
 * tests/booking/passengerCancelSync.test.ts.
 */
export const PASSENGER_NO_SHOW_CANCEL_MINUTES = 15;

/**
 * cancellationReason recorded on that late-driver cancel; the rules require exactly this
 * text (driverNoShowReason() in firestore.rules, same sync test).
 */
export const DRIVER_NO_SHOW_REASON = 'Driver did not arrive';

/** Statuses where the assigned driver may cancel. Mirrored in firestore.rules. */
export const DRIVER_CANCELLABLE_STATUSES: BookingStatus[] = ['accepted', 'arrived'];

export const NON_CANCELLABLE_STATUSES: BookingStatus[] = ['in_progress', 'completed', 'cancelled'];

/** Preset reasons a driver picks from when cancelling an accepted trip. */
export const DRIVER_CANCELLATION_REASONS = [
  'Passenger not at pickup',
  'Vehicle problem',
  'Emergency',
  'Other',
] as const;
