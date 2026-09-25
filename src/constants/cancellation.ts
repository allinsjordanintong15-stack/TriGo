import { BookingStatus } from '@/types';

/** Statuses where passenger cancellation is allowed. Adjust here to change rules. */
export const PASSENGER_CANCELLABLE_STATUSES: BookingStatus[] = [
  'pending',
  'accepted',
  'arriving',
  'out_of_area_searching',
  'driver_interested',
  'fare_negotiation',
  'awaiting_passenger_confirmation',
];

export const NON_CANCELLABLE_STATUSES: BookingStatus[] = [
  'in_progress',
  'completed',
  'cancelled',
  'confirmed',
];
