import type { DocumentData, Timestamp } from 'firebase/firestore';

import { formatPeso } from '../lib/format';
import { BARANGAYS } from '../tariffs/barangays';

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

export type FareBasis = 'per_km' | 'barangay_tariff';

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
  /** 'per_km' for out-of-area bookings and bookings made before barangay tariffs. */
  fareBasis: FareBasis;
  /** Barangay of each end when booked (standard bookings only). */
  pickupBarangayId: string | null;
  destinationBarangayId: string | null;
  /** Admin per-km rate of a standard per-km booking; null on older bookings. */
  perKmRate: number | null;
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
  /**
   * When an unaccepted standard booking stops being open to drivers. Null on out-of-area
   * bookings and on standard bookings made before expiry existed (those count as expired).
   */
  expiresAt: Date | null;
  /** The request an out-of-area booking was confirmed from. */
  outOfAreaRequestId: string | null;
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
    // Older bookings (and all out-of-area bookings) lack the fare basis fields.
    fareBasis: data.fareBasis === 'barangay_tariff' ? 'barangay_tariff' : 'per_km',
    pickupBarangayId: typeof data.pickupBarangayId === 'string' ? data.pickupBarangayId : null,
    destinationBarangayId: typeof data.destinationBarangayId === 'string' ? data.destinationBarangayId : null,
    perKmRate: numberOrNull(data.perKmRate),
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
    expiresAt: toDate(data.expiresAt),
    outOfAreaRequestId: typeof data.outOfAreaRequestId === 'string' ? data.outOfAreaRequestId : null,
  };
}

/**
 * Same rule as the mobile app (src/utils/bookingExpiry.ts): a standard booking still pending
 * whose expiresAt has passed, or that has none (made before expiry existed). Expiry is never
 * written to the booking, so its status stays 'pending'. Out-of-area bookings never expire this way.
 */
export function isBookingExpired(booking: AdminBooking, now: number = Date.now()): boolean {
  return (
    booking.bookingType === 'standard' &&
    booking.status === 'pending' &&
    (booking.expiresAt === null || booking.expiresAt.getTime() <= now)
  );
}

/** The status badge text and class: "Expired" for an expired standard booking. */
export function bookingStatusBadge(booking: AdminBooking, now: number = Date.now()): { label: string; className: string } {
  if (isBookingExpired(booking, now)) return { label: 'Expired', className: 'booking-status-expired' };
  if (!booking.status) return { label: 'Unknown', className: 'booking-status-unknown' };
  return { label: BOOKING_STATUS_LABELS[booking.status], className: `booking-status-${booking.status}` };
}

/** Newest first; bookings without createdAt go last. */
export function sortNewestFirst(bookings: AdminBooking[]): AdminBooking[] {
  return [...bookings].sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
}

/** The fare to show: finalFare once completed, otherwise the fare shown at confirmation. */
export function displayFare(booking: AdminBooking): number | null {
  return booking.finalFare ?? booking.estimatedFare;
}

/**
 * Same wording as the mobile app (src/utils/fareBasisLabel.ts): "Barangay tariff · Poblacion
 * ↔ Bongbong", "₱8.00/km", or "Per-km fare" for bookings without a stored rate. Null for
 * out-of-area bookings (their Type already says so).
 */
export function fareBasisLabel(booking: AdminBooking): string | null {
  if (booking.bookingType === 'out_of_area') return null;

  if (booking.fareBasis === 'barangay_tariff') {
    const otherId = booking.pickupBarangayId === 'poblacion' ? booking.destinationBarangayId : booking.pickupBarangayId;
    const name = BARANGAYS.find((barangay) => barangay.id === otherId)?.name;
    return name ? `Barangay tariff · Poblacion ↔ ${name}` : 'Barangay tariff';
  }

  return booking.perKmRate !== null ? `${formatPeso(booking.perKmRate)}/km` : 'Per-km fare';
}
