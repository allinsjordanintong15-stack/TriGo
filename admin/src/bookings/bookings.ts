import type { DocumentData, Timestamp } from 'firebase/firestore';

// Read-only view of bookings/{bookingId} for admin pages (shape written by the mobile app,
// see src/types/index.ts Booking). Admins can read bookings but never write them.

export type BookingStatus = 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  arrived: 'Driver arrived',
  in_progress: 'In progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const BOOKING_TYPE_LABELS = { standard: 'Standard', out_of_area: 'Out-of-area' } as const;
export const VEHICLE_TYPE_LABELS = { tricycle: 'Tricycle', motorcycle: 'Motorcycle' } as const;
export const PAYMENT_METHOD_LABELS = { cash: 'Cash', gcash: 'GCash' } as const;

export type AdminBooking = {
  bookingId: string;
  passengerId: string;
  driverId: string | null;
  bookingType: keyof typeof BOOKING_TYPE_LABELS | null;
  vehicleType: keyof typeof VEHICLE_TYPE_LABELS | null;
  status: BookingStatus | null;
  pickupAddress: string;
  destinationAddress: string;
  distanceKm: number | null;
  estimatedFare: number | null;
  finalFare: number | null;
  paymentMethod: keyof typeof PAYMENT_METHOD_LABELS | null;
  cancelledBy: 'passenger' | 'driver' | null;
  cancellationReason: string | null;
  createdAt: Date | null;
  acceptedAt: Date | null;
  arrivedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
};

function toDate(value: unknown): Date | null {
  return (value as Timestamp | undefined)?.toDate?.() ?? null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function oneOf<T extends string>(value: unknown, allowed: Record<T, string>): T | null {
  return typeof value === 'string' && value in allowed ? (value as T) : null;
}

export function readBooking(bookingId: string, data: DocumentData): AdminBooking {
  return {
    bookingId,
    passengerId: data.passengerId ?? '',
    driverId: typeof data.driverId === 'string' ? data.driverId : null,
    bookingType: oneOf(data.bookingType, BOOKING_TYPE_LABELS),
    vehicleType: oneOf(data.vehicleType, VEHICLE_TYPE_LABELS),
    status: oneOf(data.status, BOOKING_STATUS_LABELS),
    pickupAddress: data.pickupLocation?.address ?? '',
    destinationAddress: data.destination?.address ?? '',
    distanceKm: numberOrNull(data.distanceKm),
    estimatedFare: numberOrNull(data.estimatedFare),
    finalFare: numberOrNull(data.finalFare),
    paymentMethod: oneOf(data.paymentMethod, PAYMENT_METHOD_LABELS),
    cancelledBy: data.cancelledBy === 'passenger' || data.cancelledBy === 'driver' ? data.cancelledBy : null,
    cancellationReason: typeof data.cancellationReason === 'string' ? data.cancellationReason : null,
    createdAt: toDate(data.createdAt),
    acceptedAt: toDate(data.acceptedAt),
    arrivedAt: toDate(data.arrivedAt),
    startedAt: toDate(data.startedAt),
    completedAt: toDate(data.completedAt),
    cancelledAt: toDate(data.cancelledAt),
  };
}

/** Newest first; bookings without createdAt go last. */
export function sortNewestFirst(bookings: AdminBooking[]): AdminBooking[] {
  return [...bookings].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** The fare to show: finalFare once completed, otherwise the fare shown at confirmation. */
export function displayFare(booking: AdminBooking): number | null {
  return booking.finalFare ?? booking.estimatedFare;
}

export function formatPesoOrDash(amount: number | null): string {
  return amount === null ? '—' : `₱${amount.toFixed(2)}`;
}

export function formatDateTime(date: Date | null): string {
  return date ? date.toLocaleString() : '—';
}

export function formatDate(date: Date | null): string {
  return date ? date.toLocaleDateString() : '—';
}
