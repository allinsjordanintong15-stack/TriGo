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

/** Status header for the passenger's live booking screen (passenger wording only). */
export function getPassengerStatusHeader(booking: Booking): StatusDisplay {
  switch (booking.status) {
    case 'pending':
      return booking.bookingType === 'out_of_area'
        ? {
            title: 'Waiting for your driver',
            message: 'Your driver is confirming the agreed trip.',
          }
        : {
            title: 'Finding a driver near you…',
            message: 'This screen updates automatically when a driver accepts.',
          };
    case 'accepted':
      return { title: 'Driver is on the way', message: 'Head to your pickup point.' };
    case 'arrived':
      return { title: 'Driver has arrived', message: 'Your driver is waiting at the pickup point.' };
    case 'in_progress':
      return { title: 'Trip in progress', message: 'Enjoy your ride.' };
    case 'completed':
      return { title: 'Trip completed', message: 'Thanks for riding with TriGo.' };
    case 'cancelled':
      return { title: 'Booking cancelled', message: getBookingDisplay(booking, 'passenger').message };
    default:
      return getBookingStatusDisplay(booking.status);
  }
}

export type ProgressStepState = 'done' | 'current' | 'upcoming' | 'cancelled';

export interface ProgressStep {
  label: string;
  state: ProgressStepState;
  /** When the step was reached (or, for the cancelled step, when it was cancelled). */
  time: Date | null;
}

/**
 * Requested → Accepted → Arrived → In progress → Completed, from the booking's status and
 * timestamps. A cancelled booking keeps the steps it reached; the next one is marked
 * cancelled and the rest stay upcoming.
 */
export function getBookingProgress(booking: Booking): ProgressStep[] {
  const steps: { label: string; status: BookingStatus; time: Date | null }[] = [
    { label: 'Requested', status: 'pending', time: booking.createdAt },
    { label: 'Accepted', status: 'accepted', time: booking.acceptedAt },
    { label: 'Arrived', status: 'arrived', time: booking.arrivedAt },
    { label: 'In progress', status: 'in_progress', time: booking.startedAt },
    { label: 'Completed', status: 'completed', time: booking.completedAt },
  ];

  if (booking.status === 'cancelled') {
    let reached = 0;
    steps.forEach((step, index) => {
      if (step.time) reached = index;
    });
    return steps.map((step, index) => {
      if (index <= reached) return { label: step.label, state: 'done', time: step.time };
      if (index === reached + 1) {
        return { label: 'Cancelled', state: 'cancelled', time: booking.cancelledAt };
      }
      return { label: step.label, state: 'upcoming', time: null };
    });
  }

  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.status === booking.status),
  );
  return steps.map((step, index) => {
    if (index < currentIndex || booking.status === 'completed') {
      return { label: step.label, state: 'done', time: step.time };
    }
    if (index === currentIndex) return { label: step.label, state: 'current', time: step.time };
    return { label: step.label, state: 'upcoming', time: null };
  });
}

/** Short clock time for progress steps, e.g. "2:14 PM". */
export function formatStepTime(date: Date | null): string | null {
  return date ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : null;
}
