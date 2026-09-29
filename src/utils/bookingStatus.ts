import { Booking, BookingStatus, PaymentMethod } from '@/types';

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
    title: 'Driver on the Way',
    message: 'A driver accepted your booking and is heading to your pickup location.',
  },
  arrived: {
    title: 'Driver Has Arrived',
    message: 'Your driver is waiting at the pickup location.',
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
};

export function getBookingStatusDisplay(status: BookingStatus): StatusDisplay {
  return STATUS_MESSAGES[status] ?? STATUS_MESSAGES.pending;
}

/** Status text for a specific booking, e.g. naming who cancelled it. */
export function getBookingDisplay(booking: Booking, viewer: 'passenger' | 'driver'): StatusDisplay {
  if (booking.status !== 'cancelled' || !booking.cancelledBy) {
    return getBookingStatusDisplay(booking.status);
  }

  const byViewer = booking.cancelledBy === viewer;
  const reason = booking.cancellationReason ? ` Reason: ${booking.cancellationReason}.` : '';

  if (booking.cancelledBy === 'passenger') {
    return {
      title: byViewer ? 'You Cancelled' : 'Cancelled by Passenger',
      message: byViewer
        ? `You cancelled this booking.${reason}`
        : `The passenger cancelled this ride.${reason}`,
    };
  }

  return {
    title: byViewer ? 'You Cancelled' : 'Cancelled by Driver',
    message: byViewer
      ? `You cancelled this trip.${reason}`
      : `The driver cancelled this ride.${reason} You can book again.`,
  };
}

export function isActiveBookingStatus(status: BookingStatus): boolean {
  return !['completed', 'cancelled'].includes(status);
}

export function formatPaymentMethod(method: PaymentMethod | null): string {
  if (method === 'cash') return 'Cash';
  if (method === 'gcash') return 'GCash';
  return '—';
}
