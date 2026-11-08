// How many passenger requests are waiting for this driver (Home button, Requests tab badge),
// with the same filters as the Requests tab list. Relative imports of alias-free files
// only, so plain Node tests can load this file (tests/booking/openRequests.test.ts).

import { isBookingExpired } from './bookingExpiry.ts';
import type { Booking } from '../types';

type OpenBooking = Pick<Booking, 'bookingId' | 'bookingType' | 'status' | 'expiresAt'>;

interface OpenOutOfArea {
  request: { requestId: string; expiresAt: Date | null };
}

export interface OpenRequestInputs {
  /** Open standard bookings for this vehicle type; null while not loaded. */
  bookings: readonly OpenBooking[] | null;
  /** Declined on this device (driverBookingService.getDeclinedBookingIds). */
  declinedBookingIds: readonly string[];
  /** Open out-of-area requests within the search radius; null while not loaded. */
  outOfArea: readonly OpenOutOfArea[] | null;
  /** Out-of-area requests whose fare the passenger declined (hidden for this driver). */
  hiddenRequestIds: readonly string[];
}

/** Standard bookings the Requests tab lists: not declined here and not expired. */
export function visibleStandardCount(inputs: OpenRequestInputs, nowMillis: number): number {
  return (inputs.bookings ?? []).filter(
    (booking) =>
      !inputs.declinedBookingIds.includes(booking.bookingId) &&
      !isBookingExpired(booking, nowMillis),
  ).length;
}

/** Out-of-area requests the Requests tab lists: unexpired and not hidden. */
export function visibleOutOfAreaCount(inputs: OpenRequestInputs, nowMillis: number): number {
  return (inputs.outOfArea ?? []).filter(
    ({ request }) =>
      request.expiresAt !== null &&
      request.expiresAt.getTime() > nowMillis &&
      !inputs.hiddenRequestIds.includes(request.requestId),
  ).length;
}

/** Both kinds together. */
export function countOpenRequests(inputs: OpenRequestInputs, nowMillis: number): number {
  return visibleStandardCount(inputs, nowMillis) + visibleOutOfAreaCount(inputs, nowMillis);
}

/** Badge text: "1" … "9", then "9+". Empty for 0. */
export function formatRequestCount(count: number): string {
  if (count <= 0) return '';
  return count > 9 ? '9+' : String(count);
}

/** "1 passenger is looking for a driver" / "3 passengers are looking for a driver". */
export function waitingPassengersText(count: number): string {
  return count === 1
    ? '1 passenger is looking for a driver'
    : `${count} passengers are looking for a driver`;
}

/** Screen-reader label for the Home button: "View requests, 2 waiting". */
export function viewRequestsLabel(count: number): string {
  return count > 0 ? `View requests, ${count} waiting` : 'View requests';
}
