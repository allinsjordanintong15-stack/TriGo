import { BookingStatus } from '@/types';

/** Statuses where the passenger may cancel (before the ride starts). Mirrored in firestore.rules. */
export const PASSENGER_CANCELLABLE_STATUSES: BookingStatus[] = ['pending', 'accepted', 'arrived'];

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
