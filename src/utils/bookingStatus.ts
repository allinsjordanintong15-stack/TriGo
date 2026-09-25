import { BookingStatus } from '@/types';

interface StatusDisplay {
  title: string;
  message: string;
}

const STATUS_MESSAGES: Record<BookingStatus, StatusDisplay> = {
  pending: {
    title: 'Searching for Driver',
    message: 'Looking for an available driver…',
  },
  accepted: {
    title: 'Driver Found',
    message: 'A driver has accepted your booking.',
  },
  arriving: {
    title: 'Driver Arriving',
    message: 'Your driver is on the way to your pickup location.',
  },
  in_progress: {
    title: 'Ride in Progress',
    message: 'Your trip is underway.',
  },
  completed: {
    title: 'Ride Completed',
    message: 'Your trip has been completed.',
  },
  cancelled: {
    title: 'Booking Cancelled',
    message: 'This booking was cancelled.',
  },
  out_of_area_searching: {
    title: 'Searching for Driver',
    message: 'Looking for available drivers for your out-of-area trip…',
  },
  driver_interested: {
    title: 'Driver Interested',
    message: 'A driver is reviewing your out-of-area request.',
  },
  fare_negotiation: {
    title: 'Fare Negotiation',
    message: 'Waiting for fare agreement with the driver.',
  },
  awaiting_passenger_confirmation: {
    title: 'Confirm Fare',
    message: 'Please review and confirm the proposed fare.',
  },
  confirmed: {
    title: 'Booking Confirmed',
    message: 'Your out-of-area trip has been confirmed.',
  },
};

export function getBookingStatusDisplay(status: BookingStatus): StatusDisplay {
  return STATUS_MESSAGES[status];
}

export function isActiveBookingStatus(status: BookingStatus): boolean {
  return !['completed', 'cancelled'].includes(status);
}
