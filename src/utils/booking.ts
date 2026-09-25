import { PASSENGER_CANCELLABLE_STATUSES } from '@/constants/cancellation';
import { Booking, OutOfAreaRequest, TripQuote } from '@/types';

export function canPassengerCancelBooking(booking: Booking): boolean {
  if (booking.status === 'completed') {
    return false;
  }

  return PASSENGER_CANCELLABLE_STATUSES.includes(booking.status);
}

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
  if (outOfAreaRequest?.agreedFare != null) {
    return {
      quote: tripQuote,
      estimatedFare: outOfAreaRequest.standardEstimatedFare,
      agreedFare: outOfAreaRequest.agreedFare,
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
