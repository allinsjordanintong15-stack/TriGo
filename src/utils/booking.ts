import {
  DRIVER_CANCELLABLE_STATUSES,
  PASSENGER_CANCELLABLE_STATUSES,
} from '@/constants/cancellation';
import { Booking, OutOfAreaRequest, TripQuote } from '@/types';

export function canPassengerCancelBooking(booking: Booking): boolean {
  return PASSENGER_CANCELLABLE_STATUSES.includes(booking.status);
}

export function canDriverCancelBooking(booking: Booking): boolean {
  return DRIVER_CANCELLABLE_STATUSES.includes(booking.status);
}

/** The fare shown before completion and recorded as `finalFare` on completion. */
export function getDisplayFare(booking: Booking): number {
  if (booking.agreedFare !== null) {
    return booking.agreedFare;
  }

  return booking.estimatedFare;
}

export function isOutOfAreaBooking(booking: Booking): boolean {
  return booking.bookingType === 'out_of_area';
}

export function buildConfirmationQuote(
  tripQuote: TripQuote,
  outOfAreaRequest?: OutOfAreaRequest | null,
): {
  quote: TripQuote;
  estimatedFare: number;
  agreedFare: number | null;
  isOutOfArea: boolean;
} {
  // Before Confirm Booking the request holds the driver's offer; that fare becomes the
  // agreed fare when the passenger confirms.
  const agreedFare =
    outOfAreaRequest?.agreedFare ?? outOfAreaRequest?.fareAgreement?.driverProposedFare ?? null;
  if (outOfAreaRequest && agreedFare !== null) {
    return {
      quote: tripQuote,
      estimatedFare: outOfAreaRequest.standardEstimatedFare,
      agreedFare,
      isOutOfArea: true,
    };
  }

  return {
    quote: tripQuote,
    estimatedFare: tripQuote.standardEstimatedFare,
    agreedFare: null,
    isOutOfArea: tripQuote.isOutOfArea,
  };
}
